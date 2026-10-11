//! Files Ankur downloads from the app (a message's attachment), saved into Downloads.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager};

/// save_download writes the request's raw body into the Downloads folder under the
/// base64 UTF-8 `filename` header, numbering the name when it is taken, and returns the
/// saved path. It runs only on a click in the app, never for Hath.
#[tauri::command]
pub fn save_download(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("invalid_request: body must be raw bytes".to_string());
    };
    let header = request
        .headers()
        .get("filename")
        .ok_or_else(|| "invalid_request: filename header is required".to_string())?
        .to_str()
        .map_err(|e| format!("invalid_request: filename header: {e}"))?;
    let decoded = B64
        .decode(header)
        .map_err(|e| format!("invalid_request: filename header is not base64: {e}"))?;
    let filename = String::from_utf8(decoded)
        .map_err(|e| format!("invalid_request: filename is not UTF-8: {e}"))?;
    let name = sanitize_filename(&filename)?;
    let dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("capability_unsupported: Downloads folder: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("internal_error: create downloads: {e}"))?;
    let path = unique_path(&dir, &name)?;
    fs::write(&path, bytes).map_err(|e| format!("internal_error: write download: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// sanitize_filename trims `filename` and rejects an empty name or one that could leave
/// the Downloads folder.
fn sanitize_filename(filename: &str) -> Result<String, String> {
    let trimmed = filename.trim();
    if trimmed.is_empty() {
        return Err("invalid_request: filename is required".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("invalid_request: filename must not contain path separators".to_string());
    }
    Ok(trimmed.to_string())
}

/// unique_path is `dir/filename`, or `stem-N.ext` for the first N not already taken.
fn unique_path(dir: &Path, filename: &str) -> Result<PathBuf, String> {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return Ok(candidate);
    }
    let path = Path::new(filename);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(filename);
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_default();
    (1..10_000)
        .map(|i| dir.join(format!("{stem}-{i}{ext}")))
        .find(|next| !next.exists())
        .ok_or_else(|| format!("internal_error: no free name for {filename} in Downloads"))
}
