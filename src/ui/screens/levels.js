import { el, button, topbar, stars } from '../components.js';
import { t } from '../../i18n/index.js';
import { formatTime } from '../../core/score.js';
import { recordsFor, isLevelUnlocked } from '../../state/save.js';
import { fetchWorldLeaderboard } from '../../state/leaderboard.js';
import { authorColor, authorInitial } from '../authorColor.js';

export function levelsScreen(app, { worldId }) {
  const world = app.findWorld(worldId);
  if (!world) {
    app.go('worlds');
    return { element: el('div.screen') };
  }

  async function showLeaderboard() {
    const body = el('div.leaderboard', {}, '…');
    element.append(
      el(
        'div.overlay',
        { onclick: (event) => event.target.classList.contains('overlay') && close() },
        el(
          'div.panel',
          {},
          el('h2', {}, t('leaderboard_world_title')),
          body,
          button(t('close'), () => close(), { variant: 'ghost' }),
        ),
      ),
    );
    function close() {
      element.querySelector('.overlay')?.remove();
    }

    const result = await fetchWorldLeaderboard(app.settings.communityServerUrl, world.id);
    const ranking = result.ok ? result.data.ranking : [];
    if (!ranking.length) {
      body.replaceChildren(t('leaderboard_empty'));
      return;
    }
    body.replaceChildren(
      ...ranking.slice(0, 20).map((row, rank) =>
        el(
          'div.leaderboard-row',
          { class: row.author === app.communityName() ? 'me' : '' },
          el('span.leaderboard-rank', {}, `#${rank + 1}`),
          el('span.author-avatar', { style: { background: authorColor(row.author) } }, authorInitial(row.author)),
          el('span.leaderboard-name', {}, row.author),
          el('span.leaderboard-score', {}, String(row.totalScore)),
        ),
      ),
    );
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
    topbar(
      app.worldTitle(world),
      app.settings.communityServerUrl
        ? button(t('leaderboard_button'), () => showLeaderboard(), { variant: 'ghost' })
        : null,
      button(t('back'), () => app.go('worlds'), { variant: 'ghost' }),
    ),
    el('div.content', {}, el('div.wrap', {}, grid)),
  );

  return { element };
}
