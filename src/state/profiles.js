import { read, write, remove } from './storage.js';
import { randomId } from '../core/level.js';

/**
 * Player profiles. Each profile owns its own progress, scores, hint tokens,
 * settings and custom sectors, stored under a namespaced key, so several people
 * can share one installation without overwriting each other.
 */

const INDEX_KEY = 'profiles';
const ACTIVE_KEY = 'activeProfile';
export const MAX_PROFILES = 6;
export const MAX_NAME_LENGTH = 18;

export function profileKey(id, name) {
  return `p:${id}:${name}`;
}

function sanitizeName(name) {
  return String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
}

export function loadProfiles() {
  const raw = read(INDEX_KEY, null);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
    .map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt ?? 0 }));
}

function persistProfiles(profiles) {
  write(INDEX_KEY, profiles);
}

export function createProfile(profiles, name) {
  const profile = {
    id: randomId(),
    name: sanitizeName(name) || 'Joueur',
    createdAt: Date.now(),
  };
  const next = [...profiles, profile];
  persistProfiles(next);
  return { profiles: next, profile };
}

export function renameProfile(profiles, id, name) {
  const clean = sanitizeName(name);
  if (!clean) return profiles;
  const next = profiles.map((p) => (p.id === id ? { ...p, name: clean } : p));
  persistProfiles(next);
  return next;
}

/** Deleting a profile also drops everything stored under its namespace. */
export function deleteProfile(profiles, id) {
  for (const key of ['save', 'settings', 'worlds', 'hints']) {
    remove(profileKey(id, key));
  }
  const next = profiles.filter((p) => p.id !== id);
  persistProfiles(next);
  if (getActiveProfileId() === id) setActiveProfileId(next[0]?.id ?? null);
  return next;
}

export function getActiveProfileId() {
  const id = read(ACTIVE_KEY, null);
  return typeof id === 'string' ? id : null;
}

export function setActiveProfileId(id) {
  if (id) write(ACTIVE_KEY, id);
  else remove(ACTIVE_KEY);
}

/**
 * Picks the profile to start with: the last one used, else the only one there
 * is. Returns null when the player still has to choose or create one.
 */
export function resolveActiveProfile(profiles) {
  const activeId = getActiveProfileId();
  const active = profiles.find((p) => p.id === activeId);
  if (active) return active;
  if (profiles.length === 1) {
    setActiveProfileId(profiles[0].id);
    return profiles[0];
  }
  return null;
}
