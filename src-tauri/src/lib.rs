mod logutil;
mod net;
mod device;
mod radio;

#[cfg(windows)]
mod device_location_windows;

mod meshproxy;
mod sysmesh;

use net::MeshState;
use tauri::{Manager, RunEvent, WindowEvent};

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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(MeshState::default())
        .manage(radio::RadioState::default())
        .invoke_handler(tauri::generate_handler![
            net::mesh_start,
            net::mesh_stop,
            net::mesh_status,
            net::mesh_port,
            net::mesh_load_credentials,
            net::mesh_save_credentials,
            net::mesh_clear_credentials,
            device::device_get_battery,
            device::device_get_location,
            device::device_write_download,
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
fn show_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        logutil::emit("error", "main window is missing");
        return;
    };
    if let Err(e) = window.unminimize().and_then(|_| window.show()).and_then(|_| window.set_focus()) {
        logutil::emit("error", format!("show main window: {e}"));
    }
}
