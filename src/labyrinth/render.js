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
  wall: '#120e0b',
  wallEdge: '#5a4530',
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

export function drawMaze(ctx, run, { tile, time = 0 }) {
  const { maze, player, visited, locks, resolved } = run;
  const { width, height } = maze;

  ctx.fillStyle = LAB_PALETTE.void;
  ctx.fillRect(0, 0, width * tile, height * tile);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const seen = visited.has(`${x},${y}`);
      ctx.fillStyle = seen ? LAB_PALETTE.floorVisited : LAB_PALETTE.floor;
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }

  ctx.lineCap = 'round';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const cell = maze.cells[idx];
      const px = x * tile;
      const py = y * tile;

      for (const side of DIR_SIDES) {
        const open = cell & side.bit;
        const key = edgeKeyFor(x, y, side.bit);
        const lock = locks.get(key);
        const isLocked = lock && !resolved.has(key);

        if (!open) {
          ctx.strokeStyle = LAB_PALETTE.wallEdge;
          ctx.lineWidth = Math.max(2, tile * 0.1);
          ctx.beginPath();
          ctx.moveTo(px + side.x1 * tile, py + side.y1 * tile);
          ctx.lineTo(px + side.x2 * tile, py + side.y2 * tile);
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
          const mx = px + ((side.x1 + side.x2) / 2) * tile;
          const my = py + ((side.y1 + side.y2) / 2) * tile;
          ctx.fillStyle = LAB_PALETTE.gateLocked;
          ctx.beginPath();
          ctx.arc(mx, my, tile * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // exit
  const ex = maze.exit.x * tile + tile / 2;
  const ey = maze.exit.y * tile + tile / 2;
  const pulse = 0.6 + 0.4 * Math.sin(time / 260);
  ctx.fillStyle = LAB_PALETTE.exit;
  ctx.globalAlpha = 0.5 + pulse * 0.3;
  ctx.beginPath();
  ctx.arc(ex, ey, tile * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

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
