import { parseCompact } from './level.js';
import campaign from './campaign.json';

/**
 * Built-in campaign: 8 sectors of 10 levels, held as data in `campaign.json`.
 * The levels are produced by `scripts/generate-campaign.js`, which also stores
 * each level's optimal solution (used by tests and instant hints) and a
 * difficulty score that orders each sector.
 *
 * Levels use the compact single-grid notation:
 *   # wall   . floor   * charge plate   @ drone   $ container
 *   o pit    ~ fragile plate            _ grease (slides)
 *   ^ > v <  conveyor belts             a / b teleporter pair
 *   s switch g gate
 *
 * `npm run calibrate` replays every stored solution to check it still works.
 */

/** Stored solutions use one letter per move. */
const SOLUTION_DIRS = { u: 'up', r: 'right', d: 'down', l: 'left' };

export const BUILTIN_WORLDS = campaign.map((world) => ({
  id: world.id,
  accent: world.accent,
  builtin: true,
  // "v2": the regenerated campaign gets fresh ids, so progress and scores
  // recorded on the old, much easier levels don't carry over to new ones.
  levels: world.levels.map((def, index) => ({
    ...parseCompact(def.rows, { id: `${world.id}-v2-${index + 1}`, par: def.par }),
    solution: def.solution ? [...def.solution].map((c) => SOLUTION_DIRS[c]) : null,
  })),
}));

export function findWorld(worlds, id) {
  return worlds.find((w) => w.id === id) ?? null;
}
