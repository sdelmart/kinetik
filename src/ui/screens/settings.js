import { el, button, topbar, toast, confirmDialog } from '../components.js';
import { t, LANGUAGES, LANGUAGE_NAMES, setLanguage } from '../../i18n/index.js';
import {
  ACTIONS,
  keyLabel,
  DEFAULT_SETTINGS,
  normalizeSettings,
  FPS_OPTIONS,
} from '../../state/settings.js';
import { MUSIC_TRACKS, playTrack, stopMusic } from '../../audio/music.js';
import { BACKGROUNDS } from '../../render/background.js';
import { sfx } from '../../audio/sfx.js';

export function settingsScreen(app) {
  const element = el('div.screen');
  let listening = null;

  const group = (title, ...rows) => el('div.settings-group', {}, el('h3', {}, title), ...rows);

  const row = (label, control) =>
    el('div.row', {}, el('span.label', {}, label), control);

  // --- controls ---

  const keyRows = ACTIONS.map((action) => {
    const btn = button(keyLabel(app.settings.keys[action][0]), () => beginListening(action, btn), {
      variant: 'keybind',
    });
    btn.dataset.action = action;
    return row(t(`action.${action}`), btn);
  });

  function beginListening(action, btn) {
    if (listening) listening.btn.classList.remove('listening');
    listening = { action, btn };
    btn.classList.add('listening');
    btn.textContent = t('press_key');
  }

  function onKeyDown(event) {
    if (!listening) return;
    event.preventDefault();
    event.stopPropagation();

    const { action, btn } = listening;
    listening = null;
    btn.classList.remove('listening');

    if (event.code === 'Escape') {
      btn.textContent = keyLabel(app.settings.keys[action][0]);
      return;
    }

    // Free the code from any other action so two actions can't collide.
    const keys = {};
    for (const name of ACTIONS) {
      keys[name] = app.settings.keys[name].filter((code) => code !== event.code);
    }
    keys[action] = [event.code];

    app.updateSettings({ keys });
    sfx.click();
    for (const other of element.querySelectorAll('.keybind')) {
      other.textContent = keyLabel(app.settings.keys[other.dataset.action][0]);
    }
  }

  // --- audio ---

  const slider = (value, onInput) => {
    const output = el('output', {}, `${value}%`);
    const input = el('input', {
      type: 'range',
      min: 0,
      max: 100,
      step: 1,
      value,
      oninput: (event) => {
        const next = Number(event.target.value);
        output.textContent = `${next}%`;
        onInput(next);
      },
    });
    return el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, input, output);
  };

  const trackSelect = el(
    'select',
    {
      onchange: (event) => {
        const musicTrack = event.target.value;
        app.updateSettings({ musicTrack });
        if (musicTrack === 'silence') stopMusic();
        else playTrack(musicTrack);
      },
    },
    ...MUSIC_TRACKS.map((track) =>
      el('option', { value: track.id, selected: track.id === app.settings.musicTrack }, t(`track.${track.id}`)),
    ),
  );

  const muteCheckbox = el('input', {
    type: 'checkbox',
    checked: app.settings.muted,
    onchange: (event) => app.updateSettings({ muted: event.target.checked }),
  });

  // --- display ---

  const toggle = (checked, onChange) =>
    el('input', { type: 'checkbox', checked, onchange: (event) => onChange(event.target.checked) });

  const backgroundSelect = el(
    'select',
    {
      onchange: (event) => app.updateSettings({ background: event.target.value }),
    },
    ...BACKGROUNDS.map((bg) =>
      el('option', { value: bg.id, selected: bg.id === app.settings.background }, t(`bg.${bg.id}`)),
    ),
  );

  const fpsSelect = el(
    'select',
    {
      onchange: (event) => {
        app.updateSettings({ fpsCap: Number(event.target.value) });
        app.refresh();
      },
    },
    ...FPS_OPTIONS.map((cap) =>
      el(
        'option',
        { value: String(cap), selected: cap === app.settings.fpsCap },
        cap === 0 ? t('fps_unlimited') : `${cap} FPS`,
      ),
    ),
  );

  const languageSelect = el(
    'select',
    {
      onchange: (event) => {
        const language = event.target.value;
        app.updateSettings({ language });
        setLanguage(language);
        app.refresh();
      },
    },
    ...LANGUAGES.map((code) =>
      el('option', { value: code, selected: code === app.settings.language }, LANGUAGE_NAMES[code]),
    ),
  );

  const content = el(
    'div.wrap',
    {},
    group(
      t('controls'),
      el('div.row', {}, el('span.label', { style: { color: 'var(--text-faint)', fontSize: '0.8rem' } }, t('rebind_hint'))),
      ...keyRows,
    ),
    group(
      t('audio'),
      row(t('music_track'), trackSelect),
      row(t('music_volume'), slider(app.settings.musicVolume, (v) => app.updateSettings({ musicVolume: v }))),
      row(t('sfx_volume'), slider(app.settings.sfxVolume, (v) => app.updateSettings({ sfxVolume: v }))),
      row(t('mute'), muteCheckbox),
    ),
    group(
      t('display'),
      row(t('language'), languageSelect),
      row(t('background'), backgroundSelect),
      row(t('fps_cap'), fpsSelect),
      row(t('show_fps'), toggle(app.settings.showFps, (v) => app.updateSettings({ showFps: v }))),
      row(t('glow'), toggle(app.settings.glow, (v) => app.updateSettings({ glow: v }))),
      row(t('scanlines'), toggle(app.settings.scanlines, (v) => app.updateSettings({ scanlines: v }))),
      row(t('show_grid'), toggle(app.settings.showGrid, (v) => app.updateSettings({ showGrid: v }))),
    ),
    el(
      'div.settings-group',
      {},
      el(
        'div',
        { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        button(t('reset_settings'), () => {
          app.updateSettings(normalizeSettings(structuredClone(DEFAULT_SETTINGS)));
          setLanguage(app.settings.language);
          app.refresh();
          toast(t('reset_settings'));
        }),
        button(t('profiles'), () => app.go('profiles')),
        button(t('reset_save'), async () => {
          if (!(await confirmDialog(element, t('reset_save_confirm')))) return;
          app.resetProgress();
          toast(t('reset_done'));
        }, { variant: 'danger' }),
      ),
    ),
  );

  element.append(
    topbar(t('settings'), button(t('back'), () => app.go('menu'), { variant: 'ghost' })),
    el('div.content', {}, content),
  );

  return {
    element,
    mount() {
      window.addEventListener('keydown', onKeyDown, true);
    },
    unmount() {
      window.removeEventListener('keydown', onKeyDown, true);
    },
  };
}
