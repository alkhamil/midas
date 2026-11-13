//! Tabs of the main window. The window holds one bundled strip (`chrome`) and one webview per tab, all children
//! of the window; only the active tab's webview is shown. A document tab is a webview on the Midas server at its
//! route; a Play tab is one on the same server that starts Play. Tab webviews are remote pages: they get the
//! server's capabilities (`grant_server`) and share the one WebView2 session, so the sign-in cookie is shared.
//!
//! Every change runs on one worker thread (`submit`). `add_child` waits for the main thread, so it must not run on
//! the main thread or while the state lock is held; the public functions here only queue work.

use std::{
    fs,
    path::PathBuf,
    sync::{mpsc, Mutex, OnceLock},
    thread,
};

use serde::{Deserialize, Serialize};
use tauri::{
    webview::WebviewBuilder, AppHandle, Emitter, EventTarget, Listener, LogicalPosition, LogicalSize, Manager,
    WebviewUrl,
};

use crate::{parse_url, read_config, reachable, MAIN};

pub const CHROME: &str = "chrome";
pub const STRIP: f64 = 40.0;
const UNREACHABLE_PAGE: &str = "server.html";
const CHROME_PAGE: &str = "chrome.html";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    /// The webview label: `tab-<n>` for a document, `play-<n>` for a Play tab.
    pub id: String,
    pub play: bool,
    /// For a Play tab: the tab it was opened from, which gets the focus back when Play closes.
    pub source: Option<String>,
    /// Path and query on the server, for example `/file/<id>?page=…`.
    pub route: String,
    pub title: String,
    #[serde(default)]
    pub unsaved: bool,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Saved {
    pub tabs: Vec<Tab>,
    pub active: Option<String>,
}

/// Shared state, managed by the app as `Mutex<Model>`. Never held across a webview operation.
pub struct Model {
    saved: Saved,
    next: u32,
}

type Op = Box<dyn FnOnce(&AppHandle) + Send>;
static WORKER: OnceLock<mpsc::Sender<Op>> = OnceLock::new();

fn submit(op: impl FnOnce(&AppHandle) + Send + 'static) {
    if let Some(sender) = WORKER.get() {
        let _ = sender.send(Box::new(op));
    }
}

fn snapshot(app: &AppHandle) -> Saved {
    app.state::<Mutex<Model>>().lock().map(|m| m.saved.clone()).unwrap_or_default()
}

/// The tab a webview label belongs to, for the server's commands (connect) that run inside a tab.
pub fn route_of(app: &AppHandle, label: &str) -> Option<String> {
    snapshot(app).tabs.into_iter().find(|t| t.id == label).map(|t| t.route)
}

pub fn active_label(app: &AppHandle) -> Option<String> {
    snapshot(app).active
}

pub fn is_tab_command(id: &str) -> bool {
    matches!(id, "tab-new" | "tab-close" | "tab-next" | "tab-prev") || jump_number(id).is_some()
}

fn jump_number(id: &str) -> Option<usize> {
    id.strip_prefix("tab-")?.parse::<usize>().ok().filter(|n| (1..=9).contains(n))
}

/// Starts the worker and restores the saved tabs. Called once from setup, after the main window exists.
pub fn init(app: &AppHandle) {
    app.manage(Mutex::new(Model { saved: Saved::default(), next: 0 }));
    let (sender, receiver) = mpsc::channel::<Op>();
    let _ = WORKER.set(sender);
    let worker_app = app.clone();
    thread::spawn(move || {
        for op in receiver {
            op(&worker_app);
        }
    });
    submit(restore);
}

/// The tab strip and every tab fill the window below the strip.
pub fn relayout(app: &AppHandle) {
    let Some((width, height)) = content_size(app) else { return };
    if let Some(chrome) = app.get_webview(CHROME) {
        let _ = chrome.set_position(LogicalPosition::new(0.0, 0.0));
        let _ = chrome.set_size(LogicalSize::new(width, STRIP));
    }
    for tab in snapshot(app).tabs {
        if let Some(view) = app.get_webview(&tab.id) {
            let _ = view.set_position(LogicalPosition::new(0.0, STRIP));
            let _ = view.set_size(LogicalSize::new(width, (height - STRIP).max(1.0)));
        }
    }
}

/// Runs a tab command: `tab-new`, `tab-close`, `tab-next`, `tab-prev` or `tab-1`..`tab-9`.
pub fn command(action: &str) {
    let action = action.to_string();
    submit(move |app| match action.as_str() {
        "tab-new" => {
            let _ = create(app, "/", false, None, "Midas");
        }
        "tab-close" => {
            if let Some(id) = snapshot(app).active {
                close(app, &id);
            }
        }
        "tab-next" => cycle(app, 1),
        "tab-prev" => cycle(app, -1),
        other => {
            if let Some(n) = jump_number(other) {
                jump(app, n);
            }
        }
    });
}

/// Play: focuses the Play tab of this document when it is open (reloaded, so it shows the saved copy), else
/// opens one next to the source tab. The editor flushes its saves before it asks.
pub fn open_play(route: &str) {
    let route = route.to_string();
    submit(move |app| {
        let key = path_of(&route);
        let (existing, source) = {
            let model = app.state::<Mutex<Model>>();
            let Ok(m) = model.lock() else { return };
            let existing = m.saved.tabs.iter().find(|t| t.play && path_of(&t.route) == key).map(|t| t.id.clone());
            (existing, m.saved.active.clone())
        };
        match existing {
            Some(id) => {
                if let Some(view) = app.get_webview(&id) {
                    if let Ok(url) = tab_url(app, &route).and_then(|u| match u {
                        WebviewUrl::External(url) => Ok(url),
                        _ => Err("the server is not reachable".into()),
                    }) {
                        let _ = view.navigate(url);
                    }
                }
                set_route(app, &id, &route);
                activate(app, &id);
            }
            None => {
                let _ = create(app, &route, true, source, "Play");
            }
        }
    });
}

/// A tab page reports its name, unsaved edits and route (`midas:tab-state`).
pub fn record(label: &str, name: &str, unsaved: bool, route: &str) {
    let (label, name, route) = (label.to_string(), name.to_string(), route.to_string());
    submit(move |app| {
        let changed = {
            let model = app.state::<Mutex<Model>>();
            let Ok(mut m) = model.lock() else { return };
            let Some(tab) = m.saved.tabs.iter_mut().find(|t| t.id == label) else { return };
            let title = if tab.play { format!("Play: {name}") } else { name.clone() };
            let next = (title, unsaved, route.clone());
            let before = (tab.title.clone(), tab.unsaved, tab.route.clone());
            if before == next {
                false
            } else {
                tab.title = next.0;
                tab.unsaved = next.1;
                tab.route = next.2;
                true
            }
        };
        if changed {
            publish(app, &snapshot(app));
        }
    });
}

#[tauri::command]
pub fn tabs_state(app: AppHandle) -> Saved {
    snapshot(&app)
}

#[tauri::command]
pub fn tab_activate(id: String) {
    submit(move |app| activate(app, &id));
}

#[tauri::command]
pub fn tab_close(id: String) {
    submit(move |app| close(app, &id));
}

#[tauri::command]
pub fn tab_new() {
    submit(|app| {
        let _ = create(app, "/", false, None, "Midas");
    });
}

#[tauri::command]
pub fn tab_move(id: String, index: usize) {
    submit(move |app| move_to(app, &id, index));
}

/// Listens for the events the pages send: tab commands (keys, the strip), tab state and Play.
pub fn listen(app: &AppHandle) {
    app.listen_any("midas:tab-command", move |event| {
        if let Some(action) = field(event.payload(), "action") {
            command(&action);
        }
    });
    app.listen_any("midas:tab-state", move |event| {
        let label = field(event.payload(), "label");
        let name = field(event.payload(), "name").unwrap_or_default();
        let unsaved = payload_bool(event.payload(), "unsaved");
        let route = field(event.payload(), "route").unwrap_or_default();
        if let Some(label) = label {
            record(&label, &name, unsaved, &route);
        }
    });
    app.listen_any("midas:open-play", move |event| {
        let route = field(event.payload(), "route").unwrap_or_else(|| "/".into());
        open_play(&route);
    });
}

fn field(payload: &str, key: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(payload).ok()?.get(key)?.as_str().map(str::to_owned)
}

fn payload_bool(payload: &str, key: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(payload).ok().and_then(|v| v.get(key).and_then(|b| b.as_bool())).unwrap_or(false)
}

fn path_of(route: &str) -> &str {
    route.split('?').next().unwrap_or(route)
}

/// The tab after `index` (or before it, at the end) when the tab there closes; a Play tab goes back to its source.
pub fn next_after_close(tabs: &[Tab], index: usize, removed: &Tab) -> Option<String> {
    if removed.play {
        if let Some(source) = &removed.source {
            if tabs.iter().any(|t| &t.id == source) {
                return Some(source.clone());
            }
        }
    }
    if tabs.is_empty() {
        return None;
    }
    Some(tabs[index.min(tabs.len() - 1)].id.clone())
}

/// The next index of a cycle through `len` tabs from `current`.
pub fn cycle_index(len: usize, current: usize, delta: i64) -> usize {
    (current as i64 + delta).rem_euclid(len as i64) as usize
}

/// The index for Ctrl+n: 1 to 8 are the tabs in order; 9 is the last tab, as in browsers.
pub fn jump_index(len: usize, n: usize) -> Option<usize> {
    let index = if n == 9 { len.checked_sub(1)? } else { n.checked_sub(1)? };
    (index < len).then_some(index)
}

fn cycle(app: &AppHandle, delta: i64) {
    let saved = snapshot(app);
    if saved.tabs.is_empty() {
        return;
    }
    let current = saved.active.as_ref().and_then(|a| saved.tabs.iter().position(|t| &t.id == a)).unwrap_or(0);
    let next = cycle_index(saved.tabs.len(), current, delta);
    activate(app, &saved.tabs[next].id);
}

fn jump(app: &AppHandle, n: usize) {
    let saved = snapshot(app);
    if let Some(index) = jump_index(saved.tabs.len(), n) {
        activate(app, &saved.tabs[index].id);
    }
}

fn restore(app: &AppHandle) {
    let mut saved = load(app);
    if saved.tabs.is_empty() {
        saved.tabs.push(new_tab(format!("tab-{}", 1), false, None, "/", "Midas"));
    }
    let next = saved.tabs.iter().filter_map(|t| t.id.rsplit('-').next()?.parse::<u32>().ok()).max().unwrap_or(0);
    {
        let model = app.state::<Mutex<Model>>();
        if let Ok(mut m) = model.lock() {
            m.saved = saved.clone();
            m.next = next;
        }
    }
    if let Err(error) = add_child(app, CHROME, WebviewUrl::App(CHROME_PAGE.into())) {
        eprintln!("midas: tab strip: {error}");
    }
    for tab in &saved.tabs {
        let outcome = tab_url(app, &tab.route).and_then(|url| add_child(app, &tab.id, url));
        if let Err(error) = outcome {
            eprintln!("midas: tab {}: {error}", tab.id);
        }
    }
    let active = saved.active.clone().or_else(|| saved.tabs.first().map(|t| t.id.clone()));
    if let Some(active) = active {
        activate(app, &active);
    } else {
        publish(app, &snapshot(app));
    }
}

fn new_tab(id: String, play: bool, source: Option<String>, route: &str, title: &str) -> Tab {
    Tab { id, play, source, route: route.into(), title: title.into(), unsaved: false }
}

/// Adds a tab after its source (Play) or at the end, shows it, and returns its label.
fn create(app: &AppHandle, route: &str, play: bool, source: Option<String>, title: &str) -> Result<String, String> {
    let id = {
        let model = app.state::<Mutex<Model>>();
        let mut m = model.lock().map_err(|e| e.to_string())?;
        m.next += 1;
        format!("{}-{}", if play { "play" } else { "tab" }, m.next)
    };
    let tab = new_tab(id.clone(), play, source.clone(), route, title);
    {
        let model = app.state::<Mutex<Model>>();
        let mut m = model.lock().map_err(|e| e.to_string())?;
        let at = source
            .as_ref()
            .and_then(|s| m.saved.tabs.iter().position(|t| &t.id == s).map(|i| i + 1))
            .unwrap_or(m.saved.tabs.len());
        m.saved.tabs.insert(at, tab);
    }
    let added = tab_url(app, route).and_then(|url| add_child(app, &id, url));
    if let Err(error) = added {
        remove_record(app, &id);
        return Err(error);
    }
    activate(app, &id);
    Ok(id)
}

fn remove_record(app: &AppHandle, id: &str) {
    let model = app.state::<Mutex<Model>>();
    if let Ok(mut m) = model.lock() {
        m.saved.tabs.retain(|t| t.id != id);
    }
}

fn set_route(app: &AppHandle, id: &str, route: &str) {
    let model = app.state::<Mutex<Model>>();
    if let Ok(mut m) = model.lock() {
        if let Some(tab) = m.saved.tabs.iter_mut().find(|t| t.id == id) {
            tab.route = route.into();
        }
    }
}

/// Shows `id`, hides the other tabs, focuses it and publishes the state.
fn activate(app: &AppHandle, id: &str) {
    let saved = {
        let model = app.state::<Mutex<Model>>();
        let Ok(mut m) = model.lock() else { return };
        if !m.saved.tabs.iter().any(|t| t.id == id) {
            return;
        }
        m.saved.active = Some(id.into());
        m.saved.clone()
    };
    for tab in &saved.tabs {
        if let Some(view) = app.get_webview(&tab.id) {
            let _ = if tab.id == id { view.show() } else { view.hide() };
        }
    }
    if let Some(view) = app.get_webview(id) {
        let _ = view.set_focus();
    }
    publish(app, &saved);
}

fn close(app: &AppHandle, id: &str) {
    let (removed, next, blank) = {
        let model = app.state::<Mutex<Model>>();
        let Ok(mut m) = model.lock() else { return };
        let Some(index) = m.saved.tabs.iter().position(|t| t.id == id) else { return };
        let removed = m.saved.tabs.remove(index);
        let was_active = m.saved.active.as_deref() == Some(id);
        let next = if was_active { next_after_close(&m.saved.tabs, index, &removed) } else { m.saved.active.clone() };
        (removed, next, m.saved.tabs.is_empty())
    };
    if let Some(view) = app.get_webview(&removed.id) {
        let _ = view.close();
    }
    if blank {
        // The last tab closing shows the file browser (the server's home), not an empty window.
        let _ = create(app, "/", false, None, "Midas");
    } else if let Some(next) = next {
        activate(app, &next);
    }
}

fn move_to(app: &AppHandle, id: &str, index: usize) {
    let saved = {
        let model = app.state::<Mutex<Model>>();
        let Ok(mut m) = model.lock() else { return };
        let Some(from) = m.saved.tabs.iter().position(|t| t.id == id) else { return };
        let tab = m.saved.tabs.remove(from);
        let at = index.min(m.saved.tabs.len());
        m.saved.tabs.insert(at, tab);
        m.saved.clone()
    };
    publish(app, &saved);
}

fn publish(app: &AppHandle, saved: &Saved) {
    persist(app, saved);
    let _ = app.emit_to(EventTarget::webview(CHROME), "tabs", saved);
    if let Some(window) = app.get_window(MAIN) {
        let title = saved
            .active
            .as_ref()
            .and_then(|id| saved.tabs.iter().find(|t| &t.id == id))
            .map(|t| format!("{}{} — Midas", if t.unsaved { "• " } else { "" }, t.title))
            .unwrap_or_else(|| "Midas".into());
        let _ = window.set_title(&title);
    }
}

fn content_size(app: &AppHandle) -> Option<(f64, f64)> {
    let window = app.get_window(MAIN)?;
    let scale = window.scale_factor().ok()?;
    let size = window.inner_size().ok()?;
    Some((size.width as f64 / scale, size.height as f64 / scale))
}

/// The address of a tab: the server at its route, or the unreachable page while the server does not answer.
fn tab_url(app: &AppHandle, route: &str) -> Result<WebviewUrl, String> {
    let origin = read_config(app).server_url;
    if reachable(&origin) {
        Ok(WebviewUrl::External(parse_url(&format!("{origin}{route}"))?))
    } else {
        Ok(WebviewUrl::App(UNREACHABLE_PAGE.into()))
    }
}

fn add_child(app: &AppHandle, label: &str, url: WebviewUrl) -> Result<(), String> {
    let window = app.get_window(MAIN).ok_or("the main window is closed")?;
    let (width, height) = content_size(app).ok_or("the window has no size yet")?;
    let (at, size) = if label == CHROME {
        (LogicalPosition::new(0.0, 0.0), LogicalSize::new(width, STRIP))
    } else {
        (LogicalPosition::new(0.0, STRIP), LogicalSize::new(width, (height - STRIP).max(1.0)))
    };
    window.add_child(WebviewBuilder::new(label, url), at, size).map(|_| ()).map_err(|e| e.to_string())
}

fn persist(app: &AppHandle, saved: &Saved) {
    let Some(path) = tabs_file(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(text) = serde_json::to_string_pretty(saved) {
        let _ = fs::write(path, text);
    }
}

fn load(app: &AppHandle) -> Saved {
    tabs_file(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<Saved>(text.trim_start_matches('\u{feff}')).ok())
        .unwrap_or_default()
}

fn tabs_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("tabs.json"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tab(id: &str, play: bool, source: Option<&str>) -> Tab {
        new_tab(id.into(), play, source.map(str::to_owned), "/", id)
    }

    #[test]
    fn closing_a_play_tab_returns_to_its_source() {
        let tabs = vec![tab("tab-1", false, None), tab("play-2", true, Some("tab-1")), tab("tab-3", false, None)];
        assert_eq!(next_after_close(&tabs[..2], 1, &tabs[1]).as_deref(), Some("tab-1"));
    }

    #[test]
    fn closing_a_tab_moves_to_its_neighbour_then_the_last_one() {
        let tabs = vec![tab("tab-1", false, None), tab("tab-3", false, None)];
        let removed = tab("tab-2", false, None);
        assert_eq!(next_after_close(&tabs, 1, &removed).as_deref(), Some("tab-3"));
        assert_eq!(next_after_close(&tabs, 2, &removed).as_deref(), Some("tab-3"));
        assert_eq!(next_after_close(&[], 0, &removed), None);
    }

    #[test]
    fn a_play_tab_whose_source_is_gone_falls_back_to_a_neighbour() {
        let tabs = vec![tab("tab-3", false, None)];
        let removed = tab("play-2", true, Some("tab-1"));
        assert_eq!(next_after_close(&tabs, 0, &removed).as_deref(), Some("tab-3"));
    }

    #[test]
    fn cycling_wraps_both_ways() {
        assert_eq!(cycle_index(3, 2, 1), 0);
        assert_eq!(cycle_index(3, 0, -1), 2);
        assert_eq!(cycle_index(3, 1, 1), 2);
    }

    #[test]
    fn ctrl_digit_jumps_to_the_tab_and_nine_is_the_last() {
        assert_eq!(jump_index(4, 1), Some(0));
        assert_eq!(jump_index(4, 4), Some(3));
        assert_eq!(jump_index(4, 5), None);
        assert_eq!(jump_index(4, 9), Some(3));
        assert_eq!(jump_index(0, 9), None);
    }

    #[test]
    fn tab_command_ids_are_recognised() {
        for id in ["tab-new", "tab-close", "tab-next", "tab-prev", "tab-1", "tab-9"] {
            assert!(is_tab_command(id), "{id}");
        }
        for id in ["tab-0", "tab-10", "tab-x", "save", "play"] {
            assert!(!is_tab_command(id), "{id}");
        }
    }

    #[test]
    fn a_play_route_is_matched_by_its_path_not_its_query() {
        assert_eq!(path_of("/file/abc?page=p1"), "/file/abc");
        assert_eq!(path_of("/"), "/");
    }

    #[test]
    fn saved_tabs_round_trip_with_the_active_tab() {
        let saved = Saved { tabs: vec![tab("tab-1", false, None), tab("play-2", true, Some("tab-1"))], active: Some("play-2".into()) };
        let text = serde_json::to_string(&saved).unwrap();
        let back: Saved = serde_json::from_str(&text).unwrap();
        assert_eq!(back, saved);
    }

    #[test]
    fn a_saved_file_with_a_byte_order_mark_is_read() {
        let text = format!("\u{feff}{}", r#"{"tabs":[],"active":null}"#);
        let parsed: Saved = serde_json::from_str(text.trim_start_matches('\u{feff}')).unwrap();
        assert!(parsed.tabs.is_empty());
    }
}
