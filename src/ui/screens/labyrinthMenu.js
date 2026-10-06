import { el, button, topbar } from '../components.js';
import { t } from '../../i18n/index.js';
import { CHAPTERS } from '../../labyrinth/campaign.js';
import { LABYRINTH_DIFFICULTIES } from '../../state/settings.js';
import {
  loadLabyrinthSave,
  isChapterUnlocked,
  isLabyrinthUnlocked,
  labyrinthSectorsCleared,
  labyrinthUnlockRequirement,
} from '../../state/labyrinthSave.js';

export function labyrinthMenuScreen(app) {
  if (!isLabyrinthUnlocked(app)) {
    const element = el(
      'div.screen',
      {},
      topbar(t('lab.title'), button(t('back'), () => app.go('menu'), { variant: 'ghost' })),
      el(
        'div.content',
        {},
        el(
          'div.wrap',
          {},
          el(
            'div.card',
            {},
            el('h3', {}, `🔒 ${t('lab.title')}`),
            el(
              'div.sub',
              {},
              t('lab.locked_requirement', {
                cleared: labyrinthSectorsCleared(app),
                required: labyrinthUnlockRequirement(),
              }),
            ),
            button(t('lab.go_sokoban'), () => app.go('worlds')),
          ),
        ),
      ),
    );
    return { element };
  }

  const save = loadLabyrinthSave(app.key('labyrinth'));

  const difficultySelect = el(
    'select',
    {
      onchange: (event) => app.updateSettings({ labyrinthDifficulty: event.target.value }),
    },
    ...LABYRINTH_DIFFICULTIES.map((id) =>
      el(
        'option',
        { value: id, selected: id === app.settings.labyrinthDifficulty },
        t(`lab.difficulty_${id}`),
      ),
    ),
  );
  const difficultyRow = el(
    'div.row',
    {},
    el('span.label', {}, t('lab.difficulty_label')),
    difficultySelect,
  );

  const grid = el('div.grid');
  CHAPTERS.forEach((chapter) => {
    const unlocked = isChapterUnlocked(save, CHAPTERS, chapter.id);
    const record = save.chapters[chapter.id];
    grid.append(
      el(
        'button.card',
        {
          type: 'button',
          disabled: !unlocked,
          onclick: () => unlocked && app.go('labyrinth', { chapterId: chapter.id }),
        },
        el('h3', {}, chapter.name),
        el(
          'div.sub',
          {},
          unlocked
            ? record?.completed
              ? `${t('lab.completed')} · ${record.bestMoves} ${t('lab.moves')}`
              : t('lab.gates_count', { count: chapter.gateCount })
            : t('locked_hint'),
        ),
      ),
    );
  });

  const endlessRecord = save.endless.bestDepth;
  const endlessCard = el(
    'button.card',
    { type: 'button', onclick: () => app.go('labyrinth', { endless: true }) },
    el('h3', {}, t('lab.endless')),
    el('div.sub', {}, `${t('lab.best_depth')} ${endlessRecord}`),
  );

  const element = el(
    'div.screen',
    {},
    topbar(t('lab.title'), button(t('back'), () => app.go('menu'), { variant: 'ghost' })),
    el(
      'div.content',
      {},
      el(
        'div.wrap',
        {},
        el('p.sub', {}, t('lab.intro')),
        difficultyRow,
        el('div.section-title', {}, t('lab.campaign')),
        grid,
        el('div.section-title', {}, t('lab.endless')),
        endlessCard,
      ),
    ),
  );

  return { element };
}
