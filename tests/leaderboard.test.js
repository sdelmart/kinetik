import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { submitScore, fetchLevelLeaderboard, fetchWorldLeaderboard } from '../src/state/leaderboard.js';

describe('leaderboard client', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('reports no_server without a configured URL', async () => {
    globalThis.fetch = vi.fn();
    const result = await submitScore('', { token: 't' });
    expect(result).toEqual({ ok: false, error: 'no_server' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('reports unreachable when the request throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('down'));
    const result = await fetchLevelLeaderboard('https://example.com', 'assembly', 'assembly-1');
    expect(result).toEqual({ ok: false, error: 'unreachable' });
  });

  it('builds the expected URL and body for submitScore', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, best: true }), { status: 201 }));
    await submitScore('https://example.com/', {
      token: 't',
      worldId: 'assembly',
      levelId: 'assembly-1',
      worldName: 'Assemblage',
      author: 'Scott',
      moves: 10,
      pushes: 2,
      seconds: 30,
      score: 500,
      stars: 3,
    });
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://example.com/api/scores');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({ worldId: 'assembly', author: 'Scott', score: 500 });
  });

  it('surfaces a server error payload', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 }));
    const result = await submitScore('https://example.com', { token: 'bad' });
    expect(result).toEqual({ ok: false, error: 'invalid_token' });
  });

  it('fetches the level and world leaderboard from the right paths', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await fetchLevelLeaderboard('https://example.com', 'assembly', 'assembly-1');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/api/scores/assembly/assembly-1',
      expect.anything(),
    );

    await fetchWorldLeaderboard('https://example.com', 'assembly');
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/api/scores/assembly', expect.anything());
  });
});
