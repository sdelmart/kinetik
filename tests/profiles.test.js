import { describe, it, expect } from 'vitest';
import {
  createProfile,
  renameProfile,
  deleteProfile,
  profileKey,
  MAX_PROFILES,
} from '../src/state/profiles.js';
import { read, write } from '../src/state/storage.js';

describe('profiles', () => {
  it('creates a profile with a name and a stable id', () => {
    const { profile } = createProfile([], 'Scott');
    expect(profile.name).toBe('Scott');
    expect(profile.id).toBeTruthy();
  });

  it('falls back to a default name when given an empty one', () => {
    const { profile } = createProfile([], '   ');
    expect(profile.name).toBe('Joueur');
  });

  it('truncates names over the length limit', () => {
    const { profile } = createProfile([], 'x'.repeat(50));
    expect(profile.name.length).toBeLessThanOrEqual(18);
  });

  it('renames only the targeted profile', () => {
    const { profiles: withA } = createProfile([], 'A');
    const { profiles } = createProfile(withA, 'B');
    const [a, b] = profiles;
    const renamed = renameProfile(profiles, a.id, 'Renamed');
    expect(renamed.find((p) => p.id === a.id).name).toBe('Renamed');
    expect(renamed.find((p) => p.id === b.id).name).toBe('B');
  });

  it('ignores a rename to an empty name', () => {
    const { profiles, profile } = createProfile([], 'Keep me');
    const renamed = renameProfile(profiles, profile.id, '   ');
    expect(renamed.find((p) => p.id === profile.id).name).toBe('Keep me');
  });

  describe('deleteProfile', () => {
    it('removes the profile from the list', () => {
      const { profiles, profile } = createProfile([], 'Gone');
      expect(deleteProfile(profiles, profile.id)).toEqual([]);
    });

    it('wipes every namespaced key the profile owns, including achievements', () => {
      const { profile } = createProfile([], 'Scott');
      const keys = ['save', 'settings', 'worlds', 'hints', 'achievements'];
      for (const key of keys) write(profileKey(profile.id, key), { seeded: true });

      deleteProfile([profile], profile.id);

      for (const key of keys) {
        expect(read(profileKey(profile.id, key), 'gone')).toBe('gone');
      }
    });

    it('does not touch another profile sharing the same namespace prefix', () => {
      const { profiles: withA, profile: a } = createProfile([], 'A');
      const { profile: b } = createProfile(withA, 'B');
      write(profileKey(b.id, 'achievements'), ['stars_gold']);

      deleteProfile([a, b], a.id);

      expect(read(profileKey(b.id, 'achievements'), null)).toEqual(['stars_gold']);
    });
  });

  it('caps the maximum useful profile count as a documented constant', () => {
    expect(MAX_PROFILES).toBeGreaterThan(0);
  });
});
