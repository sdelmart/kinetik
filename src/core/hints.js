import { solveFromState, makeKeyFn } from './solver.js';
import { createState } from './state.js';
import { step } from './rules.js';

/**
 * Hint economy.
 *
 * A hint spends a token and reveals the next move of an optimal solution from
 * the position the player is actually in — computed live, so it stays correct
 * even after the player has wandered off the intended route.
 *
 * Tokens are earned by playing well rather than handed out freely, and hints
 * only unlock once a level has genuinely put up a fight, so they assist instead
 * of replacing the puzzle.
 */

export const STARTING_TOKENS = 3;
export const TOKENS_PER_THREE_STARS = 1;
export const TOKENS_PER_WORLD = 3;

/** Hints unlock after par is exceeded, or after a while spent on the level. */
export const UNLOCK_AFTER_MOVES_OVER_PAR = 5;
export const UNLOCK_AFTER_SECONDS = 90;

const SOLVE_BUDGET = 400000;

export function hintAvailability({ tokens, moves, par, seconds }) {
  const effortReached =
    moves >= par + UNLOCK_AFTER_MOVES_OVER_PAR || seconds >= UNLOCK_AFTER_SECONDS;

  if (!effortReached) {
    const movesLeft = Math.max(0, par + UNLOCK_AFTER_MOVES_OVER_PAR - moves);
    const secondsLeft = Math.max(0, Math.ceil(UNLOCK_AFTER_SECONDS - seconds));
    return { state: 'locked', movesLeft, secondsLeft };
  }
  if (tokens <= 0) return { state: 'no_tokens' };
  return { state: 'ready' };
}

/**
 * Instant hint when the player is still on the level's stored optimal route:
 * walks that route from the start and returns the next move once it meets
 * the current position. Null when the player has left the route.
 */
export function hintFromSolution(state, level) {
  const solution = level?.solution;
  if (!solution?.length) return null;
  let cursor = createState(level);
  const key = makeKeyFn(cursor);
  const target = key(state);
  for (let i = 0; i < solution.length; i++) {
    if (key(cursor) === target) return { ok: true, direction: solution[i], remaining: solution.length - i };
    const result = step(cursor, solution[i]);
    if (!result) return null;
    cursor = result.state;
  }
  return null;
}

/**
 * @returns {{ok: true, direction: string, remaining: number} | {ok: false, reason: string}}
 */
export function computeHint(state, level) {
  const onRoute = hintFromSolution(state, level);
  if (onRoute) return onRoute;
  const { solved, moves } = solveFromState(state, { maxStates: SOLVE_BUDGET });
  if (!solved) return { ok: false, reason: 'unreachable' };
  if (!moves.length) return { ok: false, reason: 'already_solved' };
  return { ok: true, direction: moves[0], remaining: moves.length };
}

export function awardForLevel({ stars, firstCompletion }) {
  if (!firstCompletion) return 0;
  return stars === 3 ? TOKENS_PER_THREE_STARS : 0;
}
