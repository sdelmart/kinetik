import { resetSave } from './save.js';
import { write } from './storage.js';
import { persistUnlockedAchievements } from './achievements.js';
import { STARTING_TOKENS } from '../core/hints.js';

/**
 * "Erase save data" has to take hint tokens and unlocked achievements down
 * with it — both are derived from save data, so leaving them behind would
 * show trophies and hints the reset just took away the basis for. Kept as a
 * standalone function (rather than inline in the App class) so the three-key
 * coordination is testable without a DOM.
 */
export function resetProfileProgress(keyFor) {
  const save = resetSave(keyFor('save'));
  write(keyFor('hints'), STARTING_TOKENS);
  persistUnlockedAchievements([], keyFor('achievements'));
  return { save, hintTokens: STARTING_TOKENS, achievements: [] };
}
