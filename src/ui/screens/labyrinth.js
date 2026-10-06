import { el, button, topbar, toast, stat } from '../components.js';
import { t } from '../../i18n/index.js';
import { actionForKey } from '../../state/settings.js';
import { findChapter, nextChapter } from '../../labyrinth/campaign.js';
import {
  createRun,
  step,
  resolveLock,
  blockingAt,
  isAtExit,
  endlessSpec,
  resolveMaxDifficulty,
} from '../../labyrinth/state.js';
import { drawMaze } from '../../labyrinth/render.js';
import {
  loadLabyrinthSave,
  persistLabyrinthSave,
  commitChapter,
  commitEndlessDepth,
  isLabyrinthUnlocked,
} from '../../state/labyrinthSave.js';
import { shuffle, mulberry32 } from '../../labyrinth/rng.js';

export function labyrinthScreen(app, params) {
  const isEndless = Boolean(params.endless);
  const chapter = isEndless ? null : findChapter(params.chapterId);
  if ((!isEndless && !chapter) || !isLabyrinthUnlocked(app)) {
    // Unknown chapter id, or a stale/direct link while still locked — bail to the menu.
    queueMicrotask(() => app.go('labyrinthMenu'));
    return { element: el('div.screen') };
  }

  let depth = 0;
  const endlessSeed = Date.now() & 0xffffffff;

  function specFor(baseSpec) {
    return { ...baseSpec, maxDifficulty: resolveMaxDifficulty(app.settings.labyrinthDifficulty, baseSpec.maxDifficulty) };
  }

  let run = createRun(specFor(isEndless ? endlessSpec(depth, endlessSeed) : chapter));
  let startedAt = Date.now();
  let pendingLock = null;
  let lastAttemptedDir = null;
  let eliminated = [];

  const canvas = el('canvas');
  const boardHost = el('div.board-host', {}, canvas);
  const status = el('div.status');
  const modalHost = el('div');
  const movesStat = stat(t('lab.moves'), '0');
  const depthStat = isEndless ? stat(t('lab.depth'), '1') : null;
  const hintStat = stat(`💡 ${t('hint_tokens')}`, String(app.hintTokens));
  const hud = el('div.hud', {}, movesStat, depthStat, hintStat);
  const main = el('div.editor-main', {}, boardHost, status, modalHost);

  let frame = null;
  let ctx = null;
  let tile = 32;

  function resize() {
    const rect = boardHost.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    tile = Math.max(12, Math.floor(Math.min(rect.width / run.maze.width, rect.height / run.maze.height)));
    canvas.width = Math.round(run.maze.width * tile * dpr);
    canvas.height = Math.round(run.maze.height * tile * dpr);
    canvas.style.width = `${run.maze.width * tile}px`;
    canvas.style.height = `${run.maze.height * tile}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const observer = new ResizeObserver(resize);

  function draw(time) {
    if (ctx) drawMaze(ctx, run, { tile, time });
    frame = requestAnimationFrame(draw);
  }

  let choiceOrder = [];

  function closeModal() {
    modalHost.replaceChildren();
    pendingLock = null;
    eliminated = [];
  }

  function useHint() {
    if (!pendingLock || app.hintTokens <= 0) return;
    const remaining = choiceOrder.filter((i) => !eliminated.includes(i));
    if (remaining.length <= 2) return;
    const wrongChoices = remaining.filter((i) => i !== pendingLock.question.answer);
    const pick = wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
    eliminated = [...eliminated, pick];
    app.setHintTokens(app.hintTokens - 1);
    hintStat.querySelector('b').textContent = String(app.hintTokens);
    renderModal();
  }

  function renderModal() {
    const lock = pendingLock;
    const visible = choiceOrder.filter((i) => !eliminated.includes(i));
    const actions = el('div.panel-actions');
    for (const choiceIndex of visible) {
      actions.append(button(lock.question.choices[choiceIndex], () => answer(choiceIndex)));
    }

    const canHint = app.hintTokens > 0 && visible.length > 2;
    const hintBtn = button(`💡 ${t('lab.hint')} · ${app.hintTokens}`, useHint, { variant: 'ghost' });
    hintBtn.disabled = !canHint;

    const row = el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } }, hintBtn);
    row.append(button(t('cancel'), closeModal, { variant: 'ghost' }));

    modalHost.replaceChildren(
      el(
        'div.overlay',
        {},
        el(
          'div.panel',
          {},
          el('h2', {}, lock.kind === 'secret' ? t('lab.secret_found') : t('lab.gate_locked')),
          el('p', { style: { color: 'var(--text-dim)', marginBottom: '16px' } }, lock.question.prompt),
          actions,
          row,
        ),
      ),
    );
  }

  function openModal(lock) {
    pendingLock = lock;
    eliminated = [];
    choiceOrder = shuffle(mulberry32(lock.question.id.length * 7 + run.moves), [0, 1, 2, 3]);
    renderModal();
  }

  function answer(choiceIndex) {
    const correct = choiceIndex === pendingLock.question.answer;
    if (!correct) {
      toast(t('lab.wrong_answer'));
      return;
    }
    const kind = pendingLock.kind;
    run = resolveLock(run, pendingLock.edge);
    closeModal();
    toast(kind === 'secret' ? t('lab.secret_opened') : t('lab.gate_opened'));
    attemptMove(lastAttemptedDir);
  }

  function attemptMove(dirName) {
    if (!dirName || pendingLock) return;
    lastAttemptedDir = dirName;
    const blocked = blockingAt(run, dirName);
    if (blocked?.kind === 'wall') return;
    if (blocked) {
      openModal(blocked);
      return;
    }
    run = step(run, dirName);
    movesStat.querySelector('b').textContent = String(run.moves);

    if (isAtExit(run)) onCleared();
  }

  function onCleared() {
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    if (isEndless) {
      let save = loadLabyrinthSave(app.key('labyrinth'));
      save = commitEndlessDepth(save, depth + 1);
      persistLabyrinthSave(save, app.key('labyrinth'));
      toast(t('lab.floor_cleared', { depth: depth + 1 }));
      depth += 1;
      run = createRun(specFor(endlessSpec(depth, endlessSeed)));
      startedAt = Date.now();
      depthStat.querySelector('b').textContent = String(depth + 1);
      movesStat.querySelector('b').textContent = '0';
      resize();
    } else {
      let save = loadLabyrinthSave(app.key('labyrinth'));
      save = commitChapter(save, chapter.id, { moves: run.moves, seconds });
      persistLabyrinthSave(save, app.key('labyrinth'));
      const next = nextChapter(chapter.id);
      status.replaceChildren(
        el(
          'div.card',
          {},
          el('h3', {}, t('lab.chapter_cleared')),
          el('div.sub', {}, `${t('lab.moves')}: ${run.moves} · ${seconds}s`),
          next
            ? button(t('lab.next_chapter'), () => app.go('labyrinth', { chapterId: next.id }))
            : button(t('lab.campaign_done'), () => app.go('labyrinthMenu')),
          button(t('back'), () => app.go('labyrinthMenu'), { variant: 'ghost' }),
        ),
      );
    }
  }

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const action = actionForKey(app.settings, event);
    if (!['up', 'down', 'left', 'right'].includes(action)) return;
    event.preventDefault();
    attemptMove(action);
  }

  const element = el(
    'div.screen',
    {},
    topbar(
      isEndless ? t('lab.endless') : chapter.name,
      button(t('back'), () => app.go('labyrinthMenu'), { variant: 'ghost' }),
    ),
    hud,
    main,
  );

  return {
    element,
    mount() {
      ctx = canvas.getContext('2d');
      observer.observe(boardHost);
      resize();
      frame = requestAnimationFrame(draw);
      window.addEventListener('keydown', onKeyDown);
    },
    unmount() {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
