import { describe, it, expect } from 'vitest';
import { authorColor, authorInitial } from '../src/ui/authorColor.js';

describe('authorColor', () => {
  it('is deterministic for the same name', () => {
    expect(authorColor('Alex')).toBe(authorColor('Alex'));
  });

  it('differs for different names (not guaranteed, but true for this set)', () => {
    const colors = new Set(['Alex', 'Sam', 'Lou', 'Noa'].map(authorColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('tolerates missing/empty input', () => {
    expect(() => authorColor(undefined)).not.toThrow();
    expect(() => authorColor('')).not.toThrow();
  });
});

describe('authorInitial', () => {
  it('uppercases the first letter', () => {
    expect(authorInitial('alex')).toBe('A');
  });

  it('falls back to a placeholder for empty input', () => {
    expect(authorInitial('')).toBe('?');
    expect(authorInitial(undefined)).toBe('?');
  });
});
