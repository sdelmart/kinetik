import { T, E, TERRAIN_GLYPHS, ENTITY_GLYPHS } from '../core/constants.js';
import { tileSwatch } from './components.js';
import { drawTile, drawCrate } from '../render/sprites.js';

/**
 * Every explainable mechanic, as the terrain tile it's rendered with (for the
 * swatch) and the set of tile codes that should match it in a level (a
 * conveyor or one-way tile has 4 directional codes, but they all explain the
 * same rule). `entity` marks a mechanic carried by what stands on a tile
 * rather than the tile itself — currently only the twin crates.
 */
export const LEGEND_ENTRIES = [
  { id: 'pit', sample: T.PIT, matches: [T.PIT, T.PIT_FILLED], key: 'legend.pit' },
  { id: 'fragile', sample: T.FRAGILE, matches: [T.FRAGILE, T.BROKEN], key: 'legend.fragile' },
  { id: 'ice', sample: T.ICE, matches: [T.ICE], key: 'legend.ice' },
  {
    id: 'conveyor',
    sample: T.CONV_RIGHT,
    matches: [T.CONV_UP, T.CONV_RIGHT, T.CONV_DOWN, T.CONV_LEFT],
    key: 'legend.conveyor',
  },
  { id: 'teleporter', sample: T.TELE_A, matches: [T.TELE_A, T.TELE_B], key: 'legend.teleporter' },
  { id: 'gate', sample: T.GATE, matches: [T.SWITCH, T.GATE], key: 'legend.gate' },
  {
    id: 'oneway',
    sample: T.ONEWAY_RIGHT,
    matches: [T.ONEWAY_UP, T.ONEWAY_RIGHT, T.ONEWAY_DOWN, T.ONEWAY_LEFT],
    key: 'legend.oneway',
  },
  {
    id: 'keygate',
    sample: T.GATE_KEY,
    matches: [T.KEYHOLE, T.KEYHOLE_USED, T.GATE_KEY],
    key: 'legend.keygate',
  },
  { id: 'twin', sample: T.FLOOR, entity: true, key: 'legend.twin' },
];

/** The subset of LEGEND_ENTRIES actually relevant to this level's board. */
export function legendEntriesForLevel(level) {
  const terrainCodes = new Set();
  for (const row of level.terrain) {
    for (const ch of row) terrainCodes.add(TERRAIN_GLYPHS[ch]);
  }
  let hasTwin = false;
  for (const row of level.entities) {
    for (const ch of row) {
      const code = ENTITY_GLYPHS[ch];
      if (code === E.CRATE_A || code === E.CRATE_B) hasTwin = true;
    }
  }

  return LEGEND_ENTRIES.filter((entry) => {
    if (entry.entity) return hasTwin;
    return entry.matches.some((code) => terrainCodes.has(code));
  });
}

/** A small canvas preview of an entry, shown in its default ("unsolved") state. */
export function legendSwatch(entry, settings) {
  const theme = {
    accent: '#00e5ff',
    glow: settings.glow,
    colorblind: settings.colorblindMode,
    time: 600,
    gateOpen: false,
    switchPressed: false,
    keyGateOpen: false,
  };
  if (entry.entity) {
    return tileSwatch((ctx, size) => {
      drawTile(ctx, T.FLOOR, 0, 0, size, theme);
      drawCrate(ctx, 0, 0, size, { lit: false, glow: settings.glow, accent: '#00e5ff', twin: 'a' });
    });
  }
  return tileSwatch((ctx, size) => drawTile(ctx, entry.sample, 0, 0, size, theme));
}
