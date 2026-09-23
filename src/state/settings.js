import { read, write } from './storage.js';
import { MUSIC_TRACKS } from '../audio/music.js';
import { BACKGROUND_IDS } from '../render/background.js';
import { LANGUAGES } from '../i18n/index.js';
import { isValidHex } from '../core/color.js';

/** Curated so every combination stays readable against the dark UI. */
export const ACCENT_PRESETS = [
  { id: 'cyan', color: '#00e5ff' },
  { id: 'magenta', color: '#ff2d95' },
  { id: 'amber', color: '#ffb300' },
  { id: 'green', color: '#54e08a' },
  { id: 'violet', color: '#a855f7' },
  { id: 'red', color: '#ff4d6d' },
];

export const DEFAULT_SETTINGS = {
  keys: {
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    undo: ['KeyZ'],
    redo: ['KeyY'],
    restart: ['KeyR'],
    back: ['Escape'],
  },
  musicVolume: 55,
  sfxVolume: 70,
  musicTrack: 'pulse',
  muted: false,
  language: 'fr',
  accentColor: ACCENT_PRESETS[0].color,
  background: 'grid',
  fpsCap: 60,
  showFps: false,
  colorblindMode: false,
  glow: true,
  scanlines: true,
  showGrid: true,
};

/** 0 means "no cap": render as fast as the display refreshes. */
export const FPS_OPTIONS = [30, 60, 120, 0];

export const ACTIONS = ['up', 'down', 'left', 'right', 'undo', 'redo', 'restart', 'back'];

function clampVolume(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback;
}

/** Unknown or corrupt fields fall back to defaults rather than breaking the game. */
export function normalizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const keys = {};
  for (const action of ACTIONS) {
    const bound = input.keys?.[action];
    const list = Array.isArray(bound) ? bound.filter((k) => typeof k === 'string' && k) : [];
    keys[action] = list.length ? list : [...DEFAULT_SETTINGS.keys[action]];
  }

  return {
    keys,
    musicVolume: clampVolume(input.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: clampVolume(input.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    musicTrack: MUSIC_TRACKS.some((t) => t.id === input.musicTrack)
      ? input.musicTrack
      : DEFAULT_SETTINGS.musicTrack,
    muted: Boolean(input.muted),
    language: LANGUAGES.includes(input.language) ? input.language : detectLanguage(),
    accentColor: isValidHex(input.accentColor) ? input.accentColor : DEFAULT_SETTINGS.accentColor,
    background: BACKGROUND_IDS.includes(input.background)
      ? input.background
      : DEFAULT_SETTINGS.background,
    fpsCap: FPS_OPTIONS.includes(input.fpsCap) ? input.fpsCap : DEFAULT_SETTINGS.fpsCap,
    showFps: Boolean(input.showFps),
    colorblindMode: Boolean(input.colorblindMode),
    glow: input.glow !== false,
    scanlines: input.scanlines !== false,
    showGrid: input.showGrid !== false,
  };
}

function detectLanguage() {
  const nav = typeof navigator !== 'undefined' ? navigator.language ?? '' : '';
  const code = nav.slice(0, 2).toLowerCase();
  return LANGUAGES.includes(code) ? code : DEFAULT_SETTINGS.language;
}

export function loadSettings(key = 'settings') {
  return normalizeSettings(read(key, null));
}

export function saveSettings(settings, key = 'settings') {
  write(key, settings);
}

/**
 * Bindings are stored as physical key codes so they survive layout changes.
 * Some virtual and remote keyboards leave `code` empty, so we fall back to
 * `key` only in that case — using both at once would let one press match two
 * actions on non-QWERTY layouts.
 */
function bindingMatches(binding, event) {
  if (event.code) return binding === event.code;
  if (!event.key) return false;
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return binding === key || binding === `Key${key}` || binding === `Digit${key}`;
}

export function actionForKey(settings, event) {
  for (const action of ACTIONS) {
    if (settings.keys[action].some((binding) => bindingMatches(binding, event))) return action;
  }
  return null;
}

export function keyLabel(code) {
  if (!code) return '—';
  return code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Arrow/, '')
    .replace(/^Numpad/, 'Num ');
}
