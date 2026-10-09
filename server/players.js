/**
 * PUBLISH_TOKENS lists the players and their keys: `Scotty:key1,Anaïs:key2`.
 * The name is who the key belongs to — it's what shows on every leaderboard,
 * whatever name was typed in the game, so nobody can post as someone else. A
 * bare key (no `Name:`) is still accepted; its name is the part before the
 * first dash (`scott-7f2k9` -> `Scott`).
 *
 * @returns {Map<string, string>} key -> player name
 */
export function parsePlayers(raw) {
  const players = new Map();
  for (const entry of String(raw ?? '').split(',').map((e) => e.trim()).filter(Boolean)) {
    const sep = entry.indexOf(':');
    if (sep > 0) {
      const name = entry.slice(0, sep).trim().slice(0, 40);
      const key = entry.slice(sep + 1).trim();
      if (name && key) players.set(key, name);
    } else {
      const base = entry.split('-')[0];
      players.set(entry, (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 40));
    }
  }
  return players;
}
