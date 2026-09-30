use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

/// The local MagicDNS HTTP proxy port after a successful start.
pub struct MeshState {
    pub port: Mutex<Option<u16>>,
}

impl Default for MeshState {
    fn default() -> Self {
        Self {
            port: Mutex::new(None),
        }
    }
}

/// A device's provisioning: Headscale control URL, preauth key, node name, and the mesh CA when the setup code carried it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub control_url: String,
    pub auth_key: String,
    pub node_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ca_pem: Option<String>,
}

fn credentials_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&data).map_err(|e| format!("create app data dir: {e}"))?;
    Ok(data.join("credentials.json"))
}

/// Connect to dadi: the system `tailscaled` TUN plus the local MagicDNS proxy.
/// Joins dadi through the system tailscaled and starts the local mesh proxy; returns its port.
/// Idempotent: a running proxy's port is returned as is.
#[tauri::command]
pub async fn mesh_start(
    app: AppHandle,
    state: State<'_, MeshState>,
    control_url: String,
    auth_key: String,
    node_name: String,
) -> Result<u16, String> {
    {
        let guard = state.port.lock().map_err(|e| e.to_string())?;
        if let Some(port) = *guard {
            return Ok(port);
        }
    }

    let trimmed_name = node_name.trim();
    if trimmed_name.is_empty() {
        return Err("node_name is empty".into());
    }

    let app2 = app.clone();
    let hostname = trimmed_name.to_string();
    let port = tauri::async_runtime::spawn_blocking(move || {
        crate::sysmesh::start(&app2, &control_url, &auth_key, &hostname)
    })
    .await
    .map_err(|e| format!("mesh_start join: {e}"))??;

    let mut guard = state.port.lock().map_err(|e| e.to_string())?;
    *guard = Some(port);
    Ok(port)
}

/// Stops the mesh proxy and takes this device off dadi.
#[tauri::command]
pub async fn mesh_stop(app: AppHandle, state: State<'_, MeshState>) -> Result<(), String> {
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || crate::sysmesh::stop(&app2))
        .await
        .map_err(|e| format!("mesh_stop join: {e}"))??;

    let mut guard = state.port.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}

/// The system mesh state as the numeric code the frontend maps to a connection state.
#[tauri::command]
pub fn mesh_status(app: AppHandle) -> u8 {
    crate::sysmesh::status(&app)
}

/// The local mesh proxy port, or `None` while disconnected.
#[tauri::command]
pub fn mesh_port(state: State<'_, MeshState>) -> Result<Option<u16>, String> {
    let guard = state.port.lock().map_err(|e| e.to_string())?;
    Ok(*guard)
}

/// Saved mesh credentials, or `None` when this device has not been provisioned.
/// An unreadable, malformed or incomplete credentials file is an error.
#[tauri::command]
pub fn mesh_load_credentials(app: AppHandle) -> Result<Option<Credentials>, String> {
    let path = credentials_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("read credentials {}: {e}", path.display()))?;
    let credentials: Credentials = serde_json::from_str(raw.trim())
        .map_err(|e| format!("parse credentials {}: {e}", path.display()))?;
    if credentials.control_url.trim().is_empty()
        || credentials.auth_key.trim().is_empty()
        || credentials.node_name.trim().is_empty()
    {
        return Err(format!(
            "credentials {} are missing control_url, auth_key or node_name",
            path.display()
        ));
    }
    Ok(Some(credentials))
}

/// Delete persisted mesh credentials (forces onboarding on next prepare).
#[tauri::command]
pub fn mesh_clear_credentials(app: AppHandle) -> Result<(), String> {
    let path = credentials_path(&app)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("clear credentials: {e}"))?;
    }
    Ok(())
}

/// Persists provisioning credentials; incomplete credentials are rejected.
#[tauri::command]
pub fn mesh_save_credentials(app: AppHandle, credentials: Credentials) -> Result<(), String> {
    if credentials.control_url.trim().is_empty()
        || credentials.auth_key.trim().is_empty()
        || credentials.node_name.trim().is_empty()
    {
        return Err("credentials are incomplete".into());
    }
    let path = credentials_path(&app)?;
    let json = serde_json::to_string_pretty(&credentials).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("write credentials: {e}"))?;
    Ok(())
}
