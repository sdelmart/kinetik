import { el } from '../components.js';
import { t } from '../../i18n/index.js';

/**
 * The jagged line the screen is split along. Shared between the SVG glow
 * (drawn on top) and the two shard panels' clip-paths (which cut the screen
 * along the exact same points), so the glowing crack sits precisely on the
 * seam the panels pull apart from.
 */
const SPINE = [
  [50, 0], [47, 8], [53, 16], [45, 26], [56, 36],
  [44, 48], [54, 58], [46, 70], [52, 82], [48, 92], [50, 100],
];
const BRANCHES = [
  [[45, 26], [30, 31], [22, 24]],
  [[54, 58], [68, 54], [76, 61]],
  [[46, 70], [36, 78]],
];

const toPoints = (pts) => pts.map(([x, y]) => `${x},${y}`).join(' ');
const toPath = (pts) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

const leftClip = `polygon(0 0, ${toPoints(SPINE)}, 0 100)`;
const rightClip = `polygon(${toPoints([...SPINE].reverse())}, 100 100, 100 0)`;

/**
 * The first thing the player sees: a dark screen with a single crack of light
 * across it. Clicking tears it open — the two halves slide apart — revealing
 * the real menu, already mounted underneath.
 */
export function introScreen(app) {
  let breaking = false;

  const svg = (cls) => {
    const ns = 'http://www.w3.org/2000/svg';
    const node = document.createElementNS(ns, 'svg');
    node.setAttribute('viewBox', '0 0 100 100');
    node.setAttribute('preserveAspectRatio', 'none');
    node.classList.add(cls);

    const spine = document.createElementNS(ns, 'path');
    spine.setAttribute('d', toPath(SPINE));
    spine.setAttribute('class', 'crack-spine');
    node.append(spine);

    for (const branch of BRANCHES) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', toPath(branch));
      p.setAttribute('class', 'crack-branch');
      node.append(p);
    }
    return node;
  };

  const crackGlow = svg('intro-crack');
  const leftShard = el('div.intro-shard.left', { style: { clipPath: leftClip } });
  const rightShard = el('div.intro-shard.right', { style: { clipPath: rightClip } });
  const stage = el('div.intro-stage', {}, leftShard, rightShard, crackGlow);
  const flash = el('div.intro-flash');
  const title = el(
    'div.intro-title',
    {},
    el('h1', {}, 'KINETIK'),
    el('p', {}, t('intro_tagline')),
  );
  const hint = el('p.intro-hint', {}, t('intro_hint'));

  function enter() {
    if (breaking) return;
    breaking = true;
    element.classList.add('breaking');
    title.classList.add('hidden');
    hint.classList.add('hidden');
    setTimeout(() => {
      app.go(app.profile ? 'menu' : 'profiles');
    }, 950);
  }

  const element = el(
    'div.screen.intro-screen',
    { onclick: enter },
    stage,
    flash,
    title,
    hint,
  );

  return { element };
}
