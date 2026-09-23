import { el, button } from '../components.js';
import { t } from '../../i18n/index.js';
import { formatTime } from '../../core/score.js';
import { computeStreak, todayKey, DAILY_WORLD_ID } from '../../core/daily.js';
import { recordsFor } from '../../state/save.js';

export function menuScreen(app) {
  const started = app.save.totals.runs > 0;

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
        el(
          'div.menu-actions',
          {},
          button(started ? t('continue') : t('play'), () => app.go('worlds'), {
            variant: 'primary big',
          }),
          dailyButton,
          button(t('editor'), () => app.go('editor')),
          button(t('statistics'), () => app.go('statistics')),
          button(t('achievements'), () => app.go('achievements')),
          button(t('settings'), () => app.go('settings')),
          button(t('credits'), () => app.go('credits')),
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
