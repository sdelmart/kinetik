import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkCommunityServer,
  listCommunityWorlds,
  fetchCommunityWorld,
  publishCommunityWorld,
  updateCommunityWorld,
  deleteCommunityWorld,
} from '../src/state/community.js';

describe('community client', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('reports no_server when no URL is configured, without touching fetch', async () => {
    globalThis.fetch = vi.fn();
    const result = await checkCommunityServer('');
    expect(result).toEqual({ ok: false, error: 'no_server' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('reports unreachable when fetch itself throws (server down, DNS failure, ...)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await listCommunityWorlds('https://example.com');
    expect(result).toEqual({ ok: false, error: 'unreachable' });
  });

  it('strips a trailing slash from the server URL before building the request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await listCommunityWorlds('https://example.com/');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/api/levels',
      expect.anything(),
    );
  });

  it('surfaces the server error payload on a non-2xx response', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 }));
    const result = await publishCommunityWorld('https://example.com', {
      token: 'bad',
      author: 'Scott',
      name: 'Test',
      world: { levels: [] },
    });
    expect(result).toEqual({ ok: false, error: 'invalid_token' });
  });

  it('returns the parsed data on success', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, worlds: 3 }), { status: 200 }));
    const result = await checkCommunityServer('https://example.com');
    expect(result).toEqual({ ok: true, data: { ok: true, worlds: 3 } });
  });

  it('treats a 204 No Content response as success with null data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await deleteCommunityWorld('https://example.com', 'abc', 'token');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('sends the expected method and body for fetchCommunityWorld / updateCommunityWorld', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await fetchCommunityWorld('https://example.com', 'abc123');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/api/levels/abc123',
      expect.objectContaining({ headers: expect.any(Object) }),
    );

    await updateCommunityWorld('https://example.com', 'abc123', {
      token: 't',
      name: 'New name',
      world: { levels: [] },
    });
    const [, options] = globalThis.fetch.mock.calls[1];
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ token: 't', name: 'New name', world: { levels: [] } });
  });
});
