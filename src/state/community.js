/**
 * Talks to a self-hosted KINETIK community server (see /server in the repo):
 * a small shared library of custom sectors, so a level someone else makes
 * shows up for everyone pointed at the same server. Every function here
 * fails soft — a wrong URL, a server that's down, or a network error all
 * come back as `{ ok: false, error }` rather than throwing, since browsing
 * the built-in and local campaigns must never depend on this working.
 */

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

  if (response.status === 204) return { ok: true, data: null };

  let data = null;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'bad_response' };
  }

  if (!response.ok) return { ok: false, error: data?.error ?? `http_${response.status}` };
  return { ok: true, data };
}

export function checkCommunityServer(serverUrl) {
  return request(serverUrl, '/api/health');
}

export function listCommunityWorlds(serverUrl) {
  return request(serverUrl, '/api/levels');
}

export function fetchCommunityWorld(serverUrl, id) {
  return request(serverUrl, `/api/levels/${encodeURIComponent(id)}`);
}

export function publishCommunityWorld(serverUrl, { token, author, name, world }) {
  return request(serverUrl, '/api/levels', {
    method: 'POST',
    body: JSON.stringify({ token, author, name, world }),
  });
}

export function updateCommunityWorld(serverUrl, id, { token, name, world }) {
  return request(serverUrl, `/api/levels/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ token, name, world }),
  });
}

export function deleteCommunityWorld(serverUrl, id, token) {
  return request(serverUrl, `/api/levels/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

export function reportCommunityWorld(serverUrl, id, reason) {
  return request(serverUrl, `/api/levels/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
