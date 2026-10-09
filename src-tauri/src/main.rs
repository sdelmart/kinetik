// Keeps the console window from appearing alongside the app on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Closes the app from the in-game "Quit" button. `window.close()` from the
/// page is ignored by the desktop webview, so quitting has to happen here.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    // WebKitGTK's DMA-BUF renderer shows a blank window on a number of recent
    // Linux setups (some Mesa/NVIDIA drivers, Wayland sessions). Turning it off
    // costs nothing visible for a 2D game; an explicit user setting still wins.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![quit_app])
        .run(tauri::generate_context!())
        .expect("failed to start KINETIK");
}
