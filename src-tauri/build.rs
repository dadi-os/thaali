fn main() {
    let target = std::env::var("TARGET").expect("TARGET");
    let desktop_apple = target.contains("apple-darwin");
    let windows = target.contains("windows");
    let linux = target.contains("linux");

    if desktop_apple || linux || windows {
        let bin_dir = if desktop_apple {
            if target.starts_with("x86_64-") {
                "darwin-amd64"
            } else {
                "darwin-arm64"
            }
        } else if linux {
            "linux-amd64"
        } else {
            "windows-amd64"
        };
        let bin_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("bin")
            .join(bin_dir);
        let ts = if windows {
            bin_path.join("tailscale.exe")
        } else {
            bin_path.join("tailscale")
        };
        let tsd = if windows {
            bin_path.join("tailscaled.exe")
        } else {
            bin_path.join("tailscaled")
        };
        if !ts.exists() || !tsd.exists() {
            panic!(
                "missing {} — run `cd net && ./build-tailscale.sh {bin_dir}` first",
                bin_path.display()
            );
        }
        println!("cargo:rerun-if-changed={}", ts.display());
        println!("cargo:rerun-if-changed={}", tsd.display());
        if windows {
            let wintun = bin_path.join("wintun.dll");
            if !wintun.exists() {
                panic!(
                    "missing {} — run `cd net && ./build-tailscale.sh windows-amd64` (fetches Wintun)",
                    wintun.display()
                );
            }
            println!("cargo:rerun-if-changed={}", wintun.display());
        }
    }

    if target.contains("apple") {
        println!("cargo:rustc-link-lib=framework=CoreFoundation");
        println!("cargo:rustc-link-lib=framework=Security");
        println!("cargo:rustc-link-lib=framework=IOKit");
        println!("cargo:rustc-link-lib=framework=SystemConfiguration");
    }

    if desktop_apple {
        println!("cargo:rustc-link-lib=framework=CoreLocation");
        let loc = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/location.m");
        println!("cargo:rerun-if-changed={}", loc.display());
        let mut build = cc::Build::new();
        build
            .file(&loc)
            .flag("-fobjc-arc")
            .flag("-mmacosx-version-min=11.0")
            .compile("thaali_location");
    }

    tauri_build::build()
}
