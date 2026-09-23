/**
 * Validates the daily-challenge pool and recomputes its par values.
 *   npm run calibrate:daily            report only
 *   npm run calibrate:daily -- --write rewrite daily.json with derived pars
 *
 * Order doesn't matter here (a level is picked by date, not progression), so
 * unlike the campaign this never reorders — it only checks solvability and
 * pars.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCompact, validateLevel } from '../src/core/level.js';
import { solve } from '../src/core/solver.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, '../src/core/daily.json');
const write = process.argv.includes('--write');

const parFor = (optimal) => Math.max(3, Math.ceil(optimal * 1.15) + 1);

const levels = JSON.parse(readFileSync(dataPath, 'utf8'));
let failures = 0;
const rewritten = [];

for (const [index, def] of levels.entries()) {
  const level = parseCompact(def.rows, { par: def.par });
  const check = validateLevel(level);
  if (!check.ok) {
    console.log(`${index + 1}. INVALID (${check.code})`);
    failures++;
    rewritten.push(def);
    continue;
  }

  const started = Date.now();
  const { solved, moves, explored } = solve(level);
  const ms = Date.now() - started;

  if (!solved) {
    console.log(`${index + 1}. UNSOLVABLE (explored ${explored} states, ${ms}ms)`);
    failures++;
    rewritten.push(def);
    continue;
  }

  const optimal = moves.length;
  const par = parFor(optimal);
  const flag = def.par === par ? '' : `  par ${def.par} -> ${par}`;
  console.log(`${index + 1}. optimal ${String(optimal).padStart(3)} moves (${explored} states, ${ms}ms)${flag}`);
  rewritten.push({ par, rows: def.rows });
}

if (write) {
  if (failures) {
    console.log('\nRefusing to rewrite daily.json while levels are failing.');
  } else {
    writeFileSync(dataPath, `${JSON.stringify(rewritten, null, 2)}\n`);
    console.log('\ndaily.json rewritten with derived pars.');
  }
}

console.log(failures ? `\n${failures} level(s) need attention.` : '\nAll daily levels solvable.');
process.exit(failures ? 1 : 0);
