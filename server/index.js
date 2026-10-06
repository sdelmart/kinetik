import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLevel } from '../src/core/level.js';
import { mergeSave, mergeAchievements, mergeLabyrinth, finite } from './merge.js';

/**
 * A small self-hosted server for sharing KINETIK custom sectors, a
 * leaderboard, and cross-device profile progress. Reads of sectors/scores are
 * open (the point is friction-free browsing for the family/friends it's
 * shared with); every write (publishing, scoring, syncing) requires one of
 * the tokens in PUBLISH_TOKENS, and for sectors that same token is the only
 * thing that can later edit or delete what it published — there's no account
 * system, just "whoever holds this token".
 *
 * Storage is plain JSON files, not a database: at the scale this is built
 * for (a handful of people sharing sectors), that's simpler to run, back up,
 * and reason about than standing up Postgres/SQLite for a few hundred rows.
 */

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = resolve(here, process.env.DATA_DIR ?? './data');
const DATA_FILE = resolve(DATA_DIR, 'levels.json');
const SCORES_FILE = resolve(DATA_DIR, 'scores.json');
const PROFILES_FILE = resolve(DATA_DIR, 'profiles.json');
const MAX_SCORES = 20000;
const MAX_PROFILES = 1000;
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

function loadJson(file) {
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    console.error(`[kinetik-server] ${file} is corrupt, starting empty. The old file was left in place.`);
    return [];
  }
}

function saveJson(file, data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}

const loadStore = () => loadJson(DATA_FILE);
const saveStore = (store) => saveJson(DATA_FILE, store);
const loadScores = () => loadJson(SCORES_FILE);
const saveScores = (scores) => saveJson(SCORES_FILE, scores);

function loadProfiles() {
  if (!existsSync(PROFILES_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(PROFILES_FILE, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    console.error(`[kinetik-server] ${PROFILES_FILE} is corrupt, starting empty. The old file was left in place.`);
    return {};
  }
}
const saveProfiles = (profiles) => saveJson(PROFILES_FILE, profiles);

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

// --- leaderboard: best score per (world, level, author) ------------------
//
// Same trust model as publishing: any valid token can submit a score under
// any author name, since there's no account system. For a small group this
// is the honour system, not a security boundary — the token just keeps the
// endpoint from being open to the whole internet.

function validateScorePayload(body) {
  const { worldId, levelId, author, moves, pushes, seconds, score, stars } = body ?? {};
  if (typeof worldId !== 'string' || !worldId.trim() || worldId.length > 80) return 'invalid_world';
  if (typeof levelId !== 'string' || !levelId.trim() || levelId.length > 80) return 'invalid_level';
  if (typeof author !== 'string' || !author.trim()) return 'invalid_author';
  for (const [key, value] of Object.entries({ moves, pushes, seconds, score })) {
    if (!Number.isFinite(value) || value < 0) return `invalid_${key}`;
  }
  if (!Number.isInteger(stars) || stars < 0 || stars > 3) return 'invalid_stars';
  return null;
}

app.post('/api/scores', writeLimiter, (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== 'string' || !PUBLISH_TOKENS.has(token)) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  const problem = validateScorePayload(req.body);
  if (problem) return res.status(400).json({ error: problem });

  const { worldId, levelId, worldName, author, moves, pushes, seconds, score, stars } = req.body;
  const trimmedAuthor = author.trim().slice(0, 40);
  const scores = loadScores();
  const existing = scores.find(
    (s) => s.worldId === worldId && s.levelId === levelId && s.author === trimmedAuthor,
  );

  if (existing) {
    const improved = score > existing.score;
    if (improved) {
      Object.assign(existing, { moves, pushes, seconds, score, stars, achievedAt: new Date().toISOString() });
      saveScores(scores);
    }
    return res.json({ ok: true, best: improved });
  }

  if (scores.length >= MAX_SCORES) return res.status(507).json({ error: 'storage_full' });
  scores.push({
    worldId,
    levelId,
    worldName: typeof worldName === 'string' ? worldName.slice(0, 80) : null,
    author: trimmedAuthor,
    moves,
    pushes,
    seconds,
    score,
    stars,
    achievedAt: new Date().toISOString(),
  });
  saveScores(scores);
  res.status(201).json({ ok: true, best: true });
});

app.get('/api/scores/:worldId/:levelId', readLimiter, (req, res) => {
  const scores = loadScores()
    .filter((s) => s.worldId === req.params.worldId && s.levelId === req.params.levelId)
    .sort((a, b) => b.score - a.score)
    .map(({ author, moves, pushes, seconds, score, stars, achievedAt }) => ({
      author,
      moves,
      pushes,
      seconds,
      score,
      stars,
      achievedAt,
    }));
  res.json(scores);
});

app.get('/api/scores/:worldId', readLimiter, (req, res) => {
  const levelScores = loadScores().filter((s) => s.worldId === req.params.worldId);
  const byAuthor = new Map();
  for (const s of levelScores) {
    const row = byAuthor.get(s.author) ?? { author: s.author, totalScore: 0, levelsCleared: 0, bestStars: 0 };
    row.totalScore += s.score;
    row.levelsCleared += 1;
    row.bestStars += s.stars;
    byAuthor.set(s.author, row);
  }
  const ranking = [...byAuthor.values()].sort((a, b) => b.totalScore - a.totalScore);
  res.json({ worldName: levelScores[0]?.worldName ?? null, ranking });
});

// --- profile sync: progression follows you between machines --------------
//
// Identified by profile *name*, not a device-local id (two installs of
// KINETIK generate different random ids for "the same" profile) — so two
// different people who happen to pick the same display name will collide.
// Fine for a small trusted group, same caveat as the leaderboard's author
// names. Every call merges the incoming state with whatever's already
// stored and returns the merged result: numbers that only ever grow take
// the max, per-level/per-chapter bests take whichever is actually better,
// achievement lists union — so calling this from any device, in any order,
// never loses progress made on another one.

app.post('/api/profile/sync', writeLimiter, (req, res) => {
  const { token, profileName, save, achievements, hintTokens, labyrinth } = req.body ?? {};
  if (typeof token !== 'string' || !PUBLISH_TOKENS.has(token)) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  if (typeof profileName !== 'string' || !profileName.trim()) {
    return res.status(400).json({ error: 'invalid_profile' });
  }

  const key = profileName.trim().slice(0, 40).toLowerCase();
  const profiles = loadProfiles();
  const existing = profiles[key];

  if (!existing && Object.keys(profiles).length >= MAX_PROFILES) {
    return res.status(507).json({ error: 'storage_full' });
  }

  const merged = {
    save: mergeSave(existing?.save, save),
    achievements: mergeAchievements(existing?.achievements, achievements),
    hintTokens: Math.max(finite(existing?.hintTokens), finite(hintTokens)),
    labyrinth: mergeLabyrinth(existing?.labyrinth, labyrinth),
    updatedAt: new Date().toISOString(),
  };
  profiles[key] = merged;
  saveProfiles(profiles);
  res.json({ ok: true, ...merged });
});

app.use((req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(PORT, () => {
  console.log(`[kinetik-server] listening on :${PORT}, ${PUBLISH_TOKENS.size} publish token(s) configured`);
});
