mod logutil;
mod net;
mod device;
mod download;
mod radio;

#[cfg(windows)]
mod device_location_windows;

mod meshproxy;
mod sysmesh;

use net::MeshState;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

/// How long the main window may stay hidden before its page reloads. The close button hides
/// the window rather than quitting, so without this the page's memory only grows.
const RECYCLE_AFTER: Duration = Duration::from_secs(20 * 60);

/// Counts hide and show changes so a pending recycle can tell it is stale.
#[derive(Default)]
struct HideCycle(AtomicU64);

pub fn run() {
    logutil::emit("info", "thaali starting");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(MeshState::default())
        .manage(radio::RadioState::default())
        .manage(HideCycle::default())
        .invoke_handler(tauri::generate_handler![
            net::mesh_start,
            net::mesh_stop,
            net::mesh_status,
            net::mesh_port,
            net::mesh_load_credentials,
            net::mesh_save_credentials,
            net::mesh_clear_credentials,
            net::mesh_forget,
            device::device_get_battery,
            device::device_get_location,
            download::save_download,
            radio::radio_start_scan,
            radio::radio_stop_scan,
            radio::radio_connect,
            radio::radio_write,
            radio::radio_subscribe,
            radio::radio_disconnect,
        ])
        .setup(|app| {
            #[cfg(windows)]
            {
                let icon = app.default_window_icon().ok_or_else(|| {
                    tauri::Error::AssetNotFound("default window icon is missing for tray".into())
                })?;
                tauri::tray::TrayIconBuilder::with_id("dadi-tray")
                    .icon(icon.clone())
                    .tooltip("Dadi")
                    .show_menu_on_left_click(true)
                    .build(app)?;
            }
            #[cfg(not(windows))]
            let _ = app;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(e) = window.hide() {
                    logutil::emit("error", format!("hide window on close: {e}"));
                }
                schedule_recycle(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => show_main_window(app),
            RunEvent::Exit => logutil::emit("info", "thaali exiting"),
            _ => {}
        });
}

/// Shows and focuses the main window after it was closed to the background.
fn show_main_window(app: &AppHandle) {
    app.state::<HideCycle>().0.fetch_add(1, Ordering::SeqCst);
    let Some(window) = app.get_webview_window("main") else {
        logutil::emit("error", "main window is missing");
        return;
    };
    if let Err(e) = window.unminimize().and_then(|_| window.show()).and_then(|_| window.set_focus()) {
        logutil::emit("error", format!("show main window: {e}"));
    }
}

/// After RECYCLE_AFTER hidden, reload the main page while it is still out of sight, so its
/// memory is released and the next show starts fresh. A show or another hide in the meantime
/// bumps the cycle and this check does nothing.
fn schedule_recycle(app: &AppHandle) {
    let generation = app.state::<HideCycle>().0.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(RECYCLE_AFTER);
        if app.state::<HideCycle>().0.load(Ordering::SeqCst) != generation {
            return;
        }
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        if window.is_visible().unwrap_or(true) {
            return;
        }
        match window.reload() {
            Ok(()) => logutil::emit("info", "main window reloaded after staying hidden"),
            Err(e) => logutil::emit("error", format!("reload hidden main window: {e}")),
        }
    });
}
