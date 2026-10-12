/**
 * Checks the Daily Challenge pool against the current rules engine.
 *
 *   npm run calibrate:daily
 *
 * Each level in daily.json carries the optimal solution found by
 * `node scripts/generate-campaign.js --daily=34 --write`; this replays it and
 * checks par leaves room for it. To produce a new pool, run the generator.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCompact, validateLevel } from '../src/core/level.js';
import { replay } from '../src/core/solver.js';

const here = dirname(fileURLToPath(import.meta.url));
const levels = JSON.parse(readFileSync(resolve(here, '../src/core/daily.json'), 'utf8'));
const DIRS = { u: 'up', r: 'right', d: 'down', l: 'left' };

let failures = 0;
for (const [index, def] of levels.entries()) {
  const level = parseCompact(def.rows, { par: def.par });
  const check = validateLevel(level);
  const moves = [...(def.solution ?? '')].map((c) => DIRS[c]);
  const solved = check.ok && moves.length > 0 && replay(level, moves).solved;
  const parOk = def.par >= moves.length;
  if (!solved || !parOk) failures++;
  console.log(
    `${String(index + 1).padStart(2)}. ${solved ? 'ok ' : 'FAIL'} ${(def.sector ?? '?').padEnd(9)} ${String(moves.length).padStart(3)} moves, par ${def.par}` +
      `${check.ok ? '' : ` (invalid: ${check.code})`}${parOk ? '' : ' (par below solution)'}`,
  );
}

console.log(failures ? `\n${failures} level(s) need attention.` : '\nAll daily levels verified.');
process.exit(failures ? 1 : 0);
