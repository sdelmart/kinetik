import { shouldRenderFrame } from './renderer.js';
import { hexToRgb } from '../core/color.js';
/**
 * Animated background layer, drawn procedurally like everything else in the
 * game. Each style has a different cost profile, so the heavy ones render into
 * a low-resolution buffer that the browser scales up — a blurry nebula is
 * indistinguishable from a sharp one, and costs a quarter of the pixels.
 */

export const BACKGROUNDS = [
  { id: 'grid', animated: true, scale: 1 },
  { id: 'nebula', animated: true, scale: 0.25 },
  { id: 'circuit', animated: true, scale: 1 },
  { id: 'rain', animated: true, scale: 1 },
  { id: 'void', animated: false, scale: 1 },
];

export const BACKGROUND_IDS = BACKGROUNDS.map((b) => b.id);

const BASE = '#0a0e1a';
const CYAN = '0, 229, 255';
const MAGENTA = '255, 45, 149';

export class BackgroundLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.style = BACKGROUNDS[0];
    this.accent = CYAN;
    this.running = false;
    this.frame = null;
    this.drops = [];
    this.traces = null;
    this.fpsCap = 60;
    this.lastDraw = 0;
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.onResize = () => {
      this.measure();
      if (!this.running) this.draw(performance.now());
    };
    window.addEventListener('resize', this.onResize);
    this.measure();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
  }

  setStyle(id) {
    const next = BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
    if (next === this.style) return;
    this.style = next;
    this.traces = null;
    this.measure();
    this.restart();
  }

  setFpsCap(cap) {
    this.fpsCap = Number.isFinite(cap) ? Math.max(0, cap) : 60;
  }

  /** Worlds tint the background with their own accent. */
  setAccent(hex) {
    this.accent = hexToRgb(hex) ?? CYAN;
    this.traces = null;
  }

  /** Measures only — painting is left to the caller, so the two can't recurse. */
  measure() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * this.style.scale;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.max(1, Math.round(this.width * dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seedDrops();
    this.traces = null;
  }

  seedDrops() {
    const count = Math.round((this.width * this.height) / 26000);
    this.drops = Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      speed: 26 + Math.random() * 90,
      length: 12 + Math.random() * 46,
    }));
  }

  restart() {
    this.stop();
    this.start();
  }

  start() {
    if (this.running) return;
    // A still background needs one paint, not a render loop.
    if (!this.style.animated || this.reduceMotion) {
      this.draw(performance.now());
      return;
    }
    this.running = true;
    this.last = performance.now();
    this.lastDraw = 0;
    const loop = (time) => {
      if (!this.running) return;
      this.frame = requestAnimationFrame(loop);

      // The backdrop follows the same frame budget as the board.
      if (!shouldRenderFrame(time, this.lastDraw, this.fpsCap)) return;
      this.lastDraw = time;
      this.draw(time);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  draw(time) {
    // The window can still be unmeasured when the layer is built (hidden tab,
    // embedded webview), so re-measure rather than painting into a 1x1 canvas.
    if (this.width !== window.innerWidth || this.height !== window.innerHeight) {
      this.measure();
    }

    const { ctx, width, height } = this;
    const delta = Math.min(0.05, (time - (this.last ?? time)) / 1000);
    this.last = time;

    ctx.fillStyle = BASE;
    ctx.fillRect(0, 0, width, height);

    switch (this.style.id) {
      case 'grid':
        this.drawGrid(time);
        break;
      case 'nebula':
        this.drawNebula(time);
        break;
      case 'circuit':
        this.drawCircuit(time);
        break;
      case 'rain':
        this.drawRain(delta);
        break;
      default:
        this.drawVignette();
    }
  }

  drawVignette() {
    const { ctx, width, height } = this;
    const gradient = ctx.createRadialGradient(
      width / 2,
      height * 0.4,
      0,
      width / 2,
      height * 0.4,
      Math.max(width, height) * 0.75,
    );
    gradient.addColorStop(0, `rgba(${this.accent}, 0.05)`);
    gradient.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /** Perspective floor grid scrolling towards the viewer. */
  drawGrid(time) {
    const { ctx, width, height } = this;
    this.drawVignette();

    const horizon = height * 0.42;
    const scroll = (time / 1400) % 1;
    ctx.lineWidth = 1;

    for (let i = 0; i < 22; i++) {
      const t = (i + scroll) / 22;
      const y = horizon + (height - horizon) * t * t;
      if (y > height) continue;
      ctx.strokeStyle = `rgba(${this.accent}, ${0.16 * (1 - t) + 0.02})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const vanishX = width / 2;
    for (let i = -14; i <= 14; i++) {
      const x = vanishX + i * (width / 14);
      ctx.strokeStyle = `rgba(${this.accent}, 0.07)`;
      ctx.beginPath();
      ctx.moveTo(vanishX + (x - vanishX) * 0.06, horizon);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(${this.accent}, 0.3)`;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(width, horizon);
    ctx.stroke();
  }

  drawNebula(time) {
    const { ctx, width, height } = this;
    const blobs = [
      { c: this.accent, x: 0.2, y: 0.15, r: 0.75, speed: 0.00013, alpha: 0.2 },
      { c: MAGENTA, x: 0.85, y: 0.25, r: 0.65, speed: 0.00019, alpha: 0.17 },
      { c: this.accent, x: 0.6, y: 0.9, r: 0.7, speed: 0.00011, alpha: 0.12 },
    ];

    for (const blob of blobs) {
      const cx = (blob.x + Math.sin(time * blob.speed) * 0.09) * width;
      const cy = (blob.y + Math.cos(time * blob.speed * 1.3) * 0.07) * height;
      const radius = blob.r * Math.max(width, height) * 0.6;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${blob.c}, ${blob.alpha})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  }

  /** Static traces are rendered once; only the travelling pulses animate. */
  drawCircuit(time) {
    const { ctx, width, height } = this;
    if (!this.traces) this.buildTraces();

    ctx.strokeStyle = `rgba(${this.accent}, 0.1)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const trace of this.traces) {
      ctx.moveTo(trace[0].x, trace[0].y);
      for (const point of trace.slice(1)) ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    ctx.fillStyle = `rgba(${this.accent}, 0.22)`;
    for (const trace of this.traces) {
      const end = trace[trace.length - 1];
      ctx.beginPath();
      ctx.arc(end.x, end.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    this.traces.forEach((trace, index) => {
      const progress = ((time / 2600) + index * 0.17) % 1;
      const point = pointAlong(trace, progress);
      if (!point) return;
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 22);
      gradient.addColorStop(0, `rgba(${this.accent}, 0.5)`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(point.x - 22, point.y - 22, 44, 44);
    });
  }

  buildTraces() {
    const { width, height } = this;
    const step = 46;
    const count = Math.max(5, Math.round(width / 210));
    this.traces = [];

    for (let i = 0; i < count; i++) {
      const points = [{ x: Math.random() * width, y: Math.random() * height }];
      let horizontal = Math.random() < 0.5;
      for (let s = 0; s < 7; s++) {
        const previous = points[points.length - 1];
        const distance = step * (1 + Math.floor(Math.random() * 3));
        const sign = Math.random() < 0.5 ? -1 : 1;
        points.push({
          x: clamp(previous.x + (horizontal ? distance * sign : 0), 0, width),
          y: clamp(previous.y + (horizontal ? 0 : distance * sign), 0, height),
        });
        horizontal = !horizontal;
      }
      this.traces.push(points);
    }
  }

  drawRain(delta) {
    const { ctx, width, height } = this;
    this.drawVignette();
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';

    for (const drop of this.drops) {
      drop.y += drop.speed * delta * 3;
      if (drop.y - drop.length > height) {
        drop.y = -drop.length;
        drop.x = Math.random() * width;
      }
      const gradient = ctx.createLinearGradient(drop.x, drop.y - drop.length, drop.x, drop.y);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(${this.accent}, 0.22)`);
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y - drop.length);
      ctx.lineTo(drop.x, drop.y);
      ctx.stroke();
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pointAlong(points, progress) {
  let total = 0;
  const spans = [];
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    spans.push(length);
    total += length;
  }
  if (!total) return null;

  let target = progress * total;
  for (let i = 0; i < spans.length; i++) {
    if (target <= spans[i]) {
      const k = spans[i] ? target / spans[i] : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * k,
        y: points[i].y + (points[i + 1].y - points[i].y) * k,
      };
    }
    target -= spans[i];
  }
  return points[points.length - 1];
}
