//! Local device primitives for Hath device_* reverse-RPC tools.

use serde::Serialize;

/// Battery level (0–100) and charging state returned by `device_get_battery`.
#[derive(Debug, Serialize)]
pub struct BatteryInfo {
    pub percent: f64,
    pub charging: bool,
}

/// Fix returned by `device_get_location` (coords always; address when geocoded).
#[derive(Debug, Serialize)]
pub struct LocationInfo {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: f64,
    pub at: String,
    /// Street or civic address when reverse geocode / civic data is available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
}

/// Read battery percent and charging state from the host.
#[tauri::command]
pub fn device_get_battery() -> Result<BatteryInfo, String> {
    let manager = battery::Manager::new().map_err(|e| format!("capability_unsupported: {e}"))?;
    let battery = manager
        .batteries()
        .map_err(|e| format!("capability_unsupported: {e}"))?
        .next()
        .ok_or_else(|| "capability_unsupported: no battery present".to_string())?
        .map_err(|e| format!("capability_unsupported: {e}"))?;

    let ratio = battery
        .state_of_charge()
        .get::<battery::units::ratio::percent>();
    let charging = matches!(
        battery.state(),
        battery::State::Charging | battery::State::Full
    );
    Ok(BatteryInfo {
        percent: (ratio as f64).round(),
        charging,
    })
}

/// Read coordinates (and address when available) via the platform location API.
#[tauri::command]
pub fn device_get_location() -> Result<LocationInfo, String> {
    #[cfg(target_os = "macos")]
    {
        return apple_get_location();
    }
    #[cfg(windows)]
    {
        return crate::device_location_windows::get_location();
    }
    #[cfg(not(any(target_os = "macos", windows)))]
    {
        Err(
            "capability_unsupported: native location is only implemented on macOS and Windows"
                .to_string(),
        )
    }
}

#[cfg(target_os = "macos")]
fn apple_get_location() -> Result<LocationInfo, String> {
    unsafe extern "C" {
        fn thaali_device_get_location(
            lat: *mut f64,
            lon: *mut f64,
            accuracy_m: *mut f64,
            at_out: *mut std::ffi::c_char,
            at_len: usize,
            address_out: *mut std::ffi::c_char,
            address_len: usize,
            err: *mut std::ffi::c_char,
            err_len: usize,
        ) -> i32;
    }
    let mut lat = 0.0_f64;
    let mut lon = 0.0_f64;
    let mut accuracy = 0.0_f64;
    let mut at_buf = vec![0u8; 64];
    let mut address_buf = vec![0u8; 512];
    let mut err = vec![0u8; 512];
    let rc = unsafe {
        thaali_device_get_location(
            &mut lat,
            &mut lon,
            &mut accuracy,
            at_buf.as_mut_ptr() as *mut std::ffi::c_char,
            at_buf.len(),
            address_buf.as_mut_ptr() as *mut std::ffi::c_char,
            address_buf.len(),
            err.as_mut_ptr() as *mut std::ffi::c_char,
            err.len(),
        )
    };
    if rc == 0 {
        let at = unsafe { std::ffi::CStr::from_ptr(at_buf.as_ptr() as *const std::ffi::c_char) }
            .to_string_lossy()
            .into_owned();
        let address_raw =
            unsafe { std::ffi::CStr::from_ptr(address_buf.as_ptr() as *const std::ffi::c_char) }
                .to_string_lossy()
                .into_owned();
        let address = {
            let trimmed = address_raw.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        };
        return Ok(LocationInfo {
            latitude: lat,
            longitude: lon,
            accuracy,
            at,
            address,
        });
    }
    let message = unsafe { std::ffi::CStr::from_ptr(err.as_ptr() as *const std::ffi::c_char) }
        .to_string_lossy()
        .into_owned();
    if message.is_empty() {
        Err("internal_error: location failed".to_string())
    } else {
        Err(message)
    }
}
