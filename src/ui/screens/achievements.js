import { el, button, topbar } from '../components.js';
import { t } from '../../i18n/index.js';
import { ACHIEVEMENTS } from '../../core/achievements.js';

/** Read-only trophy case: every achievement, locked or not. */
export function achievementsScreen(app) {
  const unlocked = new Set(app.achievements);

  const grid = el('div.grid.achievement-grid');
  for (const achievement of ACHIEVEMENTS) {
    const done = unlocked.has(achievement.id);
    grid.append(
      el(
        'div.card.achievement-card',
        { class: done ? 'unlocked' : 'locked' },
        el('div.achievement-icon', {}, done ? '🏆' : '🔒'),
        el('h3', {}, t(`achievement.${achievement.id}.name`)),
        el('div.sub', {}, t(`achievement.${achievement.id}.desc`)),
      ),
    );
  }

  const count = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;

  const element = el(
    'div.screen',
    {},
    topbar(
      `${t('achievements')} · ${count} / ${ACHIEVEMENTS.length}`,
      button(t('back'), () => app.go('menu'), { variant: 'ghost' }),
    ),
    el('div.content', {}, el('div.wrap', {}, grid)),
  );

  return { element };
}
