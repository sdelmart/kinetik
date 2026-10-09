import { el, button, topbar } from '../components.js';
import { t } from '../../i18n/index.js';
import { fetchPlayers } from '../../state/leaderboard.js';
import { BUILTIN_WORLDS } from '../../core/worlds.js';
import { CHAPTERS } from '../../labyrinth/campaign.js';
import { authorColor, authorInitial } from '../authorColor.js';

const TOTAL_LEVELS = BUILTIN_WORLDS.reduce((n, w) => n + w.levels.length, 0);

/**
 * Overall ranking of everyone connected to the community server — built from
 * synced profiles rather than submitted scores, so a player shows up as soon
 * as they connect, even before finishing a level.
 */
export function playersScreen(app) {
  const body = el('div.players', {}, el('div.empty', {}, '…'));

  async function load() {
    const { communityServerUrl } = app.settings;
    if (!communityServerUrl) {
      body.replaceChildren(el('div.empty', {}, t('community_no_server')));
      return;
    }
    // Sync first, so this profile's latest progress is part of what we list.
    await app.syncProgress();
    const result = await fetchPlayers(communityServerUrl);
    if (!result.ok) {
      body.replaceChildren(el('div.empty', {}, t('community_test_fail')));
      return;
    }
    if (!result.data.length) {
      body.replaceChildren(el('div.empty', {}, t('players_empty')));
      return;
    }

    const me = app.communityName().toLowerCase();
    body.replaceChildren(
      el(
        'div.players-row.players-head',
        {},
        el('span', {}, '#'),
        el('span', {}, t('players_name')),
        el('span', {}, t('score')),
        el('span', {}, t('players_levels')),
        el('span', {}, '★'),
        el('span', {}, t('players_labyrinth')),
      ),
      ...result.data.map((player, rank) =>
        el(
          'div.players-row',
          { class: player.name.trim().toLowerCase() === me ? 'me' : '' },
          el('span.players-rank', {}, String(rank + 1)),
          el(
            'span.players-name',
            {},
            el('span.author-avatar', { style: { background: authorColor(player.name) } }, authorInitial(player.name)),
            el('span', {}, player.name),
          ),
          el('span.players-score', {}, String(player.score)),
          el('span', {}, `${player.levelsCompleted} / ${TOTAL_LEVELS}`),
          el('span', {}, String(player.stars)),
          el(
            'span',
            {},
            `${player.labyrinthChapters} / ${CHAPTERS.length}`,
            player.endlessDepth ? el('span.players-depth', {}, ` · ${t('players_depth', { depth: player.endlessDepth })}`) : null,
          ),
        ),
      ),
    );
  }

  const element = el(
    'div.screen',
    {},
    topbar(t('players_title'), button(t('back'), () => app.go('menu'), { variant: 'ghost' })),
    el('div.content', {}, el('div.wrap', {}, el('p.sub', { style: { marginTop: 0 } }, t('players_intro')), body)),
  );

  return {
    element,
    mount() {
      load();
    },
  };
}
