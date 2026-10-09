/**
 * The leaderboard half of the community server (see /server and
 * src/state/community.js): best score per (world, level, author), plus a
 * per-world ranking. Same fail-soft contract as community.js — a missing or
 * unreachable server just means no leaderboard data, never a thrown error.
 */

import { SEASON } from './season.js';

function normalizeBase(url) {
  return url.replace(/\/+$/, '');
}

async function request(serverUrl, path, options = {}) {
  if (!serverUrl) return { ok: false, error: 'no_server' };
  let response;
  try {
    response = await fetch(`${normalizeBase(serverUrl)}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    return { ok: false, error: 'unreachable' };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'bad_response' };
  }

  if (!response.ok) return { ok: false, error: data?.error ?? `http_${response.status}` };
  return { ok: true, data };
}

export function submitScore(serverUrl, { token, worldId, levelId, worldName, author, moves, pushes, seconds, score, stars }) {
  return request(serverUrl, '/api/scores', {
    method: 'POST',
    body: JSON.stringify({ token, season: SEASON, worldId, levelId, worldName, author, moves, pushes, seconds, score, stars }),
  });
}

export function fetchLevelLeaderboard(serverUrl, worldId, levelId) {
  return request(serverUrl, `/api/scores/${encodeURIComponent(worldId)}/${encodeURIComponent(levelId)}`);
}

export function fetchWorldLeaderboard(serverUrl, worldId) {
  return request(serverUrl, `/api/scores/${encodeURIComponent(worldId)}`);
}

/** Sends many best scores at once — used to catch up on scores made while the server was unreachable. */
export function submitScores(serverUrl, { token, author, scores }) {
  return request(serverUrl, '/api/scores/bulk', {
    method: 'POST',
    body: JSON.stringify({ token, season: SEASON, author, scores }),
  });
}

/** Everyone who has connected a profile to the server, with their overall progress. */
export function fetchPlayers(serverUrl) {
  return request(serverUrl, '/api/players');
}
