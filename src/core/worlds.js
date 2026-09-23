import { parseCompact } from './level.js';
import campaign from './campaign.json';

/**
 * Built-in campaign: 5 sectors of 10 levels, held as data in `campaign.json`
 * so the calibration script can reorder and re-par them without touching code.
 *
 * Levels use the compact single-grid notation:
 *   # wall   . floor   * charge plate   @ drone   $ container
 *   o pit    ~ fragile plate            _ grease (slides)
 *   ^ > v <  conveyor belts             a / b teleporter pair
 *   s switch g gate
 *
 * `npm run calibrate -- --write` solves every level, orders each sector from
 * easiest to hardest by optimal solution length, and derives `par` from it.
 */

export const BUILTIN_WORLDS = campaign.map((world) => ({
  id: world.id,
  accent: world.accent,
  builtin: true,
  levels: world.levels.map((def, index) =>
    parseCompact(def.rows, { id: `${world.id}-${index + 1}`, par: def.par }),
  ),
}));

export function findWorld(worlds, id) {
  return worlds.find((w) => w.id === id) ?? null;
}
