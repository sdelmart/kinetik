/**
 * True when running inside the Tauri desktop shell rather than a regular
 * browser tab. Used to show desktop-only affordances (like a Quit button) —
 * `window.close()` is a no-op or blocked in most browsers for a tab the
 * script didn't open itself, so offering it there would just be a dead button.
 */
export function isNativeApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function quitApp() {
  window.close();
}
