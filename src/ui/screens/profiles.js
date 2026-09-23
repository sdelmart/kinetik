import { el, button, topbar, confirmDialog, promptDialog, toast } from '../components.js';
import { t } from '../../i18n/index.js';
import { formatTime, summarizeWorld } from '../../core/score.js';
import { loadSave, recordsFor } from '../../state/save.js';
import {
  createProfile,
  renameProfile,
  deleteProfile,
  profileKey,
  MAX_PROFILES,
} from '../../state/profiles.js';
import { BUILTIN_WORLDS } from '../../core/worlds.js';

/** Profile picker: every player keeps their own progress, scores and sectors. */
export function profilesScreen(app) {
  const element = el('div.screen');
  const list = el('div.grid');

  function summaryFor(profile) {
    const save = loadSave(profileKey(profile.id, 'save'));
    const levels = BUILTIN_WORLDS.reduce((sum, w) => sum + w.levels.length, 0);
    const done = BUILTIN_WORLDS.reduce(
      (sum, world) => sum + summarizeWorld(recordsFor(save, world.id)).completed,
      0,
    );
    return { done, levels, totals: save.totals };
  }

  async function addProfile() {
    if (app.profiles.length >= MAX_PROFILES) {
      toast(t('profiles_full', { max: MAX_PROFILES }));
      return;
    }
    const name = await promptDialog(element, t('profile_name'), '');
    if (!name) return;
    const { profiles, profile } = createProfile(app.profiles, name);
    app.profiles = profiles;
    app.switchProfile(profile);
    app.go('menu');
  }

  function render() {
    list.replaceChildren();

    for (const profile of app.profiles) {
      const { done, levels, totals } = summaryFor(profile);
      const active = profile.id === app.profile?.id;

      list.append(
        el(
          'div.card',
          { style: { cursor: 'default' }, class: active ? 'active-profile' : '' },
          el(
            'button.profile-pick',
            {
              type: 'button',
              onclick: () => {
                app.switchProfile(profile);
                app.go('menu');
              },
            },
            el('h3', {}, profile.name),
            el('div.sub', {}, `${done} / ${levels} ${t('level').toLowerCase()}`),
            el(
              'div.sub',
              { style: { marginTop: '4px' } },
              `${t('score')} ${totals.score} · ${formatTime(totals.seconds)}`,
            ),
            el('div.bar', {}, el('i', { style: { width: `${(done / levels) * 100}%` } })),
          ),
          el(
            'div',
            { style: { display: 'flex', gap: '6px', marginTop: '12px' } },
            button(t('rename'), async () => {
              const name = await promptDialog(element, t('profile_name'), profile.name);
              if (!name) return;
              app.profiles = renameProfile(app.profiles, profile.id, name);
              if (app.profile?.id === profile.id) app.profile = { ...app.profile, name };
              render();
            }, { variant: 'icon ghost' }),
            button(t('delete'), async () => {
              if (!(await confirmDialog(element, t('delete_profile_confirm', { name: profile.name }))))
                return;
              app.profiles = deleteProfile(app.profiles, profile.id);
              if (app.profile?.id === profile.id) {
                app.profile = null;
                app.switchProfile(app.profiles[0] ?? null);
              }
              render();
            }, { variant: 'icon ghost danger' }),
          ),
        ),
      );
    }

    if (app.profiles.length < MAX_PROFILES) {
      list.append(
        el(
          'button.card.add-profile',
          { type: 'button', onclick: addProfile },
          el('h3', {}, `+ ${t('new_profile')}`),
          el('div.sub', {}, t('new_profile_hint')),
        ),
      );
    }
  }

  render();

  element.append(
    topbar(
      t('profiles'),
      app.profile ? button(t('back'), () => app.go('menu'), { variant: 'ghost' }) : null,
    ),
    el(
      'div.content',
      {},
      el(
        'div.wrap',
        {},
        el('p', { style: { color: 'var(--text-faint)', marginTop: 0 } }, t('profiles_intro')),
        list,
      ),
    ),
  );

  return { element };
}
