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
import { parsePlayers } from './players.js';

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
/**
 * Leaderboards and synced progress belong to a season. Bumping SEASON starts
 * every ranking and every player's progress from zero (new files, the old ones
 * stay on disk as a backup) — used when the campaign itself is replaced. Apps
 * must send the same season, so an outdated app can't push old progress into
 * the new one. Published sectors and reports are not seasonal.
 */
const SEASON = 2;
const SCORES_FILE = resolve(DATA_DIR, `scores-s${SEASON}.json`);
const PROFILES_FILE = resolve(DATA_DIR, `profiles-s${SEASON}.json`);
const REPORTS_FILE = resolve(DATA_DIR, 'reports.json');
const MAX_SCORES = 20000;
const MAX_PROFILES = 1000;
const MAX_REPORTS = 2000;
const PLAYERS = parsePlayers(process.env.PUBLISH_TOKENS);
const PUBLISH_TOKENS = PLAYERS;
const playerFor = (token) => (typeof token === 'string' ? PLAYERS.get(token) ?? null : null);
const playerKey = (name) => name.trim().toLowerCase();

/** Rejects writes from an app built for another season. */
function wrongSeason(req, res) {
  if (req.body?.season === SEASON) return false;
  res.status(409).json({ error: 'outdated_client', season: SEASON });
  return true;
}
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const MAX_LEVELS_PER_WORLD = 60;
const MAX_WORLDS = 500;

if (PUBLISH_TOKENS.size === 0) {
  console.warn(
    '[kinetik-server] PUBLISH_TOKENS is empty — nobody will be able to publish. ' +
      'Set it in .env, e.g. PUBLISH_TOKENS=Scotty:abc123,Anaïs:def456',
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
const loadReports = () => loadJson(REPORTS_FILE);
const saveReports = (reports) => saveJson(REPORTS_FILE, reports);

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
// Reporting needs no token (anyone browsing should be able to flag a broken
// sector), so it's the one write path open to the whole internet — kept
// tight to stop it being used to spam the data file.
const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });

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
  res.json({ ok: true, name: 'kinetik-community-server', worlds: store.length, season: SEASON });
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
  const { token, name, world } = req.body ?? {};
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
    author: playerFor(token),
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

// No token required — this is the one write path open to anyone browsing,
// so you don't have to be a publisher yourself to flag a broken sector.
app.post('/api/levels/:id/report', reportLimiter, (req, res) => {
  const store = loadStore();
  const entry = store.find((e) => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'not_found' });

  const { reason } = req.body ?? {};
  const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';

  const reports = loadReports();
  if (reports.length >= MAX_REPORTS) return res.status(507).json({ error: 'storage_full' });

  reports.push({
    id: randomUUID(),
    levelId: entry.id,
    levelName: entry.name,
    reason: trimmedReason || null,
    createdAt: new Date().toISOString(),
  });
  saveReports(reports);
  res.status(201).json({ ok: true });
});

// Reading reports needs a valid token — it's not sensitive within the trusted
// group, but there's no reason to expose it to the whole internet either.
app.get('/api/reports', readLimiter, (req, res) => {
  // Header rather than ?token= so the key never lands in proxy access logs.
  const token = req.get('x-kinetik-token');
  if (typeof token !== 'string' || !PUBLISH_TOKENS.has(token)) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  res.json(loadReports());
});

// --- leaderboard: best score per (world, level, author) ------------------
//
// A score is always filed under the player its key belongs to, so a player
// can only ever post their own scores. The values themselves (moves, time)
// are still the app's word for it — honour system within the group.

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

/** Keeps only the best score per (world, level, author). Returns whether it was stored. */
function upsertScore(scores, entry) {
  const author = entry.author.trim().slice(0, 40);
  const existing = scores.find(
    (s) => s.worldId === entry.worldId && s.levelId === entry.levelId && s.author === author,
  );
  const { moves, pushes, seconds, score, stars } = entry;
  if (existing) {
    if (score <= existing.score) return { stored: false };
    Object.assign(existing, { moves, pushes, seconds, score, stars, achievedAt: new Date().toISOString() });
    return { stored: true };
  }
  if (scores.length >= MAX_SCORES) return { stored: false, full: true };
  scores.push({
    worldId: entry.worldId,
    levelId: entry.levelId,
    worldName: typeof entry.worldName === 'string' ? entry.worldName.slice(0, 80) : null,
    author,
    moves,
    pushes,
    seconds,
    score,
    stars,
    achievedAt: new Date().toISOString(),
  });
  return { stored: true };
}

app.post('/api/scores', writeLimiter, (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== 'string' || !PUBLISH_TOKENS.has(token)) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  if (wrongSeason(req, res)) return;
  // The score is filed under the key's owner, never a name the app sends.
  const entry = { ...req.body, author: playerFor(token) };
  const problem = validateScorePayload(entry);
  if (problem) return res.status(400).json({ error: problem });

  const scores = loadScores();
  const result = upsertScore(scores, entry);
  if (result.full) return res.status(507).json({ error: 'storage_full' });
  if (result.stored) saveScores(scores);
  res.status(result.stored ? 201 : 200).json({ ok: true, best: result.stored });
});

const MAX_BULK_SCORES = 300;

// Catches up scores a device couldn't send at the time (server down, offline
// play): one request for many levels, so it doesn't eat the write rate limit.
app.post('/api/scores/bulk', writeLimiter, (req, res) => {
  const { token, scores: incoming } = req.body ?? {};
  if (typeof token !== 'string' || !PUBLISH_TOKENS.has(token)) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  if (wrongSeason(req, res)) return;
  const author = playerFor(token);
  if (!Array.isArray(incoming) || incoming.length > MAX_BULK_SCORES) {
    return res.status(400).json({ error: 'invalid_scores' });
  }

  const scores = loadScores();
  let stored = 0;
  let rejected = 0;
  for (const entry of incoming) {
    const candidate = { ...entry, author };
    if (validateScorePayload(candidate)) {
      rejected++;
      continue;
    }
    if (upsertScore(scores, candidate).stored) stored++;
  }
  if (stored) saveScores(scores);
  res.json({ ok: true, stored, rejected });
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
// Identified by the player the key belongs to (see server/players.js), not
// by a device-local profile, so it follows a person across machines. Every
// call merges the incoming state with whatever's already
// stored and returns the merged result: numbers that only ever grow take
// the max, per-level/per-chapter bests take whichever is actually better,
// achievement lists union — so calling this from any device, in any order,
// never loses progress made on another one.

/** Overall standing of one player, from their synced progress (all zero if none yet). */
const CAMPAIGN_LEVEL_ID = /^[a-z]+-v2-\d+$/;

function summarizePlayer(key, profile) {
  let levelsCompleted = 0;
  let stars = 0;
  for (const [worldId, levels] of Object.entries(profile.save?.records ?? {})) {
    if (worldId.startsWith('daily')) continue;
    for (const [levelId, record] of Object.entries(levels ?? {})) {
      // Campaign levels only ("<sector>-v2-<n>"): not the daily challenge, not
      // community sectors, and not records from the replaced v1 campaign.
      if (!CAMPAIGN_LEVEL_ID.test(levelId)) continue;
      if (record?.completed) levelsCompleted++;
      stars += finite(record?.bestStars);
    }
  }
  const chapters = Object.values(profile.labyrinth?.chapters ?? {}).filter((c) => c?.completed).length;
  return {
    name: profile.displayName ?? key,
    score: finite(profile.save?.totals?.score),
    levelsCompleted,
    stars,
    labyrinthChapters: chapters,
    endlessDepth: finite(profile.labyrinth?.endless?.bestDepth),
    achievements: Array.isArray(profile.achievements) ? profile.achievements.length : 0,
    updatedAt: profile.updatedAt ?? null,
  };
}

app.get('/api/players', readLimiter, (req, res) => {
  const profiles = loadProfiles();
  // Every player declared in PUBLISH_TOKENS is listed, even before they've
  // played or connected — the group should see who's in, at 0 if need be.
  const names = [...new Set(PLAYERS.values())];
  const players = names
    .map((name) => summarizePlayer(name, profiles[playerKey(name)] ?? {}))
    .sort((a, b) => b.score - a.score || b.levelsCompleted - a.levelsCompleted || a.name.localeCompare(b.name));
  res.json(players);
});

/**
 * Which player a key belongs to — lets the app show who it's connected as.
 * POST so the key travels in the body, never in a URL that proxies log.
 */
app.post('/api/whoami', readLimiter, (req, res) => {
  const name = playerFor(req.body?.token);
  if (!name) return res.status(401).json({ error: 'invalid_token' });
  res.json({ name, season: SEASON });
});

app.post('/api/profile/sync', writeLimiter, (req, res) => {
  const { token, save, achievements, hintTokens, labyrinth } = req.body ?? {};
  if (typeof token !== 'string' || !PUBLISH_TOKENS.has(token)) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  if (wrongSeason(req, res)) return;

  // Progress belongs to the key's owner, so it follows them across devices
  // whatever the local profile happens to be called.
  const player = playerFor(token);
  const key = playerKey(player);
  const profiles = loadProfiles();
  const existing = profiles[key];

  if (!existing && Object.keys(profiles).length >= MAX_PROFILES) {
    return res.status(507).json({ error: 'storage_full' });
  }

  const merged = {
    displayName: player,
    save: mergeSave(existing?.save, save),
    achievements: mergeAchievements(existing?.achievements, achievements),
    hintTokens: Math.max(finite(existing?.hintTokens), finite(hintTokens)),
    labyrinth: mergeLabyrinth(existing?.labyrinth, labyrinth),
    updatedAt: new Date().toISOString(),
  };
  profiles[key] = merged;
  saveProfiles(profiles);
  res.json({ ok: true, player, season: SEASON, ...merged });
});

app.use((req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(PORT, () => {
  console.log(`[kinetik-server] listening on :${PORT}, ${PUBLISH_TOKENS.size} publish token(s) configured`);
});
