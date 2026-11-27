//! Keeps the computer awake while it is joined to dadi, so idle sleep does not drop the tunnel.

/// StayAwake prevents idle system sleep for as long as it lives and releases it when dropped.
/// The display may still sleep and a closed lid still sleeps the computer. Only macOS holds
/// anything today; elsewhere `hold` succeeds without preventing sleep.
pub struct StayAwake {
    #[cfg(target_os = "macos")]
    assertion: u32,
}

#[cfg(target_os = "macos")]
mod iokit {
    use std::ffi::{c_char, c_void};

    pub const ASSERTION_LEVEL_ON: u32 = 255;
    pub const UTF8: u32 = 0x0800_0100;

    unsafe extern "C" {
        pub fn CFStringCreateWithCString(alloc: *const c_void, c_str: *const c_char, encoding: u32) -> *const c_void;
        pub fn CFRelease(cf: *const c_void);
        pub fn IOPMAssertionCreateWithName(kind: *const c_void, level: u32, name: *const c_void, id: *mut u32) -> i32;
        pub fn IOPMAssertionRelease(id: u32) -> i32;
    }
}

#[cfg(target_os = "macos")]
impl StayAwake {
    /// hold asks the system to prevent idle sleep, listing `reason` in `pmset -g assertions`.
    pub fn hold(reason: &str) -> Result<Self, String> {
        use std::ffi::CString;

        let kind = CString::new("PreventUserIdleSystemSleep").map_err(|e| format!("internal_error: {e}"))?;
        let reason = CString::new(reason).map_err(|e| format!("invalid_request: {e}"))?;
        let mut assertion = 0u32;
        let status = unsafe {
            let kind = iokit::CFStringCreateWithCString(std::ptr::null(), kind.as_ptr(), iokit::UTF8);
            let name = iokit::CFStringCreateWithCString(std::ptr::null(), reason.as_ptr(), iokit::UTF8);
            let status = iokit::IOPMAssertionCreateWithName(kind, iokit::ASSERTION_LEVEL_ON, name, &mut assertion);
            iokit::CFRelease(kind);
            iokit::CFRelease(name);
            status
        };
        if status != 0 {
            return Err(format!("sleep_assertion_failed: IOPMAssertionCreateWithName returned {status}"));
        }
        Ok(Self { assertion })
    }
}

#[cfg(target_os = "macos")]
impl Drop for StayAwake {
    fn drop(&mut self) {
        unsafe {
            iokit::IOPMAssertionRelease(self.assertion);
        }
    }
}

#[cfg(not(target_os = "macos"))]
impl StayAwake {
    /// hold is a no-op on this platform.
    pub fn hold(_reason: &str) -> Result<Self, String> {
        Ok(Self {})
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::StayAwake;
    use std::process::Command;

    fn listed(reason: &str) -> bool {
        let out = Command::new("pmset").args(["-g", "assertions"]).output().expect("pmset");
        String::from_utf8_lossy(&out.stdout).contains(reason)
    }

    #[test]
    fn holds_and_releases_the_idle_sleep_assertion() {
        let reason = "thaali power test assertion";
        let guard = StayAwake::hold(reason).expect("hold");
        assert!(listed(reason), "assertion missing while held");
        drop(guard);
        assert!(!listed(reason), "assertion still listed after drop");
    }
}
