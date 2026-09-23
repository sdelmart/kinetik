import { el, button, topbar, stars } from '../components.js';
import { t } from '../../i18n/index.js';
import { formatTime } from '../../core/score.js';
import { recordsFor, isLevelUnlocked } from '../../state/save.js';

export function levelsScreen(app, { worldId }) {
  const world = app.findWorld(worldId);
  if (!world) {
    app.go('worlds');
    return { element: el('div.screen') };
  }

  const records = recordsFor(app.save, world.id);
  const grid = el('div.grid.level-grid');

  world.levels.forEach((level, index) => {
    const record = records[level.id];
    // Custom sectors stay fully open so authors can test any level directly.
    const unlocked = world.builtin ? isLevelUnlocked(app.save, world, index) : true;

    grid.append(
      el(
        'button.card',
        {
          type: 'button',
          disabled: !unlocked,
          style: { '--card-accent': world.accent ?? 'var(--accent)' },
          onclick: () => unlocked && app.go('game', { worldId: world.id, levelIndex: index }),
        },
        el('h3', {}, level.name || `${t('level')} ${index + 1}`),
        record
          ? el(
              'div',
              {},
              stars(record.bestStars ?? 0),
              el(
                'div.sub',
                { style: { marginTop: '6px' } },
                `${record.bestScore} · ${record.bestMoves} ${t('moves').toLowerCase()} · ${formatTime(record.bestTime ?? 0)}`,
              ),
            )
          : el('div.sub', {}, unlocked ? t('no_record') : t('locked_level_hint')),
      ),
    );
  });

  const element = el(
    'div.screen',
    {},
    topbar(app.worldTitle(world), button(t('back'), () => app.go('worlds'), { variant: 'ghost' })),
    el('div.content', {}, el('div.wrap', {}, grid)),
  );

  return { element };
}
