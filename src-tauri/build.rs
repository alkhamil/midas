fn main() {
    let attributes = tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["connect", "get_server_url", "set_server_url", "tabs_state", "tab_activate", "tab_close", "tab_new", "tab_move"]),
    );
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
