const PREFIX = 'kinetik:';

/**
 * localStorage can throw (private mode, disabled storage, quota). Every access
 * goes through here so a storage failure degrades to an in-memory session
 * instead of taking the game down.
 */
const memory = new Map();
let warned = false;

function warnOnce(error) {
  if (warned) return;
  warned = true;
  console.warn('[kinetik] persistent storage unavailable, falling back to memory', error);
}

export function read(key, fallback) {
  const full = PREFIX + key;
  try {
    const raw = localStorage.getItem(full);
    if (raw === null) return memory.has(full) ? memory.get(full) : fallback;
    return JSON.parse(raw);
  } catch (error) {
    warnOnce(error);
    return memory.has(full) ? memory.get(full) : fallback;
  }
}

export function write(key, value) {
  const full = PREFIX + key;
  memory.set(full, value);
  try {
    localStorage.setItem(full, JSON.stringify(value));
    return true;
  } catch (error) {
    warnOnce(error);
    return false;
  }
}

export function remove(key) {
  const full = PREFIX + key;
  memory.delete(full);
  try {
    localStorage.removeItem(full);
  } catch (error) {
    warnOnce(error);
  }
}
