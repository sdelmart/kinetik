import { N, E, S, W } from './maze.js';

/**
 * Canvas renderer for the labyrinth — a top-down stone maze, warm torchlight
 * instead of the Sokoban sectors' neon, but drawn the same way: plain canvas
 * primitives, no image assets.
 */
export const LAB_PALETTE = {
  void: '#07090c',
  floor: '#241c16',
  floorVisited: '#3a2d20',
  floorRemembered: '#18130f',
  wall: '#120e0b',
  wallEdge: '#5a4530',
  wallRemembered: '#33281d',
  player: '#ffcf7a',
  exit: '#7affa0',
  gateLocked: '#ff6a4d',
  gateOpen: '#7affa0',
  secretHint: '#ffcf7a',
};

const DIR_SIDES = [
  { bit: N, x1: 0, y1: 0, x2: 1, y2: 0 },
  { bit: E, x1: 1, y1: 0, x2: 1, y2: 1 },
  { bit: S, x1: 0, y1: 1, x2: 1, y2: 1 },
  { bit: W, x1: 0, y1: 0, x2: 0, y2: 1 },
];

const DELTA = { [N]: { dx: 0, dy: -1 }, [E]: { dx: 1, dy: 0 }, [S]: { dx: 0, dy: 1 }, [W]: { dx: -1, dy: 0 } };

function edgeKeyFor(x, y, bit) {
  const d = DELTA[bit];
  const nx = x + d.dx;
  const ny = y + d.dy;
  const a = y * 1e4 + x;
  const b = ny * 1e4 + nx;
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * 'lit' (inside the torch radius, or the whole maze when there's no fog),
 * 'remembered' (visited before, now out of the light) or 'dark'.
 */
export function cellVisibility(run, x, y) {
  const vision = run.spec?.vision;
  if (!vision) return 'lit';
  const dx = x - run.player.x;
  const dy = y - run.player.y;
  if (dx * dx + dy * dy <= vision * vision) return 'lit';
  return run.visited.has(`${x},${y}`) ? 'remembered' : 'dark';
}

/** A closed portcullis drawn along the shared edge, so it sits exactly on the cell boundary. */
function drawGate(ctx, x1, y1, x2, y2, tile) {
  const horizontal = y1 === y2;
  const inset = tile * 0.12;
  const half = tile * 0.08;
  ctx.fillStyle = LAB_PALETTE.gateLocked;
  if (horizontal) {
    ctx.fillRect(x1 + inset, y1 - half, x2 - x1 - inset * 2, half * 2);
  } else {
    ctx.fillRect(x1 - half, y1 + inset, half * 2, y2 - y1 - inset * 2);
  }
  // Bars across the gate.
  ctx.fillStyle = '#3a1208';
  const bars = 3;
  for (let i = 1; i <= bars; i++) {
    const k = i / (bars + 1);
    if (horizontal) ctx.fillRect(x1 + (x2 - x1) * k - 1, y1 - half, 2, half * 2);
    else ctx.fillRect(x1 - half, y1 + (y2 - y1) * k - 1, half * 2, 2);
  }
}

export function drawMaze(ctx, run, { tile, time = 0 }) {
  const { maze, player, visited, locks, resolved } = run;
  const { width, height } = maze;
  const fog = Boolean(run.spec?.vision);

  ctx.fillStyle = LAB_PALETTE.void;
  ctx.fillRect(0, 0, width * tile, height * tile);

  const seen = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const visibility = cellVisibility(run, x, y);
      seen[y * width + x] = visibility;
      if (visibility === 'dark') continue;
      if (visibility === 'remembered') ctx.fillStyle = LAB_PALETTE.floorRemembered;
      else ctx.fillStyle = visited.has(`${x},${y}`) ? LAB_PALETTE.floorVisited : LAB_PALETTE.floor;
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }

  ctx.lineCap = 'round';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const visibility = seen[y * width + x];
      if (visibility === 'dark') continue;
      const lit = visibility === 'lit';
      const cell = maze.cells[y * width + x];
      const px = x * tile;
      const py = y * tile;

      for (const side of DIR_SIDES) {
        const open = cell & side.bit;
        const key = edgeKeyFor(x, y, side.bit);
        const lock = locks.get(key);
        const isLocked = lock && !resolved.has(key);
        const x1 = px + side.x1 * tile;
        const y1 = py + side.y1 * tile;
        const x2 = px + side.x2 * tile;
        const y2 = py + side.y2 * tile;

        if (!open) {
          ctx.strokeStyle = lit ? LAB_PALETTE.wallEdge : LAB_PALETTE.wallRemembered;
          ctx.lineWidth = Math.max(2, tile * 0.1);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // A secret passage gives the faintest shimmer, only once the
          // player stands next to it — discovery should take walking there.
          if (lock?.kind === 'secret' && isLocked) {
            const near = Math.abs(player.x - x) + Math.abs(player.y - y) <= 1;
            if (near) {
              const pulse = 0.25 + 0.2 * Math.sin(time / 300);
              ctx.strokeStyle = LAB_PALETTE.secretHint;
              ctx.globalAlpha = pulse;
              ctx.lineWidth = Math.max(1.5, tile * 0.05);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        } else if (isLocked && lock.kind === 'gate') {
          ctx.globalAlpha = lit ? 1 : 0.45;
          drawGate(ctx, x1, y1, x2, y2, tile);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // Exit: in the fog, only a faint beacon until it's actually been seen.
  const exitSeen = seen[maze.exit.y * width + maze.exit.x] !== 'dark';
  const ex = maze.exit.x * tile + tile / 2;
  const ey = maze.exit.y * tile + tile / 2;
  const pulse = 0.6 + 0.4 * Math.sin(time / 260);
  ctx.fillStyle = LAB_PALETTE.exit;
  ctx.globalAlpha = exitSeen ? 0.5 + pulse * 0.3 : 0.12 + pulse * 0.1;
  ctx.beginPath();
  ctx.arc(ex, ey, tile * (exitSeen ? 0.3 : 0.22), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Torchlight falloff around the player, so the edge of the light is soft.
  if (fog) {
    const cx = player.x * tile + tile / 2;
    const cy = player.y * tile + tile / 2;
    const reach = (run.spec.vision + 0.6) * tile;
    const flicker = 1 + 0.03 * Math.sin(time / 90);
    const gradient = ctx.createRadialGradient(cx, cy, reach * 0.35, cx, cy, reach * flicker);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(7,9,12,0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width * tile, height * tile);
  }

  // player
  const pxp = player.x * tile + tile / 2;
  const pyp = player.y * tile + tile / 2;
  ctx.fillStyle = LAB_PALETTE.player;
  ctx.beginPath();
  ctx.arc(pxp, pyp, tile * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = Math.max(1, tile * 0.04);
  ctx.stroke();
}
