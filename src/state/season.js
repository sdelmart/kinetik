/**
 * Must match SEASON in server/index.js. Bumping both starts every player's
 * progress, statistics and leaderboard from zero (see App.applySeasonReset)
 * — done when the campaign itself is replaced, so old results don't sit on
 * top of levels they weren't earned on.
 */
export const SEASON = 2;
