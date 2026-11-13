//! Midas desktop shell: one window with a tab strip. Every tab is a webview on the Midas server (the same web
//! studio as the browser), and Play is a tab too (see `tabs.rs`).
//!
//! Tab pages are remote. They get native dialogs, file access, the clipboard and the tab events through a runtime
//! capability granted for the configured origin only (`grant_server`). The tab strip and the unreachable-server
//! page are local and get only their own commands.

mod tabs;

use std::{
    fs,
    net::{TcpStream, ToSocketAddrs},
    path::PathBuf,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{
    ipc::CapabilityBuilder,
    menu::{Menu, PredefinedMenuItem, SubmenuBuilder},
    window::WindowBuilder,
    AppHandle, Emitter, EventTarget, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

pub const MAIN: &str = "main";
const DEFAULT_SERVER_URL: &str = "http://127.0.0.1:4000";
const SETTINGS: &str = "server-settings";
const CONNECT_TIMEOUT: Duration = Duration::from_millis(1500);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub server_url: String,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("config.json"))
        .map_err(|e| e.to_string())
}

/// The saved config, or the default when the file is missing or not a valid config. A byte-order mark (which
/// Windows editors add) is accepted.
fn parse_config(text: &str) -> Option<Config> {
    serde_json::from_str::<Config>(text.trim_start_matches('\u{feff}'))
        .ok()
        .filter(|config| normalize_origin(&config.server_url).is_ok())
}

pub fn read_config(app: &AppHandle) -> Config {
    config_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| parse_config(&text))
        .unwrap_or(Config { server_url: DEFAULT_SERVER_URL.into() })
}

fn write_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(app)?;
    fs::create_dir_all(path.parent().ok_or("no config folder")?).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

/// Scheme, host and port of the server. A path, query or fragment is dropped: Midas lives at the root.
fn normalize_origin(input: &str) -> Result<String, String> {
    let url = Url::parse(input.trim()).map_err(|e| format!("Not a valid URL: {e}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("The server URL must start with http:// or https://.".into());
    }
    if url.host_str().is_none() {
        return Err("The server URL needs a host, for example http://127.0.0.1:4000.".into());
    }
    Ok(url.origin().ascii_serialization())
}

pub fn reachable(origin: &str) -> bool {
    let Ok(url) = Url::parse(origin) else { return false };
    let (Some(host), Some(port)) = (url.host_str(), url.port_or_known_default()) else { return false };
    let host = host.trim_start_matches('[').trim_end_matches(']');
    (host, port)
        .to_socket_addrs()
        .map(|addrs| addrs.into_iter().any(|addr| TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT).is_ok()))
        .unwrap_or(false)
}

pub fn parse_url(text: &str) -> Result<Url, String> {
    Url::parse(text).map_err(|e| e.to_string())
}

/// The server's pages may use the dialog, file and clipboard permissions, in the tab webviews only. File access
/// is granted per path by the dialog itself (a path the user picks), so no static file scope is listed here.
fn grant_server(app: &AppHandle, origin: &str) -> Result<(), String> {
    let capability = CapabilityBuilder::new("midas-server")
        .remote(format!("{origin}/*"))
        .webviews(["tab-*", "play-*"])
        .permission("core:event:default")
        .permission("dialog:allow-open")
        .permission("dialog:allow-save")
        .permission("fs:allow-read-file")
        .permission("fs:allow-write-file")
        .permission("clipboard-manager:allow-read-text");
    app.add_capability(capability).map_err(|e| e.to_string())
}

fn open_settings(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(SETTINGS) {
        return window.set_focus().map_err(|e| e.to_string());
    }
    WebviewWindowBuilder::new(app, SETTINGS, WebviewUrl::App("settings.html".into()))
        .title("Server URL")
        .inner_size(480.0, 240.0)
        .resizable(false)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let file = SubmenuBuilder::new(app, "File")
        .text("tab-new", "New Tab\tCtrl+T")
        .text("open", "Open…\tCtrl+O")
        .text("save", "Save\tCtrl+S")
        .text("save-as", "Save As…")
        .text("tab-close", "Close Tab\tCtrl+W")
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Midas"))?)
        .build()?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .text("undo", "Undo\tCtrl+Z")
        .text("redo", "Redo\tCtrl+Shift+Z")
        .separator()
        .text("copy", "Copy\tCtrl+C")
        .text("paste", "Paste\tCtrl+V")
        .text("duplicate", "Duplicate\tCtrl+D")
        .text("select-all", "Select All\tCtrl+A")
        .text("delete", "Delete\tDelete")
        .build()?;
    let view = SubmenuBuilder::new(app, "View")
        .text("reload", "Reload\tCtrl+R")
        .text("fullscreen", "Full Screen\tF11")
        .build()?;
    let mut window = SubmenuBuilder::new(app, "Window")
        .text("tab-next", "Next Tab\tCtrl+Tab")
        .text("tab-prev", "Previous Tab\tCtrl+Shift+Tab");
    for n in 1..=9 {
        window = window.text(format!("tab-{n}"), format!("Tab {n}\tCtrl+{n}"));
    }
    let window = window
        .separator()
        .text("play", "Play in New Tab")
        .text("server-url", "Server URL…")
        .separator()
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;
    Menu::with_items(app, &[&file, &edit, &view, &window])
}

fn on_menu(app: &AppHandle, id: &str) -> Result<(), String> {
    match id {
        "server-url" => open_settings(app),
        "fullscreen" => match app.get_window(MAIN) {
            Some(window) => {
                let full = window.is_fullscreen().map_err(|e| e.to_string())?;
                window.set_fullscreen(!full).map_err(|e| e.to_string())
            }
            None => Ok(()),
        },
        id if tabs::is_tab_command(id) => {
            tabs::command(id);
            Ok(())
        }
        // Everything else is an editor command for the active tab (Play included: the studio flushes its saves,
        // then asks for the Play tab). See apps/studio/src/desktop/bridge.js.
        other => match tabs::active_label(app) {
            Some(label) => app.emit_to(EventTarget::webview(label), "menu", other.to_string()).map_err(|e| e.to_string()),
            None => Ok(()),
        },
    }
}

/// Retry: when the server answers, the tab that asked goes to its route on the server.
pub fn connect_to<F: FnOnce(Url) -> Result<(), String>>(origin: &str, route: &str, navigate: F) -> Result<(), String> {
    if !reachable(origin) {
        return Err(format!("Cannot reach the Midas server at {origin}."));
    }
    navigate(parse_url(&format!("{origin}{route}"))?)
}

#[tauri::command]
fn get_server_url(app: AppHandle) -> String {
    read_config(&app).server_url
}

#[tauri::command]
async fn connect(app: AppHandle, webview: tauri::Webview) -> Result<(), String> {
    let origin = read_config(&app).server_url;
    let route = tabs::route_of(&app, webview.label()).unwrap_or_else(|| "/".into());
    connect_to(&origin, &route, |url| webview.navigate(url).map_err(|e| e.to_string()))
}

/// Changing the server restarts the app: runtime capabilities cannot be removed, so the old origin's
/// permissions would otherwise stay after the change.
#[tauri::command]
fn set_server_url(app: AppHandle, url: String) -> Result<(), String> {
    let origin = normalize_origin(&url)?;
    write_config(&app, &Config { server_url: origin })?;
    app.restart()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_server_url,
            connect,
            set_server_url,
            tabs::tabs_state,
            tabs::tab_activate,
            tabs::tab_close,
            tabs::tab_new,
            tabs::tab_move,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let origin = read_config(&handle).server_url;
            grant_server(&handle, &origin)?;
            app.set_menu(build_menu(&handle)?)?;
            app.on_menu_event(|app, event| {
                let _ = on_menu(app, event.id().as_ref());
            });
            let window = WindowBuilder::new(&handle, MAIN)
                .title("Midas")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .build()?;
            let resized = handle.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Resized(_) = event {
                    tabs::relayout(&resized);
                }
            });
            tabs::listen(&handle);
            tabs::init(&handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Midas desktop");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{cell::Cell, net::TcpListener};

    /// A port nothing listens on: bind one, then release it.
    fn closed_origin() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().expect("addr").port();
        drop(listener);
        format!("http://127.0.0.1:{port}")
    }

    #[test]
    fn connect_fails_on_an_unreachable_server_and_does_not_navigate() {
        let navigated = Cell::new(false);
        let result = connect_to(&closed_origin(), "/", |_| {
            navigated.set(true);
            Ok(())
        });
        assert!(result.is_err(), "expected an error, got {result:?}");
        assert!(result.unwrap_err().starts_with("Cannot reach the Midas server"));
        assert!(!navigated.get());
    }

    #[test]
    fn connect_navigates_the_tab_to_its_route_on_a_reachable_server() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let origin = format!("http://127.0.0.1:{}", listener.local_addr().expect("addr").port());
        let seen = std::cell::RefCell::new(None);
        let result = connect_to(&origin, "/file/abc?page=p1", |url| {
            *seen.borrow_mut() = Some(url.to_string());
            Ok(())
        });
        assert!(result.is_ok(), "expected success, got {result:?}");
        assert_eq!(seen.borrow().as_deref(), Some(format!("{origin}/file/abc?page=p1").as_str()));
    }

    #[test]
    fn config_is_read_with_or_without_a_byte_order_mark() {
        let plain = r#"{ "serverUrl": "http://127.0.0.1:5173" }"#;
        let with_bom = format!("\u{feff}{plain}");
        assert_eq!(parse_config(plain).expect("plain").server_url, "http://127.0.0.1:5173");
        assert_eq!(parse_config(&with_bom).expect("bom").server_url, "http://127.0.0.1:5173");
        assert!(parse_config("not json").is_none());
        assert!(parse_config(r#"{ "serverUrl": "ftp://nope" }"#).is_none());
    }

    #[test]
    fn origin_keeps_scheme_host_and_port_only() {
        assert_eq!(normalize_origin("http://127.0.0.1:4000/some/path?x=1").unwrap(), "http://127.0.0.1:4000");
        assert!(normalize_origin("ftp://127.0.0.1").is_err());
    }
}
