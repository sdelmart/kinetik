import { describe, it, expect } from 'vitest';
import { parseCompact } from '../src/core/level.js';
import { legendEntriesForLevel, LEGEND_ENTRIES } from '../src/ui/legend.js';

describe('legendEntriesForLevel', () => {
  it('reports nothing for a plain level', () => {
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 5 });
    expect(legendEntriesForLevel(level)).toEqual([]);
  });

  it('detects a pit', () => {
    const level = parseCompact(['######', '#@$o*#', '#....#', '######'], { par: 5 });
    const ids = legendEntriesForLevel(level).map((e) => e.id);
    expect(ids).toEqual(['pit']);
  });

  it('collapses all four conveyor directions into one entry', () => {
    const level = parseCompact(['########', '#@$^v<>#', '#......#', '########'], { par: 5 });
    const ids = legendEntriesForLevel(level).map((e) => e.id);
    expect(ids).toEqual(['conveyor']);
  });

  it('reports gate for either a switch or a gate tile alone', () => {
    const level = parseCompact(['######', '#@$.g#', '#....#', '######'], { par: 5 });
    expect(legendEntriesForLevel(level).map((e) => e.id)).toContain('gate');
  });

  it('detects twin crates from the entity layer, not the terrain', () => {
    const level = parseCompact(['########', '#.1.@.2#', '#......#', '########'], { par: 5 });
    expect(legendEntriesForLevel(level).map((e) => e.id)).toContain('twin');
  });

  it('detects the key/lock pair', () => {
    const level = parseCompact(['########', '#.@\$k.q#', '#......#', '########'], { par: 5 });
    expect(legendEntriesForLevel(level).map((e) => e.id)).toContain('keygate');
  });

  it('never returns duplicate entries for a level using every mechanic', () => {
    const ids = LEGEND_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
