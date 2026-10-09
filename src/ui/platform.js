/**
 * True when running inside the Tauri desktop shell rather than a regular
 * browser tab. Used to show desktop-only affordances (like a Quit button) —
 * `window.close()` is a no-op or blocked in most browsers for a tab the
 * script didn't open itself, so offering it there would just be a dead button.
 */
export function isNativeApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Asks the desktop shell to exit (the `quit_app` command in src-tauri) — the
 * desktop webview ignores `window.close()`, which is why the button used to
 * do nothing. Falls back to `window.close()` outside the desktop app.
 */
export async function quitApp() {
  if (isNativeApp()) {
    try {
      await window.__TAURI_INTERNALS__.invoke('quit_app');
      return;
    } catch {
      // Fall through to the generic attempt below.
    }
  }
  window.close();
}
