import { T } from '../core/constants.js';

/**
 * Every tile and entity is drawn with canvas primitives — no image assets, so
 * the game stays sharp at any resolution and ships nothing to license.
 */

export const PALETTE = {
  void: '#060911',
  floor: '#111827',
  floorEdge: '#1b2537',
  wall: '#1f2b3f',
  wallEdge: '#38507a',
  crate: '#3a2f22',
  crateEdge: '#c98b3c',
  crateLit: '#2f4a33',
  crateLitEdge: '#54e08a',
  danger: '#ff4d6d',
  ice: '#7ae7ff',
  belt: '#2a3550',
  amber: '#ffb300',
  magenta: '#ff2d95',
};

function glowStroke(ctx, color, blur, enabled) {
  ctx.strokeStyle = color;
  ctx.shadowColor = enabled ? color : 'transparent';
  ctx.shadowBlur = enabled ? blur : 0;
}

function clearGlow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawTile(ctx, tile, x, y, size, theme) {
  const { accent, glow, time } = theme;
  const pad = size * 0.06;

  switch (tile) {
    case T.WALL: {
      ctx.fillStyle = PALETTE.wall;
      roundRect(ctx, x + 1, y + 1, size - 2, size - 2, size * 0.12);
      ctx.fill();
      ctx.lineWidth = Math.max(1, size * 0.035);
      glowStroke(ctx, PALETTE.wallEdge, size * 0.12, glow);
      ctx.stroke();
      clearGlow(ctx);
      // rivets
      ctx.fillStyle = 'rgba(146,178,232,0.35)';
      const r = size * 0.035;
      for (const [rx, ry] of [
        [0.22, 0.22],
        [0.78, 0.22],
        [0.22, 0.78],
        [0.78, 0.78],
      ]) {
        ctx.beginPath();
        ctx.arc(x + size * rx, y + size * ry, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case T.TARGET: {
      drawPlainFloor(ctx, x, y, size);
      const pulse = 0.5 + 0.5 * Math.sin(time / 380);
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      glowStroke(ctx, accent, size * (0.14 + pulse * 0.16), glow);
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.27, 0, Math.PI * 2);
      ctx.stroke();
      clearGlow(ctx);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.18 + pulse * 0.22;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }

    case T.PIT: {
      ctx.fillStyle = PALETTE.void;
      roundRect(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, size * 0.14);
      ctx.fill();
      ctx.lineWidth = Math.max(1, size * 0.04);
      glowStroke(ctx, PALETTE.danger, size * 0.1, glow);
      ctx.stroke();
      clearGlow(ctx);
      break;
    }

    case T.PIT_FILLED: {
      drawPlainFloor(ctx, x, y, size);
      ctx.strokeStyle = 'rgba(201,139,60,0.5)';
      ctx.lineWidth = Math.max(1, size * 0.03);
      roundRect(ctx, x + pad * 2, y + pad * 2, size - pad * 4, size - pad * 4, size * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + pad * 2, y + size / 2);
      ctx.lineTo(x + size - pad * 2, y + size / 2);
      ctx.stroke();
      break;
    }

    case T.FRAGILE: {
      drawPlainFloor(ctx, x, y, size);
      ctx.strokeStyle = 'rgba(255,179,0,0.75)';
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.2, y + size * 0.3);
      ctx.lineTo(x + size * 0.45, y + size * 0.52);
      ctx.lineTo(x + size * 0.33, y + size * 0.72);
      ctx.moveTo(x + size * 0.62, y + size * 0.24);
      ctx.lineTo(x + size * 0.55, y + size * 0.5);
      ctx.lineTo(x + size * 0.78, y + size * 0.66);
      ctx.stroke();
      break;
    }

    case T.BROKEN: {
      ctx.fillStyle = PALETTE.void;
      roundRect(ctx, x + 1, y + 1, size - 2, size - 2, size * 0.1);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,77,109,0.45)';
      ctx.lineWidth = Math.max(1, size * 0.025);
      ctx.stroke();
      break;
    }

    case T.ICE: {
      ctx.fillStyle = '#16303c';
      roundRect(ctx, x + 1, y + 1, size - 2, size - 2, size * 0.08);
      ctx.fill();
      ctx.strokeStyle = 'rgba(122,231,255,0.5)';
      ctx.lineWidth = Math.max(1, size * 0.025);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.15, y + size * 0.7);
      ctx.lineTo(x + size * 0.45, y + size * 0.2);
      ctx.moveTo(x + size * 0.5, y + size * 0.82);
      ctx.lineTo(x + size * 0.85, y + size * 0.3);
      ctx.stroke();
      break;
    }

    case T.CONV_UP:
    case T.CONV_RIGHT:
    case T.CONV_DOWN:
    case T.CONV_LEFT: {
      drawConveyor(ctx, tile, x, y, size, theme);
      break;
    }

    case T.TELE_A:
    case T.TELE_B: {
      drawPlainFloor(ctx, x, y, size);
      const color = tile === T.TELE_A ? PALETTE.magenta : PALETTE.ice;
      const spin = time / 600 + (tile === T.TELE_A ? 0 : Math.PI);
      ctx.lineWidth = Math.max(1.5, size * 0.045);
      glowStroke(ctx, color, size * 0.2, glow);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(
          x + size / 2,
          y + size / 2,
          size * (0.12 + i * 0.09),
          spin + i,
          spin + i + Math.PI * 1.25,
        );
        ctx.stroke();
      }
      clearGlow(ctx);
      break;
    }

    case T.SWITCH: {
      drawPlainFloor(ctx, x, y, size);
      const pressed = theme.switchPressed;
      const color = pressed ? '#54e08a' : PALETTE.amber;
      ctx.lineWidth = Math.max(1.5, size * 0.045);
      glowStroke(ctx, color, size * (pressed ? 0.22 : 0.1), glow);
      roundRect(ctx, x + size * 0.24, y + size * 0.24, size * 0.52, size * 0.52, size * 0.12);
      ctx.stroke();
      clearGlow(ctx);
      if (pressed) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      break;
    }

    case T.GATE: {
      const open = theme.gateOpen;
      drawPlainFloor(ctx, x, y, size);
      const color = open ? '#54e08a' : PALETTE.danger;
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      glowStroke(ctx, color, size * 0.16, glow);
      const inset = open ? size * 0.38 : size * 0.1;
      for (const dir of [-1, 1]) {
        const cy = y + size / 2 + dir * inset;
        ctx.beginPath();
        ctx.moveTo(x + size * 0.12, cy);
        ctx.lineTo(x + size * 0.88, cy);
        ctx.stroke();
      }
      clearGlow(ctx);
      break;
    }

    default:
      drawPlainFloor(ctx, x, y, size);
  }
}

function drawPlainFloor(ctx, x, y, size) {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = PALETTE.floorEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}

function drawConveyor(ctx, tile, x, y, size, theme) {
  ctx.fillStyle = PALETTE.belt;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(146,178,232,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

  const angle = {
    [T.CONV_UP]: -Math.PI / 2,
    [T.CONV_RIGHT]: 0,
    [T.CONV_DOWN]: Math.PI / 2,
    [T.CONV_LEFT]: Math.PI,
  }[tile];

  const offset = ((theme.time / 420) % 1) * size * 0.5;
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(angle);
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(1.5, size * 0.055);
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const px = -size * 0.24 + i * size * 0.25 + offset;
    if (px > size * 0.34) continue;
    ctx.beginPath();
    ctx.moveTo(px - size * 0.08, -size * 0.14);
    ctx.lineTo(px + size * 0.06, 0);
    ctx.lineTo(px - size * 0.08, size * 0.14);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawCrate(ctx, x, y, size, { lit, glow, accent }) {
  const pad = size * 0.11;
  const w = size - pad * 2;
  const body = lit ? PALETTE.crateLit : PALETTE.crate;
  const edge = lit ? PALETTE.crateLitEdge : PALETTE.crateEdge;

  ctx.fillStyle = body;
  roundRect(ctx, x + pad, y + pad, w, w, size * 0.1);
  ctx.fill();

  ctx.lineWidth = Math.max(1.5, size * 0.045);
  glowStroke(ctx, edge, size * (lit ? 0.26 : 0.1), glow);
  ctx.stroke();
  clearGlow(ctx);

  // corrugation
  ctx.strokeStyle = lit ? 'rgba(84,224,138,0.35)' : 'rgba(201,139,60,0.3)';
  ctx.lineWidth = Math.max(1, size * 0.022);
  for (let i = 1; i <= 2; i++) {
    const cx = x + pad + (w / 3) * i;
    ctx.beginPath();
    ctx.moveTo(cx, y + pad + size * 0.06);
    ctx.lineTo(cx, y + pad + w - size * 0.06);
    ctx.stroke();
  }

  // status light
  ctx.fillStyle = lit ? PALETTE.crateLitEdge : accent;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + pad + size * 0.12, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDrone(ctx, x, y, size, { facing, glow, accent, time }) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.3;
  const hover = Math.sin(time / 260) * size * 0.02;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy + hover);

  ctx.fillStyle = '#16233a';
  roundRect(ctx, -r, -r, r * 2, r * 2, size * 0.11);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.045);
  glowStroke(ctx, accent, size * 0.22, glow);
  ctx.stroke();
  clearGlow(ctx);

  // visor, oriented towards the facing direction
  const angle = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI }[facing] ?? Math.PI / 2;
  ctx.rotate(angle);
  ctx.fillStyle = accent;
  roundRect(ctx, r * 0.15, -r * 0.42, r * 0.5, r * 0.84, size * 0.04);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(r * 0.42, 0, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
