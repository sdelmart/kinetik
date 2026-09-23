/**
 * Writes the app icons without any image dependency: drawn with plain pixel
 * maths and encoded with Node's built-in zlib.
 *   src-tauri/icons/icon.png  512x512, used for Linux/macOS bundling
 *   src-tauri/icons/icon.ico  256x256, required by tauri-build on Windows to
 *                             embed the .exe's resource icon
 * Run with: npm run icon
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, '../src-tauri/icons');

const BG = [10, 14, 26, 255];
const CYAN = [0, 229, 255, 255];
const MAGENTA = [255, 45, 149, 255];

function renderPixels(size) {
  const pixels = new Uint8Array(size * size * 4);
  const scale = size / 512;

  const put = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    // simple source-over so overlapping shapes blend rather than clip
    const alpha = a / 255;
    pixels[i] = pixels[i] * (1 - alpha) + r * alpha;
    pixels[i + 1] = pixels[i + 1] * (1 - alpha) + g * alpha;
    pixels[i + 2] = pixels[i + 2] * (1 - alpha) + b * alpha;
    pixels[i + 3] = 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) put(x, y, BG);
  }

  function strokeRect(x0, y0, x1, y1, width, colour) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const edge = x - x0 < width || x1 - x < width || y - y0 < width || y1 - y < width;
        if (edge) put(x, y, colour);
      }
    }
  }

  function chevron(cx, cy, chevronSize, width, colour) {
    for (let t = -chevronSize; t <= chevronSize; t++) {
      const dx = chevronSize - Math.abs(t);
      for (let w = 0; w < width; w++) put(cx + dx + w, cy + t, colour);
    }
  }

  const s = (v) => Math.round(v * scale);
  strokeRect(s(96), s(128), s(416), s(384), Math.max(1, s(16)), CYAN);
  chevron(s(180), s(256), s(56), Math.max(1, s(18)), CYAN);
  chevron(s(256), s(256), s(56), Math.max(1, s(18)), CYAN);
  chevron(s(332), s(256), s(56), Math.max(1, s(18)), MAGENTA);

  return pixels;
}

let crcTable = null;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return crc ^ -1;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

/** Encodes a size x size RGBA buffer as a PNG. */
function encodePng(pixels, size) {
  // PNG scanlines are prefixed with a filter byte (0 = none).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Wraps a single PNG image in an ICO container. Modern Windows (Vista+)
 * accepts a PNG-compressed entry directly, which is the same trick browsers'
 * favicons use for anything above 64x64 — no BMP/DIB encoding needed.
 */
function encodeIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // 0 means 256px, per the ICO spec
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0; // no palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // offset

  return Buffer.concat([header, entry, pngBuffer]);
}

mkdirSync(iconsDir, { recursive: true });

const png512 = encodePng(renderPixels(512), 512);
writeFileSync(resolve(iconsDir, 'icon.png'), png512);
console.log(`wrote icon.png (512x512, ${(png512.length / 1024).toFixed(1)} KiB)`);

const png256 = encodePng(renderPixels(256), 256);
const ico = encodeIco(png256, 256);
writeFileSync(resolve(iconsDir, 'icon.ico'), ico);
console.log(`wrote icon.ico (256x256, ${(ico.length / 1024).toFixed(1)} KiB)`);
