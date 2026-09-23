import { el, button, topbar, toast, confirmDialog, promptDialog, tileSwatch } from '../components.js';
import { t } from '../../i18n/index.js';
import { T, E, MIN_SIZE, MAX_SIZE } from '../../core/constants.js';
import {
  createEmptyLevel,
  levelFromGrids,
  gridsFromLevel,
  validateLevel,
  randomId,
} from '../../core/level.js';
import { createState } from '../../core/state.js';
import { BoardRenderer } from '../../render/renderer.js';
import { drawTile, drawCrate, drawDrone } from '../../render/sprites.js';
import { sfx } from '../../audio/sfx.js';
import { isUsableWorld } from '../../state/save.js';

const TERRAIN_TOOLS = [
  ['floor', T.FLOOR],
  ['wall', T.WALL],
  ['target', T.TARGET],
  ['pit', T.PIT],
  ['fragile', T.FRAGILE],
  ['ice', T.ICE],
  ['conv_up', T.CONV_UP],
  ['conv_right', T.CONV_RIGHT],
  ['conv_down', T.CONV_DOWN],
  ['conv_left', T.CONV_LEFT],
  ['tele_a', T.TELE_A],
  ['tele_b', T.TELE_B],
  ['switch', T.SWITCH],
  ['gate', T.GATE],
];

const ENTITY_TOOLS = [
  ['player', E.PLAYER],
  ['crate', E.CRATE],
];

export function editorScreen(app) {
  const element = el('div.screen');

  let world = app.customWorlds[0] ?? null;
  let levelIndex = 0;
  let terrainGrid = [];
  let entityGrid = [];
  let tool = { kind: 'terrain', value: T.WALL, id: 'wall' };
  let undoStack = [];
  let redoStack = [];
  let dirty = false;
  let painting = false;

  const canvas = el('canvas');
  const boardHost = el('div.board-host', {}, canvas);
  const renderer = new BoardRenderer(canvas);
  renderer.configure({ accent: '#00e5ff', glow: app.settings.glow, showGrid: true });

  const side = el('div.editor-side');
  const status = el('div.status');
  const main = el('div.editor-main', {}, boardHost, status);

  // --- world & level handling -------------------------------------------

  function persist() {
    app.updateCustomWorlds([...app.customWorlds]);
  }

  function currentLevel() {
    return world?.levels[levelIndex] ?? null;
  }

  function loadLevelIntoGrids() {
    const level = currentLevel();
    if (!level) {
      terrainGrid = [];
      entityGrid = [];
      return;
    }
    ({ terrainGrid, entityGrid } = gridsFromLevel(level));
    undoStack = [];
    redoStack = [];
    dirty = false;
  }

  function buildLevel() {
    const level = currentLevel();
    return levelFromGrids(terrainGrid, entityGrid, {
      id: level.id,
      name: level.name,
      par: level.par,
    });
  }

  function commitLevel() {
    if (!world || !currentLevel()) return;
    world.levels[levelIndex] = buildLevel();
    persist();
    dirty = false;
  }

  async function createWorld() {
    const name = await promptDialog(
      element,
      t('world_name'),
      `${t('world')} ${app.customWorlds.length + 1}`,
    );
    if (name === null) return;
    const created = {
      id: `custom-${randomId()}`,
      name,
      accent: '#ff2d95',
      builtin: false,
      levels: [],
    };
    app.updateCustomWorlds([...app.customWorlds, created]);
    world = created;
    levelIndex = 0;
    loadLevelIntoGrids();
    render();
  }

  function addLevel() {
    if (!world) return;
    const level = createEmptyLevel(12, 9, `${t('level')} ${world.levels.length + 1}`);
    world.levels.push(level);
    levelIndex = world.levels.length - 1;
    persist();
    loadLevelIntoGrids();
    render();
  }

  async function deleteWorld() {
    if (!world) return;
    if (!(await confirmDialog(element, t('delete_world_confirm')))) return;
    app.updateCustomWorlds(app.customWorlds.filter((w) => w.id !== world.id));
    world = app.customWorlds[0] ?? null;
    levelIndex = 0;
    loadLevelIntoGrids();
    render();
  }

  async function deleteLevel() {
    if (!world || !currentLevel()) return;
    if (!(await confirmDialog(element, t('delete_level_confirm')))) return;
    world.levels.splice(levelIndex, 1);
    levelIndex = Math.max(0, levelIndex - 1);
    persist();
    loadLevelIntoGrids();
    render();
  }

  async function renameCurrent(target) {
    if (target === 'world' && world) {
      const name = await promptDialog(element, t('world_name'), world.name);
      if (name === null) return;
      world.name = name;
    } else if (target === 'level' && currentLevel()) {
      const name = await promptDialog(element, t('level_name'), currentLevel().name);
      if (name === null) return;
      currentLevel().name = name;
    }
    persist();
    render();
  }

  function selectLevel(index) {
    if (dirty) commitLevel();
    levelIndex = index;
    loadLevelIntoGrids();
    render();
  }

  // --- editing ----------------------------------------------------------

  function snapshot() {
    undoStack.push({
      terrain: terrainGrid.map((row) => [...row]),
      entities: entityGrid.map((row) => [...row]),
    });
    if (undoStack.length > 120) undoStack.shift();
    redoStack = [];
  }

  function restore(entry) {
    terrainGrid = entry.terrain.map((row) => [...row]);
    entityGrid = entry.entities.map((row) => [...row]);
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push({
      terrain: terrainGrid.map((row) => [...row]),
      entities: entityGrid.map((row) => [...row]),
    });
    restore(undoStack.pop());
    dirty = true;
    sfx.undo();
    refreshBoard();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push({
      terrain: terrainGrid.map((row) => [...row]),
      entities: entityGrid.map((row) => [...row]),
    });
    restore(redoStack.pop());
    dirty = true;
    sfx.undo();
    refreshBoard();
  }

  function paint(x, y) {
    if (!terrainGrid.length) return false;
    let changed = false;

    if (tool.kind === 'eraser') {
      if (entityGrid[y][x] !== E.NONE) {
        entityGrid[y][x] = E.NONE;
        changed = true;
      } else if (terrainGrid[y][x] !== T.FLOOR) {
        terrainGrid[y][x] = T.FLOOR;
        changed = true;
      }
    } else if (tool.kind === 'terrain') {
      if (terrainGrid[y][x] !== tool.value) {
        terrainGrid[y][x] = tool.value;
        // Nothing can stand inside a wall.
        if (tool.value === T.WALL) entityGrid[y][x] = E.NONE;
        changed = true;
      }
      // Teleporters and the drone are unique: placing one clears the previous.
      if (tool.value === T.TELE_A || tool.value === T.TELE_B) {
        forEachCell((cx, cy) => {
          if ((cx !== x || cy !== y) && terrainGrid[cy][cx] === tool.value) {
            terrainGrid[cy][cx] = T.FLOOR;
          }
        });
      }
    } else if (tool.kind === 'entity') {
      if (terrainGrid[y][x] === T.WALL) return false;
      if (tool.value === E.PLAYER) {
        forEachCell((cx, cy) => {
          if (entityGrid[cy][cx] === E.PLAYER) entityGrid[cy][cx] = E.NONE;
        });
      }
      if (entityGrid[y][x] !== tool.value) {
        entityGrid[y][x] = tool.value;
        changed = true;
      }
    }
    return changed;
  }

  function forEachCell(fn) {
    for (let y = 0; y < terrainGrid.length; y++) {
      for (let x = 0; x < terrainGrid[y].length; x++) fn(x, y);
    }
  }

  function resizeBoard(width, height) {
    const w = Math.min(MAX_SIZE, Math.max(MIN_SIZE, width));
    const h = Math.min(MAX_SIZE, Math.max(MIN_SIZE, height));
    snapshot();
    const nextTerrain = [];
    const nextEntities = [];
    for (let y = 0; y < h; y++) {
      const terrainRow = [];
      const entityRow = [];
      for (let x = 0; x < w; x++) {
        const edge = y === 0 || x === 0 || y === h - 1 || x === w - 1;
        const inside = y < terrainGrid.length && x < terrainGrid[0].length;
        terrainRow.push(edge ? T.WALL : inside ? terrainGrid[y][x] : T.FLOOR);
        entityRow.push(edge ? E.NONE : inside ? entityGrid[y][x] : E.NONE);
      }
      nextTerrain.push(terrainRow);
      nextEntities.push(entityRow);
    }
    terrainGrid = nextTerrain;
    entityGrid = nextEntities;
    dirty = true;
    refreshBoard();
  }

  function clearBoard() {
    snapshot();
    forEachCell((x, y) => {
      const edge =
        y === 0 || x === 0 || y === terrainGrid.length - 1 || x === terrainGrid[0].length - 1;
      terrainGrid[y][x] = edge ? T.WALL : T.FLOOR;
      entityGrid[y][x] = E.NONE;
    });
    dirty = true;
    refreshBoard();
  }

  // --- import / export --------------------------------------------------

  function exportWorld() {
    if (!world) return;
    const payload = JSON.stringify(
      { id: world.id, name: world.name, accent: world.accent, levels: world.levels },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = el('a', { href: url, download: `${world.name.replace(/\s+/g, '_')}.json` });
    link.click();
    URL.revokeObjectURL(url);
  }

  function importWorld() {
    const input = el('input', { type: 'file', accept: 'application/json' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        // Imported files are untrusted: only load them if every level validates.
        const candidate = { ...parsed, id: `custom-${randomId()}`, builtin: false };
        if (!isUsableWorld(candidate)) throw new Error('invalid');
        app.updateCustomWorlds([...app.customWorlds, candidate]);
        world = candidate;
        levelIndex = 0;
        loadLevelIntoGrids();
        render();
        toast(t('import_done'));
      } catch {
        sfx.error();
        toast(t('import_failed'));
      }
    });
    input.click();
  }

  // --- rendering --------------------------------------------------------

  function pseudoState() {
    const level = buildLevel();
    return createState(level);
  }

  function refreshBoard() {
    if (!currentLevel() || !terrainGrid.length) {
      renderer.stop();
      status.className = 'status';
      status.textContent = '';
      saveBtn.disabled = true;
      testBtn.disabled = true;
      return;
    }
    renderer.setState(pseudoState(), { animate: false });
    renderer.start();

    const check = validateLevel(buildLevel());
    status.className = `status ${check.ok ? 'ok' : 'bad'}`;
    status.textContent = check.ok ? t('editor_valid') : t(`error.${check.code}`);
    saveBtn.disabled = !check.ok;
    testBtn.disabled = !check.ok;
  }

  const saveBtn = button(t('save_level'), () => {
    commitLevel();
    sfx.click();
    toast(t('save_level'));
    for (const id of app.checkAchievements()) {
      toast(`🏆 ${t(`achievement.${id}.name`)}`);
    }
  }, { variant: 'primary' });

  const testBtn = button(t('test_level'), () => {
    commitLevel();
    app.go('game', { worldId: world.id, levelIndex });
  });

  function toolSwatch(id, kind, value) {
    return tileSwatch((ctx, size) => {
      const theme = { accent: '#00e5ff', glow: false, time: 500, gateOpen: false, switchPressed: false };
      if (kind === 'entity') {
        drawTile(ctx, T.FLOOR, 0, 0, size, theme);
        if (value === E.PLAYER) {
          drawDrone(ctx, 0, 0, size, { facing: 'down', glow: false, accent: '#00e5ff', time: 0 });
        } else {
          drawCrate(ctx, 0, 0, size, { lit: false, glow: false, accent: '#00e5ff' });
        }
      } else if (kind === 'eraser') {
        drawTile(ctx, T.FLOOR, 0, 0, size, theme);
        ctx.strokeStyle = '#ff4d6d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(size * 0.28, size * 0.28);
        ctx.lineTo(size * 0.72, size * 0.72);
        ctx.moveTo(size * 0.72, size * 0.28);
        ctx.lineTo(size * 0.28, size * 0.72);
        ctx.stroke();
      } else {
        drawTile(ctx, value, 0, 0, size, theme);
      }
    }, 26);
  }

  function renderSide() {
    side.replaceChildren();

    // World picker
    const worldSelect = el(
      'select',
      {
        style: { width: '100%' },
        onchange: (event) => {
          if (dirty) commitLevel();
          world = app.customWorlds.find((w) => w.id === event.target.value) ?? null;
          levelIndex = 0;
          loadLevelIntoGrids();
          render();
        },
      },
      ...app.customWorlds.map((w) =>
        el('option', { value: w.id, selected: w.id === world?.id }, w.name),
      ),
    );

    side.append(el('div.section-title', {}, t('worlds')));
    if (app.customWorlds.length) side.append(worldSelect);
    side.append(
      el(
        'div',
        { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' } },
        button(`+ ${t('new_world')}`, createWorld, { variant: 'icon' }),
        world ? button(t('rename'), () => renameCurrent('world'), { variant: 'icon ghost' }) : null,
        world ? button(t('delete'), deleteWorld, { variant: 'icon ghost danger' }) : null,
      ),
    );

    if (!world) {
      side.append(el('div.empty', { style: { marginTop: '16px' } }, t('no_custom_worlds')));
      return;
    }

    side.append(
      el(
        'div',
        { style: { display: 'flex', gap: '6px', marginTop: '8px' } },
        button(t('export_world'), exportWorld, { variant: 'icon ghost' }),
        button(t('import_world'), importWorld, { variant: 'icon ghost' }),
      ),
    );

    // Levels
    side.append(el('div.section-title', {}, `${t('level')}s`));
    const list = el('div.level-list');
    world.levels.forEach((level, index) => {
      list.append(
        el(
          'div',
          { class: `level-chip ${index === levelIndex ? 'active' : ''}` },
          el('button.btn.ghost.grow', {
            type: 'button',
            style: { padding: '0', background: 'none', border: 'none' },
            onclick: () => selectLevel(index),
          }, level.name || `${t('level')} ${index + 1}`),
        ),
      );
    });
    side.append(world.levels.length ? list : el('div.empty', {}, t('no_levels_yet')));
    side.append(
      el(
        'div',
        { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        button(`+ ${t('new_level')}`, addLevel, { variant: 'icon' }),
        currentLevel() ? button(t('rename'), () => renameCurrent('level'), { variant: 'icon ghost' }) : null,
        currentLevel() ? button(t('delete'), deleteLevel, { variant: 'icon ghost danger' }) : null,
      ),
    );

    if (!currentLevel()) return;

    // Tools
    side.append(el('div.section-title', {}, t('tools')));
    const grid = el('div.tool-grid');
    const addTool = (id, kind, value) => {
      const node = el(
        'button',
        {
          type: 'button',
          class: `tool ${tool.id === id ? 'active' : ''}`,
          onclick: () => {
            tool = { kind, value, id };
            sfx.click();
            renderSide();
          },
        },
        toolSwatch(id, kind, value),
        el('span', {}, kind === 'eraser' ? t('eraser') : t(`tool.${id}`)),
      );
      grid.append(node);
    };
    for (const [id, value] of TERRAIN_TOOLS) addTool(id, 'terrain', value);
    for (const [id, value] of ENTITY_TOOLS) addTool(id, 'entity', value);
    addTool('eraser', 'eraser', null);
    side.append(grid);

    // Board size
    const widthInput = el('input', {
      type: 'number',
      min: MIN_SIZE,
      max: MAX_SIZE,
      value: terrainGrid[0]?.length ?? 12,
      style: { minWidth: '0', width: '70px' },
    });
    const heightInput = el('input', {
      type: 'number',
      min: MIN_SIZE,
      max: MAX_SIZE,
      value: terrainGrid.length,
      style: { minWidth: '0', width: '70px' },
    });
    side.append(el('div.section-title', {}, t('board_size')));
    side.append(
      el(
        'div',
        { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
        widthInput,
        el('span', { style: { color: 'var(--text-faint)' } }, '×'),
        heightInput,
        button(t('resize'), () => resizeBoard(Number(widthInput.value), Number(heightInput.value)), {
          variant: 'icon',
        }),
      ),
    );
    side.append(
      el(
        'div',
        { style: { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' } },
        button(`↶ ${t('undo')}`, undo, { variant: 'icon ghost' }),
        button(`↷ ${t('redo')}`, redo, { variant: 'icon ghost' }),
        button(t('clear_board'), clearBoard, { variant: 'icon ghost' }),
      ),
    );
  }

  function render() {
    renderSide();
    refreshBoard();
  }

  // --- pointer painting -------------------------------------------------

  const onPointerDown = (event) => {
    const cell = renderer.cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;
    painting = true;
    canvas.setPointerCapture(event.pointerId);
    snapshot();
    if (paint(cell.x, cell.y)) {
      dirty = true;
      refreshBoard();
    }
  };

  const onPointerMove = (event) => {
    if (!painting) return;
    const cell = renderer.cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;
    if (paint(cell.x, cell.y)) {
      dirty = true;
      refreshBoard();
    }
  };

  const onPointerUp = () => {
    painting = false;
  };

  const onKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    }
  };

  element.append(
    topbar(
      t('editor_title'),
      saveBtn,
      testBtn,
      button(t('back'), () => {
        if (dirty) commitLevel();
        app.go('menu');
      }, { variant: 'ghost' }),
    ),
    el('div.editor', {}, side, main),
  );

  return {
    element,
    mount() {
      loadLevelIntoGrids();
      render();
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('keydown', onKeyDown);
    },
    unmount() {
      if (dirty) commitLevel();
      renderer.destroy();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
