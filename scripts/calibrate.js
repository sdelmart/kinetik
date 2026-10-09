/**
 * Checks every built-in level against the current rules engine.
 *
 *   npm run calibrate
 *
 * Each level in campaign.json carries the optimal solution found by
 * scripts/generate-campaign.js. This replays it, so a rules change that
 * breaks a level is caught immediately — and reports levels whose par no
 * longer leaves room for that solution. To produce new levels, run the
 * generator instead (it also writes solutions, pars and difficulty).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCompact, validateLevel } from '../src/core/level.js';
import { replay } from '../src/core/solver.js';

const here = dirname(fileURLToPath(import.meta.url));
const campaign = JSON.parse(readFileSync(resolve(here, '../src/core/campaign.json'), 'utf8'));
const DIRS = { u: 'up', r: 'right', d: 'down', l: 'left' };

let failures = 0;
for (const world of campaign) {
  console.log(`\n=== ${world.id} ===`);
  for (const [index, def] of world.levels.entries()) {
    const level = parseCompact(def.rows, { par: def.par });
    const check = validateLevel(level);
    const moves = [...(def.solution ?? '')].map((c) => DIRS[c]);
    const solved = check.ok && moves.length > 0 && replay(level, moves).solved;
    const parOk = def.par >= moves.length;
    if (!solved || !parOk) failures++;
    console.log(
      `  ${index + 1}. ${solved ? 'ok ' : 'FAIL'} ${String(moves.length).padStart(3)} moves, par ${def.par}` +
        `, difficulty ${def.difficulty ?? '?'}${check.ok ? '' : ` (invalid: ${check.code})`}${parOk ? '' : ' (par below solution)'}`,
    );
  }
}

console.log(failures ? `\n${failures} level(s) need attention.` : '\nAll levels verified.');
process.exit(failures ? 1 : 0);
