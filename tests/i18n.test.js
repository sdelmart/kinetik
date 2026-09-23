import { describe, it, expect } from 'vitest';
import { CATALOGS, LANGUAGES, t, setLanguage } from '../src/i18n/index.js';

const reference = Object.keys(CATALOGS.fr).sort();

describe('translations', () => {
  it('ships every advertised language', () => {
    expect(LANGUAGES).toEqual(['fr', 'en', 'es', 'de']);
  });

  it.each(LANGUAGES)('%s has exactly the reference key set', (code) => {
    expect(Object.keys(CATALOGS[code]).sort()).toEqual(reference);
  });

  it.each(LANGUAGES)('%s has no empty string', (code) => {
    for (const [key, value] of Object.entries(CATALOGS[code])) {
      expect(typeof value, key).toBe('string');
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('falls back to the key when a string is missing', () => {
    setLanguage('fr');
    expect(t('definitely_missing_key')).toBe('definitely_missing_key');
  });

  it('fills placeholders', () => {
    setLanguage('fr');
    expect(t('{a} / {b}', { a: 1, b: 2 })).toBe('1 / 2');
  });

  it('names every music track and background in every language', async () => {
    const { MUSIC_TRACKS } = await import('../src/audio/music.js');
    const { BACKGROUND_IDS } = await import('../src/render/background.js');
    for (const lang of LANGUAGES) {
      for (const track of MUSIC_TRACKS) {
        expect(CATALOGS[lang][`track.${track.id}`], `${lang}/track.${track.id}`).toBeTruthy();
      }
      for (const id of BACKGROUND_IDS) {
        expect(CATALOGS[lang][`bg.${id}`], `${lang}/bg.${id}`).toBeTruthy();
      }
    }
  });

  it('names and describes every achievement in every language', async () => {
    const { ACHIEVEMENTS } = await import('../src/core/achievements.js');
    for (const lang of LANGUAGES) {
      for (const achievement of ACHIEVEMENTS) {
        expect(CATALOGS[lang][`achievement.${achievement.id}.name`], `${lang}/${achievement.id}`).toBeTruthy();
        expect(CATALOGS[lang][`achievement.${achievement.id}.desc`], `${lang}/${achievement.id}`).toBeTruthy();
      }
    }
  });

  it('covers every level validation error code', () => {
    const codes = [
      'invalid_shape', 'invalid_format', 'layer_mismatch', 'too_small', 'too_large',
      'ragged_rows', 'unknown_tile', 'entity_in_wall', 'no_player', 'many_players',
      'no_target', 'not_enough_crates', 'teleporter_duplicate', 'teleporter_unpaired',
      'gate_without_switch', 'switch_without_gate', 'invalid_par',
    ];
    for (const code of codes) {
      for (const lang of LANGUAGES) {
        expect(CATALOGS[lang][`error.${code}`], `${lang}/${code}`).toBeTruthy();
      }
    }
  });
});
