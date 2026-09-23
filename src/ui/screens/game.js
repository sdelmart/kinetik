import { el, button, topbar, stat, stars } from '../components.js';
import { t } from '../../i18n/index.js';
import { createState, isSolved, isDeadlocked } from '../../core/state.js';
import { step } from '../../core/rules.js';
import { History } from '../../core/history.js';
import { levelScore, levelStars, formatTime } from '../../core/score.js';
import { BoardRenderer } from '../../render/renderer.js';
import { actionForKey } from '../../state/settings.js';
import { sfx, playEvents } from '../../audio/sfx.js';
import { commitRun, levelRecord } from '../../state/save.js';
import {
  hintAvailability,
  computeHint,
  awardForLevel,
  TOKENS_PER_WORLD,
} from '../../core/hints.js';
import { toast } from '../components.js';

export function gameScreen(app, { worldId, levelIndex }) {
  const world = app.findWorld(worldId);
  const level = world?.levels[levelIndex];
  if (!level) {
    app.go('worlds');
    return { element: el('div.screen') };
  }

  const accent = world.accent ?? '#00e5ff';
  const history = new History();
  let state = createState(level);
  let startedAt = performance.now();
  let elapsed = 0;
  let finished = false;
  let timerId = null;

  const canvas = el('canvas');
  const boardHost = el('div.board-host', {}, canvas);
  const warning = el('div.warning', { hidden: true });
  boardHost.append(warning);

  const movesStat = stat(t('moves'), '0');
  const pushesStat = stat(t('pushes'), '0');
  const timeStat = stat(t('time'), '00:00');
  const parStat = stat(t('par'), String(level.par));

  const record = levelRecord(app.save, world.id, level.id);
  const fpsStat = stat('FPS', '0');
  const hud = el(
    'div.hud',
    {},
    movesStat,
    pushesStat,
    timeStat,
    parStat,
    record ? stat(t('best'), String(record.bestScore)) : null,
    app.settings.showFps ? fpsStat : null,
  );

  const undoBtn = button(`↶ ${t('undo')}`, () => undo(), { variant: 'icon' });
  const redoBtn = button(`↷ ${t('redo')}`, () => redo(), { variant: 'icon' });
  const muteBtn = button(app.settings.muted ? t('unmute') : t('mute'), () => {
    const muted = app.toggleMute();
    muteBtn.textContent = muted ? t('unmute') : t('mute');
  }, { variant: 'ghost' });

  const hintBtn = button('', () => useHint(), { variant: 'hint' });

  const toolbar = el(
    'div.toolbar',
    {},
    undoBtn,
    redoBtn,
    button(`⟲ ${t('restart')}`, () => restart()),
    hintBtn,
    muteBtn,
  );

  const element = el(
    'div.screen.game',
    {},
    topbar(
      `${app.worldTitle(world)} · ${level.name || `${t('level')} ${levelIndex + 1}`}`,
      button(t('back'), () => leave(), { variant: 'ghost' }),
    ),
    hud,
    boardHost,
    toolbar,
  );

  const renderer = new BoardRenderer(canvas);
  renderer.configure({
    accent,
    glow: app.settings.glow,
    showGrid: app.settings.showGrid,
    fpsCap: app.settings.fpsCap,
  });

  function refreshHint() {
    const availability = hintAvailability({
      tokens: app.hintTokens,
      moves: state.moves,
      par: level.par,
      seconds: elapsed / 1000,
    });

    if (finished) {
      hintBtn.disabled = true;
      hintBtn.textContent = `💡 ${app.hintTokens}`;
      hintBtn.title = '';
      return;
    }

    hintBtn.disabled = availability.state !== 'ready';
    hintBtn.textContent = `💡 ${t('hint')} · ${app.hintTokens}`;
    hintBtn.title =
      availability.state === 'locked'
        ? t('hint_locked', {
            moves: availability.movesLeft,
            seconds: availability.secondsLeft,
          })
        : availability.state === 'no_tokens'
          ? t('hint_no_tokens')
          : t('hint_ready');
  }

  /**
   * Hints are solved live from the current position, so they stay correct even
   * when the player has strayed from any intended route.
   */
  function useHint() {
    if (finished || app.hintTokens <= 0) return;

    hintBtn.disabled = true;
    hintBtn.textContent = `💡 ${t('hint_thinking')}`;

    // Yield a frame so the button repaints before the search blocks the thread.
    requestAnimationFrame(() => {
      const result = computeHint(state);
      if (!result.ok) {
        sfx.error();
        toast(t(`hint_${result.reason}`));
        refreshHint();
        return;
      }

      app.setHintTokens(app.hintTokens - 1);
      renderer.showHint(result.direction);
      sfx.teleport();
      toast(t('hint_shown', { moves: result.remaining }));
      refreshHint();
    });
  }

  function refreshHud() {
    movesStat.querySelector('b').textContent = String(state.moves);
    pushesStat.querySelector('b').textContent = String(state.pushes);
    timeStat.querySelector('b').textContent = formatTime(elapsed / 1000);
    movesStat.classList.toggle('over', state.moves > level.par);
    undoBtn.disabled = !history.canUndo || finished;
    redoBtn.disabled = !history.canRedo || finished;

    const stuck = !finished && isDeadlocked(state);
    warning.hidden = !stuck;
    if (stuck) warning.replaceChildren(t('deadlock'), el('br'), el('small', {}, t('deadlock_hint')));

    if (app.settings.showFps) fpsStat.querySelector('b').textContent = String(renderer.fps);
    refreshHint();
  }

  function apply(next, events) {
    state = next;
    renderer.setState(state);
    renderer.emit(events);
    playEvents(events);
    refreshHud();
    if (isSolved(state)) win();
  }

  function move(direction) {
    if (finished) return;
    const result = step(state, direction);
    if (!result) {
      sfx.blocked();
      return;
    }
    history.record(state);
    apply(result.state, result.events);
  }

  function undo() {
    if (finished) return;
    const previous = history.undo(state);
    if (!previous) return;
    state = previous;
    renderer.setState(state, { animate: false });
    sfx.undo();
    refreshHud();
  }

  function redo() {
    if (finished) return;
    const next = history.redo(state);
    if (!next) return;
    state = next;
    renderer.setState(state, { animate: false });
    sfx.undo();
    refreshHud();
  }

  function restart() {
    finished = false;
    history.clear();
    state = createState(level);
    elapsed = 0;
    startedAt = performance.now();
    renderer.setState(state, { animate: false });
    element.querySelector('.overlay')?.remove();
    sfx.undo();
    refreshHud();
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function leave() {
    stopTimer();
    app.go('levels', { worldId: world.id });
  }

  function win() {
    finished = true;
    stopTimer();
    const seconds = Math.round(elapsed / 1000);
    const score = levelScore({ moves: state.moves, par: level.par, seconds });
    const starCount = levelStars({ moves: state.moves, par: level.par });
    const previous = levelRecord(app.save, world.id, level.id);
    const improved = !previous || score > (previous.bestScore ?? 0);

    app.updateSave(
      commitRun(app.save, {
        worldId: world.id,
        levelId: level.id,
        moves: state.moves,
        pushes: state.pushes,
        seconds,
        score,
        stars: starCount,
      }),
    );

    // Tokens are earned by clearing a level cleanly, plus a bonus per sector.
    const earned =
      awardForLevel({ stars: starCount, firstCompletion: !previous?.completed }) +
      (levelIndex === world.levels.length - 1 && !previous?.completed ? TOKENS_PER_WORLD : 0);
    if (earned > 0) app.setHintTokens(app.hintTokens + earned);

    const isLast = levelIndex === world.levels.length - 1;
    isLast ? sfx.worldWin() : sfx.win();

    const actions = el('div.panel-actions');
    if (!isLast) {
      actions.append(
        button(t('next_level'), () => app.go('game', { worldId: world.id, levelIndex: levelIndex + 1 }), {
          variant: 'primary',
        }),
      );
    }
    actions.append(button(t('retry'), () => restart()));
    actions.append(button(t('back_to_levels'), () => leave(), { variant: 'ghost' }));

    element.append(
      el(
        'div.overlay',
        {},
        el(
          'div.panel',
          {},
          el('h2', {}, isLast ? t('world_complete') : t('level_complete')),
          improved ? el('div.badge', {}, t('new_record')) : null,
          earned > 0 ? el('div.badge.tokens', {}, t('hint_earned', { count: earned })) : null,
          el('div.big-stars', {}, stars(starCount)),
          el('div.score', {}, String(score)),
          el(
            'div.recap',
            {},
            `${state.moves} ${t('moves').toLowerCase()} · ${state.pushes} ${t('pushes').toLowerCase()} · ${formatTime(seconds)}`,
          ),
          actions,
        ),
      ),
    );
  }

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const action = actionForKey(app.settings, event);
    if (!action) return;
    event.preventDefault();

    if (action === 'back') return leave();
    if (finished) return;
    if (action === 'undo') return undo();
    if (action === 'redo') return redo();
    if (action === 'restart') return restart();
    move(action);
  }

  // Touch: a swipe of at least 26px picks the dominant axis.
  let touchStart = null;
  const onTouchStart = (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.hypot(dx, dy) < 26) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  };

  return {
    element,
    mount() {
      renderer.setState(state, { animate: false });
      renderer.start();
      refreshHud();

      timerId = setInterval(() => {
        if (finished) return;
        elapsed = performance.now() - startedAt;
        timeStat.querySelector('b').textContent = formatTime(elapsed / 1000);
        if (app.settings.showFps) fpsStat.querySelector('b').textContent = String(renderer.fps);
        refreshHint();
      }, 250);

      window.addEventListener('keydown', onKeyDown);
      boardHost.addEventListener('touchstart', onTouchStart, { passive: true });
      boardHost.addEventListener('touchend', onTouchEnd, { passive: true });
    },
    unmount() {
      stopTimer();
      renderer.destroy();
      window.removeEventListener('keydown', onKeyDown);
      boardHost.removeEventListener('touchstart', onTouchStart);
      boardHost.removeEventListener('touchend', onTouchEnd);
    },
  };
}
