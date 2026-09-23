/**
 * Collects everything that is ready to hand out into `downloads/`.
 * Run with: npm run package
 *
 * The single-file build is always produced; native installers are copied only
 * if they have been built on this machine (they can only be compiled on the
 * system they target).
 */
import { mkdirSync, copyFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'downloads');
const bundles = join(root, 'src-tauri', 'target');

const INSTALLER_EXTENSIONS = new Set(['.dmg', '.appimage', '.deb', '.msi', '.exe']);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const collected = [];

const single = join(root, 'dist-single', 'index.html');
if (existsSync(single)) {
  const target = join(out, 'KINETIK.html');
  copyFileSync(single, target);
  collected.push(target);
} else {
  console.warn('dist-single/index.html missing — run `npm run build:single` first.');
}

function walk(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path);
    else if (INSTALLER_EXTENSIONS.has(extname(entry).toLowerCase())) {
      const target = join(out, basename(entry));
      if (!existsSync(target)) {
        copyFileSync(path, target);
        collected.push(target);
      }
    }
  }
}
walk(bundles);

if (!collected.length) {
  console.log('Nothing to package.');
} else {
  console.log(`downloads/ (${collected.length} file${collected.length > 1 ? 's' : ''}):`);
  for (const file of collected) {
    console.log(`  ${basename(file)}  ${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
  }
}
