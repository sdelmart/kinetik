/**
 * Cross-device profile progress, via the same community server as level
 * sharing and the leaderboard (see /server). One call does both push and
 * pull: the server merges whatever's sent with whatever it already has
 * (bests take the better value, totals take the max, achievement lists
 * union) and hands back the merged result, which the caller then applies
 * locally — so a single sync() is always safe to call, regardless of what
 * happened on another device since the last one. Fails soft like the rest
 * of the community client: no server configured, or unreachable, just means
 * nothing to merge this time.
 */

function normalizeBase(url) {
  return url.replace(/\/+$/, '');
}

export async function syncProfile(serverUrl, payload) {
  if (!serverUrl) return { ok: false, error: 'no_server' };
  let response;
  try {
    response = await fetch(`${normalizeBase(serverUrl)}/api/profile/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
