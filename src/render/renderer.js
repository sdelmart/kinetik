import { T, DIRS } from '../core/constants.js';
import { gatesOpen } from '../core/state.js';
import { drawTile, drawCrate, drawDrone, PALETTE } from './sprites.js';

const MOVE_MS = 115;
const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * Frame pacing. A cap of 0 means "follow the display". The 1 ms tolerance stops
 * a 60 Hz screen from halving to 30 because a frame arrives a hair early.
 * @returns whether this frame should be drawn.
 */
export function shouldRenderFrame(time, lastDraw, fpsCap) {
  if (!Number.isFinite(fpsCap) || fpsCap <= 0) return true;
  if (!lastDraw) return true;
  return time - lastDraw >= 1000 / fpsCap - 1;
}

/**
 * Canvas board renderer. It owns its own animation loop and interpolates the
 * drone and the pushed container between grid cells, so movement reads as
 * motion rather than teleporting.
 */
export class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = null;
    this.previous = null;
    this.motionStart = 0;
    this.motions = [];
    this.particles = [];
    this.options = { accent: '#00e5ff', glow: true, showGrid: true, fpsCap: 60 };
    this.geometry = { tile: 32, originX: 0, originY: 0 };
    this.running = false;
    this.shake = 0;
    this.lastDraw = 0;
    this.fps = 0;
    this.fpsSamples = [];

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  configure(options) {
    Object.assign(this.options, options);
  }

  destroy() {
    this.stop();
    this.observer.disconnect();
  }

  resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewport = { width: rect.width, height: rect.height };
    this.computeGeometry();
  }

  computeGeometry() {
    if (!this.state || !this.viewport) return;
    const { width, height } = this.state;
    const tile = Math.floor(
      Math.min(this.viewport.width / width, this.viewport.height / height),
    );
    this.geometry = {
      tile,
      originX: Math.round((this.viewport.width - tile * width) / 2),
      originY: Math.round((this.viewport.height - tile * height) / 2),
    };
  }

  /** Diffing the two states tells us exactly what moved — at most one container. */
  setState(state, { animate = true } = {}) {
    const previous = this.state;
    this.state = state;
    this.computeGeometry();

    if (!animate || !previous || previous.width !== state.width) {
      this.motions = [];
      return;
    }

    const motions = [];
    if (previous.player !== state.player) {
      motions.push({ kind: 'player', from: previous.player, to: state.player });
    }
    const left = [...previous.crates].filter((i) => !state.crates.has(i));
    const arrived = [...state.crates].filter((i) => !previous.crates.has(i));
    if (left.length === 1 && arrived.length === 1) {
      motions.push({ kind: 'crate', from: left[0], to: arrived[0] });
    }

    this.motions = motions;
    this.motionStart = performance.now();
  }

  /** Flags the suggested direction for a few seconds after a hint is spent. */
  showHint(direction) {
    this.hint = { direction, until: performance.now() + 6000 };
  }

  /**
   * Marks the cell the drone should move into. The destination often holds an
   * amber container, so the marker is drawn with a dark backing stroke and a
   * white core to stay readable whatever is underneath.
   */
  drawHint(ctx, time, tile) {
    if (!this.hint || time > this.hint.until) {
      this.hint = null;
      return;
    }

    const { dx, dy } = DIRS[this.hint.direction];
    const x = ((this.state.player % this.state.width) + dx) * tile;
    const y = (Math.floor(this.state.player / this.state.width) + dy) * tile;
    const pulse = 0.5 + 0.5 * Math.sin(time / 220);
    const inset = tile * 0.08;

    ctx.save();

    ctx.fillStyle = `rgba(255, 179, 0, ${0.12 + pulse * 0.16})`;
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, tile - inset * 2, tile - inset * 2, tile * 0.14);
    ctx.fill();

    ctx.strokeStyle = '#ffb300';
    ctx.shadowColor = '#ffb300';
    ctx.shadowBlur = tile * (0.2 + pulse * 0.3);
    ctx.lineWidth = Math.max(2, tile * 0.06);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.translate(x + tile / 2, y + tile / 2);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const arrow = () => {
      ctx.beginPath();
      ctx.moveTo(-tile * 0.15, -tile * 0.19);
      ctx.lineTo(tile * 0.09, 0);
      ctx.lineTo(-tile * 0.15, tile * 0.19);
      ctx.stroke();
    };

    ctx.strokeStyle = 'rgba(6, 9, 17, 0.9)';
    ctx.lineWidth = Math.max(5, tile * 0.16);
    arrow();

    ctx.strokeStyle = '#fff6df';
    ctx.lineWidth = Math.max(2, tile * 0.075);
    arrow();

    ctx.restore();
  }

  emit(events) {
    for (const event of events) {
      if (event.type === 'fill') {
        this.burst(event.index, PALETTE.crateEdge, 16);
        this.shake = 5;
      } else if (event.type === 'break') {
        this.burst(event.index, PALETTE.danger, 20);
        this.shake = 6;
      } else if (event.type === 'teleport') {
        this.burst(event.to, PALETTE.magenta, 14);
      }
    }
  }

  burst(index, color, count) {
    if (!this.state) return;
    const { tile } = this.geometry;
    const x = (index % this.state.width) * tile + tile / 2;
    const y = Math.floor(index / this.state.width) * tile + tile / 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = tile * (0.04 + Math.random() * 0.07);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: tile * (0.04 + Math.random() * 0.05),
      });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (time) => {
      if (!this.running) return;
      this.frame = requestAnimationFrame(loop);

      if (!shouldRenderFrame(time, this.lastDraw, this.options.fpsCap)) return;

      this.measureFps(time);
      this.lastDraw = time;
      this.draw(time);
    };
    this.frame = requestAnimationFrame(loop);
  }

  measureFps(time) {
    if (this.lastDraw) {
      const delta = time - this.lastDraw;
      if (delta > 0) {
        this.fpsSamples.push(1000 / delta);
        if (this.fpsSamples.length > 30) this.fpsSamples.shift();
        this.fps = Math.round(
          this.fpsSamples.reduce((sum, v) => sum + v, 0) / this.fpsSamples.length,
        );
      }
    }
  }

  stop() {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  cellFromPoint(clientX, clientY) {
    if (!this.state) return null;
    const rect = this.canvas.getBoundingClientRect();
    const { tile, originX, originY } = this.geometry;
    const x = Math.floor((clientX - rect.left - originX) / tile);
    const y = Math.floor((clientY - rect.top - originY) / tile);
    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) return null;
    return { x, y };
  }

  motionOffset(kind, index, progress) {
    const motion = this.motions.find((m) => m.kind === kind && m.to === index);
    if (!motion || progress >= 1) return null;
    const { width } = this.state;
    const fx = motion.from % width;
    const fy = Math.floor(motion.from / width);
    const tx = motion.to % width;
    const ty = Math.floor(motion.to / width);
    const k = easeOut(progress);
    return { x: fx + (tx - fx) * k, y: fy + (ty - fy) * k };
  }

  draw(time) {
    const { ctx, state } = this;
    if (!state || !this.viewport) return;

    const { tile, originX, originY } = this.geometry;
    const progress = this.motions.length
      ? Math.min(1, (time - this.motionStart) / MOVE_MS)
      : 1;

    ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= 0.82;
    }
    ctx.translate(originX, originY);

    const open = gatesOpen(state);
    const theme = {
      accent: this.options.accent,
      glow: this.options.glow,
      time,
      gateOpen: open,
    };

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const index = y * state.width + x;
        const tileCode = state.terrain[index];
        theme.switchPressed =
          tileCode === T.SWITCH && (state.player === index || state.crates.has(index));
        drawTile(ctx, tileCode, x * tile, y * tile, tile, theme);
      }
    }

    if (this.options.showGrid) {
      ctx.strokeStyle = 'rgba(146,178,232,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < state.width; x++) {
        ctx.moveTo(x * tile + 0.5, 0);
        ctx.lineTo(x * tile + 0.5, state.height * tile);
      }
      for (let y = 1; y < state.height; y++) {
        ctx.moveTo(0, y * tile + 0.5);
        ctx.lineTo(state.width * tile, y * tile + 0.5);
      }
      ctx.stroke();
    }

    for (const index of state.crates) {
      const pos = this.motionOffset('crate', index, progress) ?? {
        x: index % state.width,
        y: Math.floor(index / state.width),
      };
      drawCrate(ctx, pos.x * tile, pos.y * tile, tile, {
        lit: state.terrain[index] === T.TARGET,
        glow: this.options.glow,
        accent: this.options.accent,
      });
    }

    // The editor can hold a board with no drone placed yet.
    if (state.player >= 0) {
      const playerPos = this.motionOffset('player', state.player, progress) ?? {
        x: state.player % state.width,
        y: Math.floor(state.player / state.width),
      };
      drawDrone(ctx, playerPos.x * tile, playerPos.y * tile, tile, {
        facing: state.facing,
        glow: this.options.glow,
        accent: this.options.accent,
        time,
      });
    }

    this.drawHint(ctx, time, tile);
    this.drawParticles(ctx);
    ctx.restore();
  }

  drawParticles(ctx) {
    if (!this.particles.length) return;
    const remaining = [];
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.035;
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      remaining.push(p);
    }
    ctx.globalAlpha = 1;
    this.particles = remaining;
  }
}
