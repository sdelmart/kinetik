/** Small colour helpers shared by the background layer and the theme setting. */

export function isValidHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value ?? '');
}

export function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex ?? '');
  if (!match) return null;
  return `${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}`;
}
