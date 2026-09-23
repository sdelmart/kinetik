import { el, button, topbar, tileSwatch } from '../components.js';
import { t } from '../../i18n/index.js';
import { T } from '../../core/constants.js';
import { drawTile } from '../../render/sprites.js';

const LEGEND = [
  [T.PIT, 'legend.pit'],
  [T.FRAGILE, 'legend.fragile'],
  [T.ICE, 'legend.ice'],
  [T.CONV_RIGHT, 'legend.conveyor'],
  [T.TELE_A, 'legend.teleporter'],
  [T.GATE, 'legend.gate'],
];

export function creditsScreen(app) {
  const legend = el('ul.legend-list');
  for (const [tile, key] of LEGEND) {
    legend.append(
      el(
        'li',
        {},
        tileSwatch((ctx, size) =>
          drawTile(ctx, tile, 0, 0, size, {
            accent: '#00e5ff',
            glow: app.settings.glow,
            colorblind: app.settings.colorblindMode,
            time: 600,
            gateOpen: true,
            switchPressed: false,
          }),
        ),
        el('span', {}, t(key)),
      ),
    );
  }

  const body = el(
    'div.credits-body',
    {},
    el('h3', {}, t('how_to_play')),
    el('p', {}, t('how_to_play_body')),
    el('h3', {}, t('legend')),
    legend,
    el('h3', {}, t('credits_tech')),
    el(
      'p',
      {},
      'HTML5 Canvas · JavaScript (ES modules) · Web Audio API · Vite · Vitest · Tauri',
    ),
    el('p', { style: { color: 'var(--text-faint)', fontSize: '0.82rem' } }, 'v1.0.0'),
    el('h3', {}, t('credits_role_design')),
    el('p', {}, t('credits_audio_note')),
    el('p', {}, t('credits_art_note')),
  );

  const element = el(
    'div.screen',
    {},
    topbar(t('credits'), button(t('back'), () => app.go('menu'), { variant: 'ghost' })),
    el('div.content', {}, body),
  );

  return { element };
}
