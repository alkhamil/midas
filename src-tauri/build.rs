fn main() {
    let attributes = tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["connect", "get_server_url", "set_server_url"]),
    );
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
