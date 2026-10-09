import { el } from '../components.js';
import { t } from '../../i18n/index.js';
import { sfx } from '../../audio/sfx.js';
import { SPINE, BRANCHES, playIntroTransition } from '../introTransition.js';

const toPath = (pts) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

/**
 * The first thing the player sees: a dark screen with a single crack of light
 * across it. Clicking shatters it and dives through — see introTransition.js,
 * which takes over the whole window for the 3D part.
 */
export function introScreen(app) {
  let breaking = false;

  const ns = 'http://www.w3.org/2000/svg';
  const crack = document.createElementNS(ns, 'svg');
  crack.setAttribute('viewBox', '0 0 100 100');
  crack.setAttribute('preserveAspectRatio', 'none');
  crack.classList.add('intro-crack');
  for (const [points, cls] of [[SPINE, 'crack-spine'], ...BRANCHES.map((b) => [b, 'crack-branch'])]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', toPath(points));
    path.setAttribute('class', cls);
    crack.append(path);
  }

  const title = el('div.intro-title', {}, el('h1', {}, 'KINETIK'), el('p', {}, t('intro_tagline')));
  const hint = el('p.intro-hint', {}, t('intro_hint'));

  function enter() {
    if (breaking) return;
    breaking = true;
    element.classList.add('breaking');
    sfx.dive();
    playIntroTransition({
      onSwap: () => {
        app.go(app.profile ? 'menu' : 'profiles');
        return app.current?.element;
      },
    });
  }

  const element = el(
    'div.screen.intro-screen',
    { onclick: enter },
    el('div.intro-surface'),
    crack,
    title,
    hint,
  );

  return { element };
}
