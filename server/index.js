import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLevel } from '../src/core/level.js';

/**
 * A small self-hosted server for sharing KINETIK custom sectors. Reads are
 * open (the point is friction-free browsing for the family/friends it's
 * shared with); publishing requires one of the tokens in PUBLISH_TOKENS, and
 * that same token is the only thing that can later edit or delete the sector
 * it published — there's no account system, just "whoever holds this token".
 *
 * Storage is a single JSON file, not a database: at the scale this is built
 * for (a handful of people sharing sectors), that's simpler to run, back up,
 * and reason about than standing up Postgres/SQLite for a few hundred rows.
 */

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = resolve(here, process.env.DATA_DIR ?? './data');
const DATA_FILE = resolve(DATA_DIR, 'levels.json');
const PUBLISH_TOKENS = new Set(
  (process.env.PUBLISH_TOKENS ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const MAX_LEVELS_PER_WORLD = 60;
const MAX_WORLDS = 500;

if (PUBLISH_TOKENS.size === 0) {
  console.warn(
    '[kinetik-server] PUBLISH_TOKENS is empty — nobody will be able to publish. ' +
      'Set it in .env, e.g. PUBLISH_TOKENS=scott-abc123,mathieu-def456',
  );
}

function loadStore() {
  if (!existsSync(DATA_FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    console.error(`[kinetik-server] ${DATA_FILE} is corrupt, starting empty. The old file was left in place.`);
    return [];
  }
}

function saveStore(store) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

/** Same shape the client's own isUsableWorld() checks, re-verified server-side. */
function validateWorld(world) {
  if (!world || typeof world !== 'object') return 'invalid_shape';
  if (typeof world.name !== 'string' || !world.name.trim()) return 'missing_name';
  if (!Array.isArray(world.levels) || world.levels.length === 0) return 'no_levels';
  if (world.levels.length > MAX_LEVELS_PER_WORLD) return 'too_many_levels';
  for (const level of world.levels) {
    const check = validateLevel(level);
    if (!check.ok) return `invalid_level:${check.code}`;
  }
  return null;
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS,
  }),
);

const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

function summarize(entry) {
  return {
    id: entry.id,
    name: entry.name,
    author: entry.author,
    accent: entry.world.accent ?? null,
    levelCount: entry.world.levels.length,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

app.get('/api/health', (req, res) => {
  const store = loadStore();
  res.json({ ok: true, name: 'kinetik-community-server', worlds: store.length });
});

app.get('/api/levels', readLimiter, (req, res) => {
  const store = loadStore();
  res.json(store.map(summarize));
});

app.get('/api/levels/:id', readLimiter, (req, res) => {
  const store = loadStore();
  const entry = store.find((e) => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'not_found' });
  res.json({ id: entry.id, name: entry.name, author: entry.author, world: entry.world });
});

app.post('/api/levels', writeLimiter, (req, res) => {
  const { token, author, name, world } = req.body ?? {};
  if (typeof token !== 'string' || !PUBLISH_TOKENS.has(token)) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const payloadWorld = { ...world, name: trimmedName || world?.name };
  const problem = validateWorld(payloadWorld);
  if (problem) return res.status(400).json({ error: problem });

  const store = loadStore();
  if (store.length >= MAX_WORLDS) return res.status(507).json({ error: 'storage_full' });

  const entry = {
    id: randomUUID(),
    name: payloadWorld.name,
    author: typeof author === 'string' && author.trim() ? author.trim().slice(0, 40) : 'Anonyme',
    world: { id: payloadWorld.id ?? randomUUID(), accent: payloadWorld.accent, levels: payloadWorld.levels },
    ownerTokenHash: tokenHash(token),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.push(entry);
  saveStore(store);
  res.status(201).json(summarize(entry));
});

function findOwned(req, res, store) {
  const entry = store.find((e) => e.id === req.params.id);
  if (!entry) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  const { token } = req.body ?? {};
  if (typeof token !== 'string' || tokenHash(token) !== entry.ownerTokenHash) {
    res.status(403).json({ error: 'not_owner' });
    return null;
  }
  return entry;
}

app.put('/api/levels/:id', writeLimiter, (req, res) => {
  const store = loadStore();
  const entry = findOwned(req, res, store);
  if (!entry) return;

  const { name, world } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const payloadWorld = { ...world, name: trimmedName || world?.name || entry.name };
  const problem = validateWorld(payloadWorld);
  if (problem) return res.status(400).json({ error: problem });

  entry.name = payloadWorld.name;
  entry.world = { id: entry.world.id, accent: payloadWorld.accent, levels: payloadWorld.levels };
  entry.updatedAt = new Date().toISOString();
  saveStore(store);
  res.json(summarize(entry));
});

app.delete('/api/levels/:id', writeLimiter, (req, res) => {
  const store = loadStore();
  const entry = findOwned(req, res, store);
  if (!entry) return;

  saveStore(store.filter((e) => e.id !== entry.id));
  res.status(204).end();
});

app.use((req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(PORT, () => {
  console.log(`[kinetik-server] listening on :${PORT}, ${PUBLISH_TOKENS.size} publish token(s) configured`);
});
