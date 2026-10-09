/**
 * Deterministic colour per author name, so the same person always shows up
 * the same colour on the leaderboard and in community sector cards without
 * the server having to store anything beyond the name string it already
 * does. A simple string hash feeds the hue; saturation/lightness are fixed
 * so every colour reads clearly against the dark theme.
 */
function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function authorColor(name) {
  const hue = hashString(String(name ?? '')) % 360;
  return `hsl(${hue}, 65%, 62%)`;
}

export function authorInitial(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}
