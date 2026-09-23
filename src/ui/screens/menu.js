import { el, button } from '../components.js';
import { t } from '../../i18n/index.js';
import { formatTime } from '../../core/score.js';

export function menuScreen(app) {
  const started = app.save.totals.runs > 0;

  const muteButton = button(app.settings.muted ? t('unmute') : t('mute'), () => {
    const muted = app.toggleMute();
    muteButton.textContent = muted ? t('unmute') : t('mute');
  }, { variant: 'ghost' });

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
          button(t('editor'), () => app.go('editor')),
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
