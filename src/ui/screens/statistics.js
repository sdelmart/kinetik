import { el, button, topbar } from '../components.js';
import { t } from '../../i18n/index.js';
import { BUILTIN_WORLDS } from '../../core/worlds.js';
import { recordsFor } from '../../state/save.js';
import { summarizeWorld, formatTime } from '../../core/score.js';
import { ACHIEVEMENTS } from '../../core/achievements.js';
import { computeStreak, computeLongestStreak, totalDailyClears, DAILY_WORLD_ID } from '../../core/daily.js';

const TOTAL_LEVELS = BUILTIN_WORLDS.reduce((n, w) => n + w.levels.length, 0);
const TOTAL_STARS = TOTAL_LEVELS * 3;

/**
 * Finds the level record with the most replays, the weakest clear, and the
 * fastest one relative to its own par — a raw best time isn't comparable
 * across levels of very different sizes, but time-per-par-move roughly is.
 */
export function findNotable(save) {
  let mostReplayed = null;
  let toughest = null;
  let fastest = null;

  for (const world of BUILTIN_WORLDS) {
    const records = recordsFor(save, world.id);
    world.levels.forEach((level, index) => {
      const record = records[level.id];
      if (!record) return;

      const entry = { world, level, index, record };
      if (!mostReplayed || (record.playCount ?? 0) > (mostReplayed.record.playCount ?? 0)) {
        mostReplayed = entry;
      }
      if (!toughest || (record.bestStars ?? 3) < (toughest.record.bestStars ?? 3)) {
        toughest = entry;
      }
      if (record.bestTime != null) {
        const pace = record.bestTime / level.par;
        const fastestPace = fastest ? fastest.record.bestTime / fastest.level.par : Infinity;
        if (pace < fastestPace) fastest = entry;
      }
    });
  }
  return { mostReplayed, toughest, fastest };
}

function levelLabel(entry) {
  return entry.level.name || `${t('level')} ${entry.index + 1}`;
}

export function statisticsScreen(app) {
  const { save } = app;
  const { mostReplayed, toughest, fastest } = findNotable(save);
  const dailyRecords = recordsFor(save, DAILY_WORLD_ID);

  let levelsCompleted = 0;
  let totalStars = 0;
  for (const world of BUILTIN_WORLDS) {
    const summary = summarizeWorld(recordsFor(save, world.id));
    levelsCompleted += summary.completed;
    totalStars += summary.stars;
  }

  const achievementsUnlocked = app.achievements.length;

  const tiles = el(
    'div.grid.stat-tiles',
    {},
    statTile(t('lifetime_score'), save.totals.score),
    statTile(t('lifetime_playtime'), formatTime(save.totals.seconds)),
    statTile(t('lifetime_moves'), save.totals.moves),
    statTile(t('lifetime_runs'), save.totals.runs),
    statTile(t('lifetime_hint_free'), save.totals.hintFreeClears ?? 0),
  );

  const progress = el(
    'div.settings-group',
    {},
    el('h3', {}, t('progress')),
    el(
      'div.row',
      {},
      el('span.label', {}, t('levels_completed')),
      el('b', {}, `${levelsCompleted} / ${TOTAL_LEVELS}`),
    ),
    el(
      'div.row',
      {},
      el('span.label', {}, t('total_stars')),
      el('b', {}, `${totalStars} / ${TOTAL_STARS}`),
    ),
    ...BUILTIN_WORLDS.map((world) => {
      const summary = summarizeWorld(recordsFor(save, world.id));
      return el(
        'div.row',
        {},
        el('span.label', {}, app.worldTitle(world)),
        el(
          'div.bar',
          { style: { flex: '1', margin: '0 12px' } },
          el('i', {
            style: {
              width: `${(summary.completed / world.levels.length) * 100}%`,
              background: world.accent,
            },
          }),
        ),
        el('b', {}, `${summary.completed}/${world.levels.length}`),
      );
    }),
  );

  const daily = el(
    'div.settings-group',
    {},
    el('h3', {}, t('daily_challenge')),
    el(
      'div.row',
      {},
      el('span.label', {}, t('current_streak')),
      el('b', {}, String(computeStreak(dailyRecords))),
    ),
    el(
      'div.row',
      {},
      el('span.label', {}, t('longest_streak')),
      el('b', {}, computeLongestStreak(dailyRecords)),
    ),
    el(
      'div.row',
      {},
      el('span.label', {}, t('total_daily_clears')),
      el('b', {}, totalDailyClears(dailyRecords)),
    ),
  );

  const notable = el(
    'div.settings-group',
    {},
    el('h3', {}, t('notable_levels')),
    mostReplayed
      ? el(
          'div.row',
          {},
          el('span.label', {}, t('most_replayed')),
          el(
            'b',
            {},
            `${app.worldTitle(mostReplayed.world)} · ${levelLabel(mostReplayed)} (${mostReplayed.record.playCount}×)`,
          ),
        )
      : el('div.empty', {}, t('no_data_yet')),
    toughest && (toughest.record.bestStars ?? 3) < 3
      ? el(
          'div.row',
          {},
          el('span.label', {}, t('toughest_level')),
          el(
            'b',
            {},
            `${app.worldTitle(toughest.world)} · ${levelLabel(toughest)}`,
          ),
        )
      : null,
    fastest
      ? el(
          'div.row',
          {},
          el('span.label', {}, t('fastest_level')),
          el(
            'b',
            {},
            `${app.worldTitle(fastest.world)} · ${levelLabel(fastest)} (${formatTime(fastest.record.bestTime)})`,
          ),
        )
      : null,
  );

  const achievementsGroup = el(
    'div.settings-group',
    {},
    el('h3', {}, t('achievements')),
    el(
      'div.row',
      {},
      el('span.label', {}, t('unlocked')),
      el('b', {}, `${achievementsUnlocked} / ${ACHIEVEMENTS.length}`),
    ),
    button(t('view_achievements'), () => app.go('achievements'), { variant: 'ghost' }),
  );

  const element = el(
    'div.screen',
    {},
    topbar(t('statistics'), button(t('back'), () => app.go('menu'), { variant: 'ghost' })),
    el('div.content', {}, el('div.wrap', {}, tiles, progress, daily, notable, achievementsGroup)),
  );

  return { element };
}

function statTile(label, value) {
  return el('div.card.stat-tile', {}, el('div.stat-tile-value', {}, String(value)), el('div.sub', {}, label));
}
