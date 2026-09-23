import { describe, it, expect } from 'vitest';
import { isValidHex, hexToRgb } from '../src/core/color.js';
import { ACCENT_PRESETS, DEFAULT_SETTINGS, normalizeSettings } from '../src/state/settings.js';

describe('isValidHex', () => {
  it('accepts a 6-digit hex colour', () => {
    expect(isValidHex('#00e5ff')).toBe(true);
    expect(isValidHex('#FFFFFF')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidHex('00e5ff')).toBe(false); // missing #
    expect(isValidHex('#0ef')).toBe(false); // shorthand not supported
    expect(isValidHex('#gggggg')).toBe(false); // not hex digits
    expect(isValidHex('red')).toBe(false); // named colour
    expect(isValidHex('')).toBe(false);
    expect(isValidHex(undefined)).toBe(false);
    expect(isValidHex('#00e5ff; background: url(evil)')).toBe(false); // css injection attempt
  });
});

describe('hexToRgb', () => {
  it('converts a hex colour to comma-separated rgb', () => {
    expect(hexToRgb('#00e5ff')).toBe('0, 229, 255');
    expect(hexToRgb('#ffffff')).toBe('255, 255, 255');
  });

  it('accepts a hex string without the leading #', () => {
    expect(hexToRgb('ff2d95')).toBe('255, 45, 149');
  });

  it('returns null for an invalid input', () => {
    expect(hexToRgb('not-a-colour')).toBeNull();
    expect(hexToRgb(undefined)).toBeNull();
  });
});

describe('accent colour setting', () => {
  it('ships at least one preset and defaults to the first', () => {
    expect(ACCENT_PRESETS.length).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.accentColor).toBe(ACCENT_PRESETS[0].color);
  });

  it('has a unique id per preset', () => {
    const ids = ACCENT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps a valid custom colour from storage', () => {
    expect(normalizeSettings({ accentColor: '#a855f7' }).accentColor).toBe('#a855f7');
  });

  it('falls back to the default when the stored value is not a real colour', () => {
    expect(normalizeSettings({ accentColor: 'javascript:alert(1)' }).accentColor).toBe(
      DEFAULT_SETTINGS.accentColor,
    );
    expect(normalizeSettings({ accentColor: null }).accentColor).toBe(DEFAULT_SETTINGS.accentColor);
  });
});
