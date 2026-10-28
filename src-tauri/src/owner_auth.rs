//! Owner authentication before Chaavi shows a secret: Touch ID (or the account password) on
//! macOS, Windows Hello on Windows, and a polkit prompt on Linux.

/// owner_authenticate asks the operating system to confirm the person at the computer owns it,
/// showing `reason`, and resolves once they have. It fails with the system's own message when
/// they cancel or the check cannot run, so the secret stays hidden.
#[tauri::command]
pub async fn owner_authenticate(reason: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || confirm(&reason))
        .await
        .map_err(|e| format!("internal_error: owner check stopped: {e}"))?
}

#[cfg(target_os = "macos")]
fn confirm(reason: &str) -> Result<(), String> {
    unsafe extern "C" {
        fn thaali_owner_authenticate(reason: *const std::ffi::c_char, err: *mut std::ffi::c_char, err_len: usize) -> i32;
    }
    let reason = std::ffi::CString::new(reason).map_err(|e| format!("invalid_request: {e}"))?;
    let mut err = vec![0 as std::ffi::c_char; 512];
    let ok = unsafe { thaali_owner_authenticate(reason.as_ptr(), err.as_mut_ptr(), err.len()) };
    if ok == 1 {
        return Ok(());
    }
    let message = unsafe { std::ffi::CStr::from_ptr(err.as_ptr()) }.to_string_lossy().into_owned();
    Err(format!("auth_failed: {message}"))
}

#[cfg(windows)]
fn confirm(reason: &str) -> Result<(), String> {
    use windows::core::HSTRING;
    use windows::Security::Credentials::UI::{UserConsentVerificationResult, UserConsentVerifier};

    let result = UserConsentVerifier::RequestVerificationAsync(&HSTRING::from(reason))
        .map_err(|e| format!("capability_unsupported: Windows Hello unavailable: {e}"))?
        .get()
        .map_err(|e| format!("auth_failed: Windows Hello check failed: {e}"))?;
    match result {
        UserConsentVerificationResult::Verified => Ok(()),
        UserConsentVerificationResult::Canceled => Err("auth_failed: canceled".into()),
        UserConsentVerificationResult::NotConfiguredForUser | UserConsentVerificationResult::DeviceNotPresent => {
            Err("capability_unsupported: set up Windows Hello (a PIN or fingerprint) to reveal secrets".into())
        }
        UserConsentVerificationResult::DisabledByPolicy => Err("capability_unsupported: Windows Hello is disabled by policy".into()),
        other => Err(format!("auth_failed: Windows Hello did not verify ({})", other.0)),
    }
}

#[cfg(target_os = "linux")]
fn confirm(_reason: &str) -> Result<(), String> {
    let status = std::process::Command::new("pkexec")
        .arg("/bin/true")
        .status()
        .map_err(|e| format!("capability_unsupported: polkit's pkexec is not available: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("auth_failed: canceled".into())
    }
}
