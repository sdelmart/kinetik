import { el, button, topbar, stars } from '../components.js';
import { t } from '../../i18n/index.js';
import { summarizeWorld } from '../../core/score.js';
import { recordsFor, isWorldUnlocked } from '../../state/save.js';
import { BUILTIN_WORLDS } from '../../core/worlds.js';

export function worldsScreen(app) {
  const content = el('div.wrap');

  const renderGroup = (worlds, offsetForUnlock) => {
    const grid = el('div.grid');
    worlds.forEach((world, index) => {
      const records = recordsFor(app.save, world.id);
      const summary = summarizeWorld(records);
      const unlocked = offsetForUnlock
        ? isWorldUnlocked(app.save, BUILTIN_WORLDS, index)
        : true;
      const total = world.levels.length;
      const done = summary.completed;

      grid.append(
        el(
          'button.card',
          {
            type: 'button',
            disabled: !unlocked,
            style: { '--card-accent': world.accent ?? 'var(--accent)' },
            onclick: () => unlocked && app.go('levels', { worldId: world.id }),
          },
          el('h3', {}, app.worldTitle(world)),
          el(
            'div.sub',
            {},
            unlocked ? `${done} / ${total} ${t('level').toLowerCase()}` : t('locked_hint'),
          ),
          unlocked && summary.stars > 0
            ? el('div', { style: { marginTop: '8px' } }, stars(Math.round(summary.stars / total), 3))
            : null,
          unlocked && summary.score > 0
            ? el('div.sub', { style: { marginTop: '6px' } }, `${t('score')} ${summary.score}`)
            : null,
          el('div.bar', {}, el('i', { style: { width: `${(done / total) * 100}%` } })),
        ),
      );
    });
    return grid;
  };

  content.append(el('div.section-title', {}, t('worlds')));
  content.append(renderGroup(BUILTIN_WORLDS, true));

  content.append(el('div.section-title', {}, t('custom_worlds')));
  content.append(
    app.customWorlds.length
      ? renderGroup(app.customWorlds, false)
      : el('div.empty', {}, t('no_custom_worlds')),
  );

  const element = el(
    'div.screen',
    {},
    topbar(t('worlds'), button(t('back'), () => app.go('menu'), { variant: 'ghost' })),
    el('div.content', {}, content),
  );

  return { element };
}
