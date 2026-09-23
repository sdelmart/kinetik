/**
 * Writes src-tauri/icons/icon.png without any image dependency: the app icon
 * is drawn with plain pixel maths and encoded with Node's built-in zlib.
 * Run with: npm run icon
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 512;
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src-tauri/icons/icon.png');

const BG = [10, 14, 26, 255];
const CYAN = [0, 229, 255, 255];
const MAGENTA = [255, 45, 149, 255];

const pixels = new Uint8Array(SIZE * SIZE * 4);

const put = (x, y, [r, g, b, a]) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  // simple source-over so overlapping shapes blend rather than clip
  const alpha = a / 255;
  pixels[i] = pixels[i] * (1 - alpha) + r * alpha;
  pixels[i + 1] = pixels[i + 1] * (1 - alpha) + g * alpha;
  pixels[i + 2] = pixels[i + 2] * (1 - alpha) + b * alpha;
  pixels[i + 3] = 255;
};

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) put(x, y, BG);
}

function strokeRect(x0, y0, x1, y1, width, colour) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const edge =
        x - x0 < width || x1 - x < width || y - y0 < width || y1 - y < width;
      if (edge) put(x, y, colour);
    }
  }
}

function chevron(cx, cy, size, width, colour) {
  for (let t = -size; t <= size; t++) {
    const dx = size - Math.abs(t);
    for (let w = 0; w < width; w++) {
      put(cx + dx + w, cy + t, colour);
    }
  }
}

// container outline
strokeRect(96, 128, 416, 384, 16, CYAN);
// the three belt chevrons, fading towards magenta
chevron(180, 256, 56, 18, CYAN);
chevron(256, 256, 56, 18, CYAN);
chevron(332, 256, 56, 18, MAGENTA);

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

let table = null;
function crc32(buffer) {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return crc ^ -1;
}

// PNG scanlines are prefixed with a filter byte (0 = none).
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  Buffer.from(pixels.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`wrote ${out} (${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} KiB)`);
