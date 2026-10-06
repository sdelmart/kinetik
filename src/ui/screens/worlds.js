import { el, button, topbar, stars, toast, confirmDialog } from '../components.js';
import { t } from '../../i18n/index.js';
import { summarizeWorld } from '../../core/score.js';
import { recordsFor, isWorldUnlocked } from '../../state/save.js';
import { BUILTIN_WORLDS } from '../../core/worlds.js';
import { listCommunityWorlds, fetchCommunityWorld, deleteCommunityWorld } from '../../state/community.js';
import { write } from '../../state/storage.js';

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

  // --- community sectors: fetched fresh from the configured server --------

  content.append(el('div.section-title', {}, t('community_section_title')));
  const communityHost = el('div');
  content.append(communityHost);

  function showCommunityMessage(message) {
    communityHost.replaceChildren(el('div.empty', {}, message));
  }

  async function loadCommunityWorlds() {
    if (!app.settings.communityServerUrl) {
      showCommunityMessage(t('community_no_server'));
      return;
    }
    showCommunityMessage('…');
    const result = await listCommunityWorlds(app.settings.communityServerUrl);
    if (!result.ok) {
      showCommunityMessage(t('community_test_fail'));
      return;
    }
    if (!result.data.length) {
      showCommunityMessage(t('community_empty'));
      return;
    }

    // Seeing this list is what the home screen's "new sector" badge means by
    // "seen" — so browsing here is what clears it, not just loading the menu.
    const latest = Math.max(...result.data.map((w) => Date.parse(w.updatedAt ?? w.createdAt) || 0));
    write(app.key('communitySeenAt'), latest);

    const grid = el('div.grid');
    for (const summary of result.data) {
      const playBtn = button(t('play'), async () => {
        playBtn.disabled = true;
        const full = await fetchCommunityWorld(app.settings.communityServerUrl, summary.id);
        playBtn.disabled = false;
        if (!full.ok) {
          toast(t('community_test_fail'));
          return;
        }
        app.cacheCommunityWorld({
          id: full.data.world.id,
          name: full.data.name,
          accent: full.data.world.accent,
          levels: full.data.world.levels,
          builtin: false,
          community: true,
        });
        app.go('levels', { worldId: full.data.world.id });
      });

      // Deleting needs the publish token, which proves ownership server-side —
      // the author-name match here is only a client-side hint for who to show
      // the button to, not itself a security check.
      const canDelete =
        app.settings.communityToken &&
        app.settings.communityAuthor &&
        summary.author === app.settings.communityAuthor;

      const actions = el(
        'div',
        { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
        playBtn,
      );
      if (canDelete) {
        actions.append(
          button(
            t('community_delete'),
            async () => {
              if (!(await confirmDialog(element, t('community_delete_confirm', { name: summary.name })))) {
                return;
              }
              const result = await deleteCommunityWorld(
                app.settings.communityServerUrl,
                summary.id,
                app.settings.communityToken,
              );
              if (result.ok) {
                toast(t('community_delete_success'));
                loadCommunityWorlds();
              } else {
                toast(t('community_delete_fail', { error: result.error }));
              }
            },
            { variant: 'ghost danger' },
          ),
        );
      }

      const card = el(
        'div.card',
        { style: { '--card-accent': summary.accent ?? 'var(--accent)', cursor: 'default' } },
        el('h3', {}, summary.name),
        el('div.sub', {}, t('community_by', { author: summary.author })),
        el('div.sub', {}, `${summary.levelCount} ${t('level').toLowerCase()}`),
        actions,
      );
      grid.append(card);
    }
    communityHost.replaceChildren(grid);
  }

  const element = el(
    'div.screen',
    {},
    topbar(t('worlds'), button(t('back'), () => app.go('menu'), { variant: 'ghost' })),
    el('div.content', {}, content),
  );

  return {
    element,
    mount() {
      loadCommunityWorlds();
    },
  };
}
