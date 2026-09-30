// Slim local shell: window title, dialog, clipboard, and opener.
// No Claude, Codex, PTY, remote server, worktree, sidecar, or updater.

use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_opener::OpenerExt;

fn file_path_string(path: tauri_plugin_dialog::FilePath) -> String {
    path.to_string()
}

#[tauri::command]
fn app_set_title(window: tauri::WebviewWindow, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|err| err.to_string())
}

#[tauri::command]
fn dialog_confirm(app: tauri::AppHandle, message: String, title: Option<String>) -> bool {
    app.dialog()
        .message(message)
        .title(title.unwrap_or_else(|| "BAT Cowork".to_string()))
        .buttons(MessageDialogButtons::OkCancelCustom("OK", "Cancel"))
        .blocking_show()
}

#[tauri::command]
fn dialog_select_folder(app: tauri::AppHandle) -> Option<Vec<String>> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|path| vec![file_path_string(path)])
}

#[tauri::command]
fn dialog_select_files(app: tauri::AppHandle) -> Vec<String> {
    app.dialog()
        .file()
        .blocking_pick_files()
        .map(|paths| paths.into_iter().map(file_path_string).collect())
        .unwrap_or_default()
}

#[tauri::command]
fn dialog_select_images(app: tauri::AppHandle) -> Vec<String> {
    app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"])
        .blocking_pick_files()
        .map(|paths| paths.into_iter().map(file_path_string).collect())
        .unwrap_or_default()
}

#[tauri::command]
fn clipboard_write_text(app: tauri::AppHandle, text: String) -> Result<bool, String> {
    app.clipboard()
        .write_text(text)
        .map(|_| true)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn shell_open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn shell_open_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn shell_reveal_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|err| err.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            app_set_title,
            dialog_confirm,
            dialog_select_folder,
            dialog_select_files,
            dialog_select_images,
            clipboard_write_text,
            shell_open_external,
            shell_open_path,
            shell_reveal_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BAT Cowork")
}
