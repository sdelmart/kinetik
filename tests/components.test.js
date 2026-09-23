import { describe, it, expect } from 'vitest';
import { applyInlineStyle } from '../src/ui/components.js';

/**
 * A minimal stand-in for CSSStyleDeclaration: plain properties are settable
 * fields, custom properties (--foo) only take effect through setProperty(),
 * exactly like the real thing — which is the distinction this regression is
 * about.
 */
class FakeStyle {
  constructor() {
    this.custom = new Map();
  }
  setProperty(name, value) {
    this.custom.set(name, value);
  }
}

describe('applyInlineStyle', () => {
  it('sets plain CSS properties by direct assignment', () => {
    const style = new FakeStyle();
    applyInlineStyle(style, { color: 'red', display: 'flex' });
    expect(style.color).toBe('red');
    expect(style.display).toBe('flex');
  });

  it('routes custom properties through setProperty, not direct assignment', () => {
    // Regression: world/level cards and the accent swatches used to set
    // `--card-accent` / `--swatch-color` via plain assignment, which
    // CSSStyleDeclaration silently ignores for custom properties — every
    // sector card ended up the same colour instead of its own.
    const style = new FakeStyle();
    applyInlineStyle(style, { '--card-accent': '#ff2d95' });
    expect(style.custom.get('--card-accent')).toBe('#ff2d95');
    expect(style['--card-accent']).toBeUndefined();
  });

  it('handles a mix of plain and custom properties in one call', () => {
    const style = new FakeStyle();
    applyInlineStyle(style, { color: 'red', '--swatch-color': '#00e5ff' });
    expect(style.color).toBe('red');
    expect(style.custom.get('--swatch-color')).toBe('#00e5ff');
  });
});
