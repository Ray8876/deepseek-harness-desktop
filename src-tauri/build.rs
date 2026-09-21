fn main() {
    println!("cargo:rerun-if-env-changed=DSH_OFFLINE_BUILD");
    if std::env::var("DSH_OFFLINE_BUILD").ok().as_deref() == Some("1") {
        println!("cargo:rustc-env=DSH_OFFLINE_BUILD=1");
    }
    tauri_build::build()
}
