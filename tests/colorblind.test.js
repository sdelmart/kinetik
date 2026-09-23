import { describe, it, expect } from 'vitest';
import { positiveColor } from '../src/render/sprites.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/state/settings.js';

describe('positiveColor', () => {
  it('uses green normally', () => {
    expect(positiveColor(false)).toBe('#54e08a');
  });

  it('switches to blue in colourblind mode', () => {
    expect(positiveColor(true)).toBe('#4aa3ff');
  });

  it('never returns the same colour for both modes', () => {
    expect(positiveColor(true)).not.toBe(positiveColor(false));
  });
});

describe('colorblindMode setting', () => {
  it('defaults to off', () => {
    expect(DEFAULT_SETTINGS.colorblindMode).toBe(false);
  });

  it('keeps a stored true value', () => {
    expect(normalizeSettings({ colorblindMode: true }).colorblindMode).toBe(true);
  });

  it('coerces a non-boolean stored value instead of crashing', () => {
    expect(normalizeSettings({ colorblindMode: 'yes' }).colorblindMode).toBe(true);
    expect(normalizeSettings({ colorblindMode: null }).colorblindMode).toBe(false);
  });
});
