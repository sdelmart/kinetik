import { describe, it, expect } from 'vitest';
import { shouldRenderFrame } from '../src/render/renderer.js';
import { FPS_OPTIONS, normalizeSettings, DEFAULT_SETTINGS } from '../src/state/settings.js';

describe('frame pacing', () => {
  it('never gates the first frame', () => {
    expect(shouldRenderFrame(1000, 0, 60)).toBe(true);
  });

  it('draws every frame when uncapped', () => {
    expect(shouldRenderFrame(1000, 999.9, 0)).toBe(true);
  });

  it('skips frames that arrive inside the budget', () => {
    // At 30 fps the budget is ~33ms.
    expect(shouldRenderFrame(1020, 1000, 30)).toBe(false);
    expect(shouldRenderFrame(1033, 1000, 30)).toBe(true);
  });

  it('does not halve a 60 Hz display over a fraction of a millisecond', () => {
    // 60 Hz frames land ~16.67ms apart; a strict 16.67 budget would drop half.
    expect(shouldRenderFrame(1016.6, 1000, 60)).toBe(true);
  });

  it('lets a 120 cap pass 60 Hz frames through untouched', () => {
    expect(shouldRenderFrame(1016.6, 1000, 120)).toBe(true);
  });

  it('treats a broken cap as uncapped', () => {
    expect(shouldRenderFrame(1001, 1000, Number.NaN)).toBe(true);
    expect(shouldRenderFrame(1001, 1000, -5)).toBe(true);
  });
});

describe('fps setting', () => {
  it('offers the advertised caps', () => {
    expect(FPS_OPTIONS).toEqual([30, 60, 120, 0]);
  });

  it('defaults to 60', () => {
    expect(DEFAULT_SETTINGS.fpsCap).toBe(60);
  });

  it('keeps a stored cap', () => {
    expect(normalizeSettings({ fpsCap: 120 }).fpsCap).toBe(120);
  });

  it('falls back when the stored cap is nonsense', () => {
    expect(normalizeSettings({ fpsCap: 'fast' }).fpsCap).toBe(60);
    expect(normalizeSettings({ fpsCap: 999 }).fpsCap).toBe(60);
  });
});
