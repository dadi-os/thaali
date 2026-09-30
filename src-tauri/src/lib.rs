mod logutil;
mod net;
mod device;
mod radio;

#[cfg(windows)]
mod device_location_windows;

mod meshproxy;
mod sysmesh;

use net::MeshState;

pub fn run() {
    logutil::emit("info", "thaali starting");
    tauri::Builder::default()
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
            let icon = app.default_window_icon().ok_or_else(|| {
                tauri::Error::AssetNotFound("default window icon is missing for tray".into())
            })?;
            use tauri::tray::TrayIconBuilder;
            TrayIconBuilder::with_id("dadi-tray")
                .icon(icon.clone())
                .tooltip("Dadi")
                .show_menu_on_left_click(true)
                .build(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                logutil::emit("info", "thaali exiting");
            }
        });
}
