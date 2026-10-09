/**
 * The intro → home transition, rendered as a small 3D scene on a canvas laid
 * over the whole window: the cracked surface shatters into shards that tumble
 * toward the camera (the ones along the crack first), the camera dives through
 * the gap down a tunnel of light frames, and the home screen surfaces at the
 * far end. Plain perspective projection, no 3D library.
 *
 * World units are screen pixels measured from the centre, at the depth of the
 * cracked surface (z = 1), so the surface starts out pixel-identical to the
 * DOM intro it replaces.
 */

/** The crack, in percent of the viewport. Shared with the DOM intro screen. */
export const SPINE = [
  [50, 0], [47, 8], [53, 16], [45, 26], [56, 36],
  [44, 48], [54, 58], [46, 70], [52, 82], [48, 92], [50, 100],
];
export const BRANCHES = [
  [[45, 26], [30, 31], [22, 24]],
  [[54, 58], [68, 54], [76, 61]],
  [[46, 70], [36, 78]],
];

const SWAP_AT = 1.2;
const END_AT = 1.8;
const NEAR = 0.06;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (v) => 1 - (1 - v) ** 3;
const easeInOutCubic = (v) => (v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2);
const lerp = (a, b, k) => a + (b - a) * k;

/** Crack x (in percent) at a given y (in percent), by interpolating the spine. */
function spineX(yPercent) {
  for (let i = 1; i < SPINE.length; i++) {
    const [x0, y0] = SPINE[i - 1];
    const [x1, y1] = SPINE[i];
    if (yPercent <= y1) return lerp(x0, x1, (yPercent - y0) / (y1 - y0 || 1));
  }
  return 50;
}

/** Rotates v around a unit axis by angle (Rodrigues). */
function rotate([x, y, z], [ax, ay, az], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dot = ax * x + ay * y + az * z;
  return [
    x * c + (ay * z - az * y) * s + ax * dot * (1 - c),
    y * c + (az * x - ax * z) * s + ay * dot * (1 - c),
    z * c + (ax * y - ay * x) * s + az * dot * (1 - c),
  ];
}

function randomAxis() {
  const v = [Math.random() - 0.5, Math.random() - 0.5, (Math.random() - 0.5) * 0.4];
  const len = Math.hypot(...v) || 1;
  return v.map((n) => n / len);
}

/** Triangulates the screen into jittered shards, each knowing which side of the crack it's on. */
function buildShards(width, height) {
  const cols = Math.max(6, Math.round(width / 120));
  const rows = Math.max(5, Math.round(height / 120));
  const grid = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      const edgeX = c === 0 || c === cols;
      const edgeY = r === 0 || r === rows;
      const jx = edgeX ? 0 : (Math.random() - 0.5) * (width / cols) * 0.7;
      const jy = edgeY ? 0 : (Math.random() - 0.5) * (height / rows) * 0.7;
      row.push([(c / cols) * width + jx - width / 2, (r / rows) * height + jy - height / 2]);
    }
    grid.push(row);
  }

  const shards = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r][c];
      const b = grid[r][c + 1];
      const d = grid[r + 1][c];
      const e = grid[r + 1][c + 1];
      const flip = Math.random() < 0.5;
      for (const tri of flip ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]]) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const yPercent = ((cy + height / 2) / height) * 100;
        const crackX = (spineX(yPercent) / 100) * width - width / 2;
        const side = cx < crackX ? -1 : 1;
        const distance = Math.abs(cx - crackX) / (width / 2);
        shards.push({
          local: tri.map(([x, y]) => [x - cx, y - cy, 0]),
          cx,
          cy,
          shade: (cy + height / 2) / height,
          delay: 0.14 + distance * 0.32 + Math.random() * 0.06,
          vx: side * (0.35 + Math.random() * 0.5 + (1 - distance) * 0.4) * width,
          vy: (Math.random() - 0.5) * 0.5 * height,
          vz: -(0.5 + Math.random() * 0.6),
          axis: randomAxis(),
          spin: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5),
        });
      }
    }
  }
  return shards;
}

function buildTunnel(width, height) {
  const frames = [];
  for (let k = 0; k < 16; k++) {
    frames.push({ z: 1.35 + k * 0.42, twist: k * 0.07 });
  }
  const streaks = [];
  const reach = Math.hypot(width, height) / 2;
  for (let i = 0; i < 90; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = reach * (0.3 + Math.random() * 0.7);
    streaks.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 1.2 + Math.random() * 7 });
  }
  return { frames, streaks };
}

/**
 * Plays the transition. `onSwap` is called once, mid-dive, to mount the real
 * destination screen underneath; it may return that screen's element, which
 * then gets an "emerge" animation as the overlay fades away.
 */
export function playIntroTransition({ onSwap }) {
  // Still plays under reduced motion — it's short and the player triggers it —
  // but without the camera shake and shard tremble.
  const calm = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-transition';
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00e5ff';
  const shards = buildShards(width, height);
  const { frames, streaks } = buildTunnel(width, height);
  const centreX = width / 2;
  const centreY = height / 2;

  let camZ = 0;
  let shakeX = 0;
  let shakeY = 0;

  const project = (x, y, z) => {
    const depth = z - camZ;
    if (depth <= NEAR) return null;
    const scale = 1 / depth;
    return [centreX + (x - shakeX) * scale, centreY + (y - shakeY) * scale, scale, depth];
  };

  function drawBackdrop(t) {
    ctx.fillStyle = '#04060b';
    ctx.fillRect(0, 0, width, height);
    // A soft glow down the tunnel that swells as the camera gets closer to the far end.
    const glow = clamp01((t - 0.3) / 0.9);
    if (glow > 0) {
      const gradient = ctx.createRadialGradient(centreX, centreY, 0, centreX, centreY, Math.max(width, height) * 0.6);
      gradient.addColorStop(0, accent);
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.28 * glow;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
  }

  function drawTunnel() {
    ctx.strokeStyle = accent;
    for (const frame of [...frames].sort((a, b) => b.z - a.z)) {
      const depth = frame.z - camZ;
      if (depth <= NEAR) continue;
      const fade = clamp01((depth - NEAR) / 0.5) * clamp01(1 - (depth - 0.4) / 5.5);
      if (fade <= 0) continue;
      const hw = width * 0.46;
      const hh = height * 0.46;
      const cos = Math.cos(frame.twist);
      const sin = Math.sin(frame.twist);
      const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) =>
        project(x * cos - y * sin, x * sin + y * cos, frame.z),
      );
      if (corners.some((p) => !p)) continue;
      ctx.globalAlpha = 0.75 * fade;
      ctx.lineWidth = Math.min(6, 1.4 * corners[0][2]);
      ctx.beginPath();
      corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    }

    ctx.lineCap = 'round';
    for (const streak of streaks) {
      const head = project(streak.x, streak.y, streak.z);
      const tail = project(streak.x, streak.y, streak.z + 0.5);
      if (!head || !tail) continue;
      ctx.globalAlpha = 0.6 * clamp01(1 - (head[3] - 0.3) / 6);
      ctx.lineWidth = Math.min(3, 1.2 * head[2]);
      ctx.beginPath();
      ctx.moveTo(tail[0], tail[1]);
      ctx.lineTo(head[0], head[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawShards(t) {
    const placed = [];
    for (const shard of shards) {
      const age = Math.max(0, t - shard.delay);
      // Shards don't all release at once: each one trembles in place until its turn.
      const tremble = !calm && age === 0 && t > 0.08 ? (Math.random() - 0.5) * 2 : 0;
      const z = 1 + shard.vz * age;
      const x = shard.cx + shard.vx * age * age * 1.4 + tremble;
      const y = shard.cy + shard.vy * age * age * 1.4 + 260 * age * age + tremble;
      const angle = shard.spin * age * age * 1.2;
      const verts = shard.local.map((v) => rotate(v, shard.axis, angle));
      const normal = rotate([0, 0, 1], shard.axis, angle);
      const points = verts.map(([vx, vy, vz]) => project(x + vx, y + vy, z + vz / Math.max(width, height)));
      if (points.some((p) => !p)) continue;
      placed.push({ shard, points, depth: z - camZ, facing: Math.abs(normal[2]), age });
    }

    placed.sort((a, b) => b.depth - a.depth);
    for (const { shard, points, depth, facing, age } of placed) {
      // Same top-to-bottom gradient as the DOM intro (#0b1220 → #04060b),
      // lit by how squarely the shard faces the camera and brightening as it
      // flies closer, so its tumble reads as depth rather than a flat cut-out.
      const nearness = clamp01(1 - depth);
      const light = (0.45 + 0.55 * facing) * (1 + nearness * 2.2);
      const r = Math.round(lerp(11, 4, shard.shade) * light);
      const g = Math.round(lerp(18, 6, shard.shade) * light);
      const b = Math.round(lerp(32, 11, shard.shade) * light);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
      if (age === 0) {
        // Hide the hairline seams between shards that haven't released yet.
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = (0.5 + 0.4 * nearness) * (1 - facing * 0.5) * clamp01(1 - age * 1.1);
        ctx.lineWidth = 1 + nearness * 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawCrack(t) {
    const strength = t < 0.14 ? t / 0.14 : clamp01(1 - (t - 0.14) / 0.2);
    if (strength <= 0) return;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18 * strength;
    const toScreen = ([px, py]) =>
      project((px / 100) * width - centreX, (py / 100) * height - centreY, 1) ?? [0, 0];
    for (const [line, weight] of [[SPINE, 1], ...BRANCHES.map((b) => [b, 0.55])]) {
      ctx.globalAlpha = strength * weight;
      ctx.lineWidth = (1.5 + 3.5 * strength) * weight;
      ctx.beginPath();
      line.map(toScreen).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();
  }

  let destination = null;
  let swapped = false;
  const startedAt = performance.now();

  function frame(now) {
    const t = (now - startedAt) / 1000;

    // The camera leans in, accelerates down the tunnel, and eases off as it arrives.
    camZ = 0.06 * easeOutCubic(clamp01(t / 0.18)) + 7 * easeInOutCubic(clamp01((t - 0.22) / (END_AT - 0.22)));
    const shake = calm ? 0 : clamp01(1 - Math.abs(t - 0.18) / 0.16) * 6;
    shakeX = (Math.random() - 0.5) * shake;
    shakeY = (Math.random() - 0.5) * shake;

    ctx.clearRect(0, 0, width, height);
    // Until the surface releases, the DOM intro underneath still shows (its
    // title fading out) and only the crack is drawn over it.
    if (t >= 0.12) {
      drawBackdrop(t);
      drawTunnel();
      drawShards(t);
    }
    drawCrack(t);

    if (!swapped && t >= SWAP_AT) {
      swapped = true;
      destination = onSwap() ?? null;
      destination?.classList.add('screen-emerge');
    }
    if (t >= SWAP_AT) canvas.style.opacity = String(1 - clamp01((t - SWAP_AT) / (END_AT - SWAP_AT)));

    if (t < END_AT) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
      destination?.classList.remove('screen-emerge');
    }
  }

  requestAnimationFrame(frame);
}
