/**
 * Solves every built-in level to check it can actually be finished.
 *
 *   npm run calibrate            report only
 *   npm run calibrate -- --write reorder each sector easiest-to-hardest and
 *                                rewrite campaign.json with derived pars
 *
 * Difficulty is the length of the shortest solution, which is objective and
 * reproducible — far better than guessing an ordering by eye.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCompact, validateLevel } from '../src/core/level.js';
import { solve } from '../src/core/solver.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, '../src/core/campaign.json');
const write = process.argv.includes('--write');

/** Leaves a little headroom over the optimal so par is demanding, not perfect. */
const parFor = (optimal) => Math.max(3, Math.ceil(optimal * 1.15) + 1);

const campaign = JSON.parse(readFileSync(dataPath, 'utf8'));
let failures = 0;

for (const world of campaign) {
  console.log(`\n=== ${world.id} ===`);
  const measured = [];

  for (const [index, def] of world.levels.entries()) {
    const level = parseCompact(def.rows, { par: def.par });
    const check = validateLevel(level);
    if (!check.ok) {
      console.log(`  ${index + 1}. INVALID (${check.code})`);
      failures++;
      measured.push({ def, optimal: Infinity });
      continue;
    }

    const started = Date.now();
    const { solved, moves, explored } = solve(level);
    const ms = Date.now() - started;

    if (!solved) {
      console.log(`  ${index + 1}. UNSOLVABLE (explored ${explored} states, ${ms}ms)`);
      failures++;
      measured.push({ def, optimal: Infinity });
      continue;
    }

    const optimal = moves.length;
    const flag = def.par === parFor(optimal) ? '' : `  par ${def.par} -> ${parFor(optimal)}`;
    console.log(
      `  ${index + 1}. optimal ${String(optimal).padStart(3)} moves ` +
        `(${explored} states, ${ms}ms)${flag}`,
    );
    measured.push({ def, optimal });
  }

  if (write && !failures) {
    measured.sort((a, b) => a.optimal - b.optimal);
    world.levels = measured.map(({ def, optimal }) => ({ par: parFor(optimal), rows: def.rows }));
    console.log(`  -> reordered: ${measured.map((m) => m.optimal).join(', ')}`);
  }
}

if (write) {
  if (failures) {
    console.log('\nRefusing to rewrite campaign.json while levels are failing.');
  } else {
    writeFileSync(dataPath, `${JSON.stringify(campaign, null, 2)}\n`);
    console.log('\ncampaign.json rewritten (sorted by difficulty, pars derived).');
  }
}

console.log(failures ? `\n${failures} level(s) need attention.` : '\nAll levels solvable.');
process.exit(failures ? 1 : 0);
