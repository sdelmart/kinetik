import { el, button, confirmDialog } from '../components.js';
import { t } from '../../i18n/index.js';
import { formatTime } from '../../core/score.js';
import { computeStreak, todayKey, DAILY_WORLD_ID } from '../../core/daily.js';
import { recordsFor } from '../../state/save.js';
import { isNativeApp, quitApp } from '../platform.js';
import { BUILTIN_WORLDS } from '../../core/worlds.js';
import { buildContext } from '../../core/achievements.js';
import {
  isLabyrinthUnlocked,
  labyrinthSectorsCleared,
  labyrinthUnlockRequirement,
  loadLabyrinthSave,
} from '../../state/labyrinthSave.js';
import { CHAPTERS } from '../../labyrinth/campaign.js';

function sokobanIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 42 42');
  svg.classList.add('portal-icon');
  svg.innerHTML = `
    <circle cx="29" cy="13" r="8" fill="none" stroke="var(--accent)" stroke-width="2.2" opacity="0.85"/>
    <circle cx="29" cy="13" r="3.2" fill="var(--accent)" opacity="0.85"/>
    <rect x="5" y="20" width="17" height="17" rx="2.5" fill="none" stroke="var(--accent)" stroke-width="2.2"/>
    <path d="M5 28.5 H22 M13.5 20 V37" stroke="var(--accent)" stroke-width="1.4" opacity="0.6"/>
  `;
  return svg;
}

function labyrinthIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 42 42');
  svg.classList.add('portal-icon');
  svg.innerHTML = `
    <path d="M4 4 H38 V38 H4 Z M10 10 H32 V32 H10 Z M16 16 H26 V26 H16 Z"
      fill="none" stroke="var(--amber)" stroke-width="2.1" stroke-linejoin="round"/>
    <path d="M26 16 V4 M16 26 V38" stroke="var(--amber)" stroke-width="2.1"/>
  `;
  return svg;
}

function vaultIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 34 34');
  svg.classList.add('vault-iris');
  svg.innerHTML = `
    <circle class="ring outer" cx="17" cy="17" r="13"/>
    <circle class="ring" cx="17" cy="17" r="7.5" stroke-dasharray="none"/>
    <path class="bolt" d="M17 11.5 L19.4 16.2 H17.9 L17.9 22.5 H16.1 L16.1 16.2 H14.6 Z"/>
  `;
  return svg;
}

export function menuScreen(app) {
  const started = app.save.totals.runs > 0;
  const labUnlocked = isLabyrinthUnlocked(app);

  const totalLevels = BUILTIN_WORLDS.reduce((n, w) => n + w.levels.length, 0);
  const levelsDone = buildContext(app).levelsCompleted;

  const labSave = loadLabyrinthSave(app.key('labyrinth'));
  const chaptersDone = CHAPTERS.filter((c) => labSave.chapters[c.id]?.completed).length;

  const muteButton = button(app.settings.muted ? t('unmute') : t('mute'), () => {
    const muted = app.toggleMute();
    muteButton.textContent = muted ? t('unmute') : t('mute');
  }, { variant: 'ghost' });

  const dailyRecords = recordsFor(app.save, DAILY_WORLD_ID);
  const streak = computeStreak(dailyRecords);
  const playedToday = Boolean(dailyRecords[`${DAILY_WORLD_ID}-${todayKey()}`]?.completed);

  const dailyButton = button(
    el(
      'span',
      { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      `🔥 ${t('daily_challenge')}`,
      playedToday ? el('span.badge-inline', {}, t('done')) : null,
      streak > 0 ? el('span.badge-inline.streak', {}, streak) : null,
    ),
    () => app.go('game', { worldId: DAILY_WORLD_ID, levelIndex: 0 }),
    { variant: 'ghost' },
  );

  const sokobanCard = el(
    'button.portal-card.sokoban',
    { type: 'button', onclick: () => app.go('worlds') },
    sokobanIcon(),
    el('h2', {}, t('home.sokoban_title')),
    el('p.sub', {}, t('home.sokoban_tagline')),
    el(
      'div.bar',
      {},
      el('i', { style: { width: `${(levelsDone / totalLevels) * 100}%` } }),
    ),
    el('p.sub', {}, t('home.levels_progress', { done: levelsDone, total: totalLevels })),
    el('span.portal-cta', {}, started ? t('continue') : t('play')),
  );

  const required = labyrinthUnlockRequirement();
  const cleared = labyrinthSectorsCleared(app);

  const labyrinthCard = labUnlocked
    ? el(
        'button.portal-card.labyrinth',
        { type: 'button', onclick: () => app.go('labyrinthMenu') },
        labyrinthIcon(),
        el('h2', {}, t('home.labyrinth_title')),
        el('p.sub', {}, t('home.labyrinth_tagline')),
        el(
          'div.bar',
          {},
          el('i', { style: { width: `${(chaptersDone / CHAPTERS.length) * 100}%` } }),
        ),
        el('p.sub', {}, t('home.chapters_progress', { done: chaptersDone, total: CHAPTERS.length })),
        el('span.portal-cta', {}, t('lab.title')),
      )
    : el(
        'div.portal-card.labyrinth.locked',
        {},
        labyrinthIcon(),
        el('h2', {}, t('home.labyrinth_title')),
        el(
          'div.vault-seal',
          {},
          el('div.vault-door', {}, vaultIcon()),
          el(
            'div.vault-status',
            {},
            el('span.dot'),
            el('span', {}, t('home.locked_title')),
          ),
          el('p.sub', {}, t('home.locked_sectors', { cleared, required })),
          el('div.bar', {}, el('i', { style: { width: `${(cleared / required) * 100}%` } })),
        ),
      );

  const element = el(
    'div.screen',
    {},
    el(
      'div.menu',
      {},
      el(
        'div.menu-inner',
        {},
        el('h1.logo', {}, 'KINETIK'),
        el('p.tagline', {}, t('tagline')),
        el('div.portal-grid', {}, sokobanCard, labyrinthCard),
        el(
          'div.home-secondary',
          {},
          dailyButton,
          button(t('editor'), () => app.go('editor'), { variant: 'ghost' }),
          button(t('statistics'), () => app.go('statistics'), { variant: 'ghost' }),
          button(t('achievements'), () => app.go('achievements'), { variant: 'ghost' }),
          button(t('settings'), () => app.go('settings'), { variant: 'ghost' }),
          button(t('credits'), () => app.go('credits'), { variant: 'ghost' }),
          isNativeApp()
            ? button(t('quit_game'), async () => {
                if (await confirmDialog(element, t('quit_game_confirm'))) quitApp();
              }, { variant: 'ghost danger' })
            : null,
        ),
        el(
          'div.menu-stats',
          {},
          started
            ? el('span', {}, `${t('total_moves')} `, el('b', {}, app.save.totals.moves))
            : null,
          started ? el('span', {}, `${t('score')} `, el('b', {}, app.save.totals.score)) : null,
          started
            ? el('span', {}, `${t('time')} `, el('b', {}, formatTime(app.save.totals.seconds)))
            : null,
          el('span', {}, `💡 ${t('hint_tokens')} `, el('b', {}, app.hintTokens)),
          el(
            'span',
            {},
            `🏆 ${t('achievements')} `,
            el('b', {}, `${app.achievements.length}`),
          ),
        ),
        el(
          'div',
          { style: { marginTop: '18px', display: 'flex', gap: '8px', justifyContent: 'center' } },
          app.profile
            ? button(`${app.profile.name} · ${t('switch_profile')}`, () => app.go('profiles'), {
                variant: 'ghost',
              })
            : null,
          muteButton,
        ),
      ),
    ),
  );

  return { element };
}
