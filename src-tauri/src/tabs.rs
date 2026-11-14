//! Tabs of the main window. The window holds one bundled title bar and tab strip (`chrome`) and one webview per
//! tab, all children of the window; only the active tab's webview is shown. The Home tab (`home`) is always first
//! and never closes: it is the file browser. A document tab is a webview on the Midas server at its route; a Play
//! tab is one on the same server that starts Play. Tab webviews are remote pages: they get the server's
//! capabilities (`grant_server`) and share the one WebView2 session, so the sign-in cookie is shared.
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
    webview::{Color, WebviewBuilder}, AppHandle, Emitter, EventTarget, Listener, LogicalPosition, LogicalSize, Manager,
    WebviewUrl,
};

use crate::{parse_url, read_config, reachable, MAIN};

pub const CHROME: &str = "chrome";
pub const HOME: &str = "home";
/// Height of the title bar and tab strip, in logical pixels.
pub const STRIP: f64 = 36.0;
const UNREACHABLE_PAGE: &str = "server.html";
const CHROME_PAGE: &str = "chrome.html";
const MENU: &str = "tab-menu";
const MENU_PAGE: &str = "tabmenu.html";
/// The route of a new file tab: the studio home with the `#new-file` fragment, which the bridge answers by creating a file.
pub const NEW_FILE: &str = "/?new=1";
/// The menu command a new file tab gets from the shell: the page creates a file (the bridge runs New design file).
pub const NEW_FILE_COMMAND: &str = "new-file";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    /// The webview label: `home`, `tab-<n>` for a document, `play-<n>` for a Play tab.
    pub id: String,
    pub play: bool,
    /// For a Play tab: the tab it was opened from, which gets the focus back when Play closes.
    pub source: Option<String>,
    /// Path and query on the server, for example `/file/<id>?page=…`.
    pub route: String,
    pub title: String,
    #[serde(default)]
    pub unsaved: bool,
    /// A pinned tab is icon-only and stays at the left, after Home.
    #[serde(default)]
    pub pinned: bool,
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
    /// The tab whose context menu is open (the menu window reads it).
    menu_for: Option<String>,
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

fn jump_number(id: &str) -> Option<usize> {
    id.strip_prefix("tab-")?.parse::<usize>().ok().filter(|n| (1..=9).contains(n))
}

/// Starts the worker and restores the saved tabs. Called once from setup, after the main window exists.
pub fn init(app: &AppHandle) {
    app.manage(Mutex::new(Model { saved: Saved::default(), next: 0, menu_for: None }));
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

/// The title bar and tab strip span the top of the window; the tabs fill the window below them.
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

/// Runs a tab command: `tab-new`, `tab-close`, `tab-next`, `tab-prev`, `tab-1`..`tab-9`, or `quit`.
pub fn command(action: &str) {
    let action = action.to_string();
    submit(move |app| match action.as_str() {
        "tab-new" => {
            let _ = create(app, NEW_FILE, false, None, "New file");
        }
        "tab-close" => {
            if let Some(id) = snapshot(app).active {
                close(app, &id);
            }
        }
        "tab-next" => cycle(app, 1),
        "tab-prev" => cycle(app, -1),
        "quit" => app.exit(0),
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
                    if let Ok(WebviewUrl::External(url)) = tab_url(app, &route) {
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
        if label == HOME && route.starts_with("/file/") {
            open_from_home(app, &route, &name);
            return;
        }
        // A new file tab reports once it is up: that first report asks the page for a new file (once).
        let (changed, asks_new_file) = {
            let model = app.state::<Mutex<Model>>();
            let Ok(mut m) = model.lock() else { return };
            let Some(tab) = m.saved.tabs.iter_mut().find(|t| t.id == label) else { return };
            let asks_new_file = tab.route == NEW_FILE;
            let title = title_for(tab.play, tab.id == HOME, &route, &name);
            let before = (tab.title.clone(), tab.unsaved, tab.route.clone());
            let after = (title, unsaved && route.starts_with("/file/"), route.clone());
            if before == after {
                (false, asks_new_file)
            } else {
                tab.title = after.0;
                tab.unsaved = after.1;
                tab.route = after.2;
                (true, asks_new_file)
            }
        };
        if asks_new_file {
            let _ = app.emit_to(EventTarget::webview(label.clone()), "menu", NEW_FILE_COMMAND.to_string());
        }
        if changed {
            publish(app, &snapshot(app));
        }
    });
}

/// Home stays the file browser: a file opened from it gets its own tab, or the tab that already has it, and the Home
/// tab goes back to the list.
fn open_from_home(app: &AppHandle, route: &str, name: &str) {
    if let (Some(home), Ok(WebviewUrl::External(list))) = (app.get_webview(HOME), tab_url(app, "/")) {
        let _ = home.navigate(list);
    }
    let existing = {
        let model = app.state::<Mutex<Model>>();
        let Ok(m) = model.lock() else { return };
        m.saved.tabs.iter().find(|t| !t.play && t.id != HOME && path_of(&t.route) == path_of(route)).map(|t| t.id.clone())
    };
    match existing {
        Some(id) => activate(app, &id),
        None => {
            let _ = create(app, route, false, None, name);
        }
    }
}

/// The label a tab shows: Home is "Home", a new file tab is "New file", a Play tab "Play: <file>", and a
/// document its own name.
fn title_for(play: bool, home: bool, route: &str, name: &str) -> String {
    if home {
        "Home".into()
    } else if play {
        format!("Play: {name}")
    } else if !route.starts_with("/file/") {
        "New file".into()
    } else {
        name.to_string()
    }
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
        let _ = create(app, NEW_FILE, false, None, "New file");
    });
}

#[tauri::command]
pub fn tab_move(id: String, index: usize) {
    submit(move |app| move_to(app, &id, index));
}

#[tauri::command]
pub fn tab_pin(id: String, pinned: bool) {
    submit(move |app| set_pinned(app, &id, pinned));
}

#[tauri::command]
pub fn tab_reload(id: String) {
    submit(move |app| {
        if let Some(view) = app.get_webview(&id) {
            let _ = view.reload();
        }
    });
}

#[tauri::command]
pub fn tab_close_others(id: String) {
    submit(move |app| {
        let others: Vec<String> = snapshot(app).tabs.into_iter().filter(|t| t.id != id && t.id != HOME).map(|t| t.id).collect();
        for other in others {
            close(app, &other);
        }
        activate(app, &id);
    });
}

#[tauri::command]
pub fn tab_close_all() {
    submit(|app| {
        let all: Vec<String> = snapshot(app).tabs.into_iter().filter(|t| t.id != HOME).map(|t| t.id).collect();
        for id in all {
            close(app, &id);
        }
        activate(app, HOME);
    });
}

/// Rename File on a document tab: the tab shows the document, and its editor runs the rename.
/// The context menu of a tab opens as its own small window at the pointer (a child webview cannot draw outside the
/// title bar). It reads its tab with `tab_menu_target`, and closes when it loses focus.
#[tauri::command]
pub fn tab_menu_open(id: String, x: f64, y: f64) {
    submit(move |app| {
        if let Ok(mut m) = app.state::<Mutex<Model>>().lock() {
            m.menu_for = Some(id);
        }
        if let Err(error) = open_menu_window(app, x, y) {
            eprintln!("midas: tab menu: {error}");
        }
    });
}

#[tauri::command]
pub fn tab_menu_target(app: AppHandle) -> Option<Tab> {
    let model = app.state::<Mutex<Model>>();
    let m = model.lock().ok()?;
    let id = m.menu_for.clone()?;
    m.saved.tabs.iter().find(|t| t.id == id).cloned()
}

fn open_menu_window(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    use tauri::{LogicalPosition as Pos, WebviewWindowBuilder};
    if let Some(old) = app.get_webview_window(MENU) {
        let _ = old.close();
    }
    let window = app.get_window(MAIN).ok_or("the main window is closed")?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let origin = window.inner_position().map_err(|e| e.to_string())?;
    let at = Pos::new(origin.x as f64 / scale + x, origin.y as f64 / scale + y);
    WebviewWindowBuilder::new(app, MENU, WebviewUrl::App(MENU_PAGE.into()))
        .title("Tab menu")
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(232.0, 236.0)
        .position(at.x, at.y)
        .focused(true)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tab_rename(id: String) {
    submit(move |app| {
        activate(app, &id);
        let _ = app.emit_to(EventTarget::webview(id), "menu", "rename-file".to_string());
    });
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

/// The tab that takes the focus when `removed` (at `index`) closes: a Play tab goes back to its source; otherwise
/// the tab on the right, or the one on the left at the end. Home is never removed, so the list is never empty.
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

/// The order of the strip: Home first, then the pinned tabs, then the rest. Each group keeps its order.
pub fn zone_order(tabs: Vec<Tab>) -> Vec<Tab> {
    let mut home = Vec::new();
    let mut pinned = Vec::new();
    let mut rest = Vec::new();
    for tab in tabs {
        if tab.id == HOME {
            home.push(tab);
        } else if tab.pinned {
            pinned.push(tab);
        } else {
            rest.push(tab);
        }
    }
    home.into_iter().chain(pinned).chain(rest).collect()
}

/// Moves `id` to `index` inside its own zone: Home never moves, and a pinned tab stays among the pinned tabs.
pub fn place(tabs: Vec<Tab>, id: &str, index: usize) -> Vec<Tab> {
    let Some(moved) = tabs.iter().find(|t| t.id == id).cloned() else { return tabs };
    if moved.id == HOME {
        return tabs;
    }
    let mut pinned = Vec::new();
    let mut rest = Vec::new();
    for tab in tabs.iter().filter(|t| t.id != HOME && t.id != id) {
        if tab.pinned {
            pinned.push(tab.clone());
        } else {
            rest.push(tab.clone());
        }
    }
    let zone = if moved.pinned { &mut pinned } else { &mut rest };
    zone.insert(index.min(zone.len()), moved);
    tabs.iter().filter(|t| t.id == HOME).cloned().chain(pinned).chain(rest).collect()
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

/// The tabs as restored: exactly one Home, first. A file browser tab saved before Home was fixed (route "/") and a
/// new-file tab that never got its file (route NEW_FILE, which would ask for one again on every start) are dropped;
/// Play tabs stay.
pub fn restored_tabs(tabs: Vec<Tab>) -> Vec<Tab> {
    let mut tabs: Vec<Tab> = tabs.into_iter().filter(|t| t.id == HOME || t.play || (t.route != "/" && t.route != NEW_FILE)).collect();
    if !tabs.iter().any(|t| t.id == HOME) {
        tabs.insert(0, new_tab(HOME.into(), false, None, "/", "Home"));
    }
    zone_order(tabs)
}

fn restore(app: &AppHandle) {
    let mut saved = load(app);
    saved.tabs = restored_tabs(std::mem::take(&mut saved.tabs));
    let next = saved.tabs.iter().filter_map(|t| t.id.rsplit('-').next()?.parse::<u32>().ok()).max().unwrap_or(0);
    {
        let model = app.state::<Mutex<Model>>();
        if let Ok(mut m) = model.lock() {
            m.saved = saved.clone();
            m.next = next;
        }
    }
    if let Err(error) = add_child(app, CHROME, WebviewUrl::App(CHROME_PAGE.into())) {
        eprintln!("midas: title bar: {error}");
    }
    for tab in &saved.tabs {
        let outcome = tab_url(app, &tab.route).and_then(|url| add_child(app, &tab.id, url));
        if let Err(error) = outcome {
            eprintln!("midas: tab {}: {error}", tab.id);
        }
    }
    let active = saved.active.clone().filter(|a| saved.tabs.iter().any(|t| &t.id == a)).unwrap_or_else(|| HOME.into());
    activate(app, &active);
}

fn new_tab(id: String, play: bool, source: Option<String>, route: &str, title: &str) -> Tab {
    Tab { id, play, source, route: route.into(), title: title.into(), unsaved: false, pinned: false }
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
    // Hide the tabs first: a new webview is shown as soon as it is made, so the page that was showing (Home) would
    // flash over it until activate() hides it.
    for shown in snapshot(app).tabs {
        if let Some(view) = app.get_webview(&shown.id) {
            let _ = view.hide();
        }
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
    if id == HOME {
        return;
    }
    let (removed, next) = {
        let model = app.state::<Mutex<Model>>();
        let Ok(mut m) = model.lock() else { return };
        let Some(index) = m.saved.tabs.iter().position(|t| t.id == id) else { return };
        let removed = m.saved.tabs.remove(index);
        let was_active = m.saved.active.as_deref() == Some(id);
        let next = if was_active { next_after_close(&m.saved.tabs, index, &removed) } else { m.saved.active.clone() };
        (removed, next)
    };
    if let Some(view) = app.get_webview(&removed.id) {
        let _ = view.close();
    }
    let next = next.unwrap_or_else(|| HOME.into());
    activate(app, &next);
}

fn move_to(app: &AppHandle, id: &str, index: usize) {
    let saved = {
        let model = app.state::<Mutex<Model>>();
        let Ok(mut m) = model.lock() else { return };
        let tabs = std::mem::take(&mut m.saved.tabs);
        m.saved.tabs = place(tabs, id, index);
        m.saved.clone()
    };
    publish(app, &saved);
}

fn set_pinned(app: &AppHandle, id: &str, pinned: bool) {
    let saved = {
        let model = app.state::<Mutex<Model>>();
        let Ok(mut m) = model.lock() else { return };
        if id == HOME {
            return;
        }
        let Some(tab) = m.saved.tabs.iter_mut().find(|t| t.id == id) else { return };
        tab.pinned = pinned;
        let tabs = std::mem::take(&mut m.saved.tabs);
        m.saved.tabs = zone_order(tabs);
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
    // WebView2 paints white until a page draws, which showed as white boxes on every new tab, file and start-up.
    // A page that has not drawn yet takes the window's colour (the bar, main.rs), so there is no seam between them.
    let builder = WebviewBuilder::new(label, url).background_color(Color(0x16, 0x16, 0x18, 0xff));
    window.add_child(builder, at, size).map(|_| ()).map_err(|e| e.to_string())
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
        new_tab(id.into(), play, source.map(str::to_owned), "/file/x", id)
    }

    fn pinned(mut t: Tab) -> Tab {
        t.pinned = true;
        t
    }

    fn ids(tabs: &[Tab]) -> Vec<&str> {
        tabs.iter().map(|t| t.id.as_str()).collect()
    }

    #[test]
    fn closing_a_play_tab_returns_to_its_source() {
        let tabs = vec![tab(HOME, false, None), tab("tab-1", false, None), tab("play-2", true, Some("tab-1"))];
        assert_eq!(next_after_close(&tabs[..2], 2, &tabs[2]).as_deref(), Some("tab-1"));
    }

    #[test]
    fn closing_a_tab_moves_to_its_right_neighbour_or_the_left_one_at_the_end() {
        let tabs = vec![tab(HOME, false, None), tab("tab-1", false, None), tab("tab-3", false, None)];
        let removed = tab("tab-2", false, None);
        assert_eq!(next_after_close(&tabs, 2, &removed).as_deref(), Some("tab-3"));
        assert_eq!(next_after_close(&tabs, 9, &removed).as_deref(), Some("tab-3"));
        assert_eq!(next_after_close(&[], 0, &removed), None);
    }

    #[test]
    fn a_play_tab_whose_source_is_gone_falls_back_to_a_neighbour() {
        let tabs = vec![tab(HOME, false, None), tab("tab-3", false, None)];
        let removed = tab("play-2", true, Some("tab-1"));
        assert_eq!(next_after_close(&tabs, 1, &removed).as_deref(), Some("tab-3"));
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
    fn a_play_route_is_matched_by_its_path_not_its_query() {
        assert_eq!(path_of("/file/abc?page=p1"), "/file/abc");
        assert_eq!(path_of("/"), "/");
    }

    #[test]
    fn strip_order_is_home_then_pinned_then_the_rest() {
        let tabs = vec![tab("tab-1", false, None), pinned(tab("tab-2", false, None)), tab(HOME, false, None)];
        assert_eq!(ids(&zone_order(tabs)), vec![HOME, "tab-2", "tab-1"]);
    }

    #[test]
    fn home_never_moves_and_nothing_moves_in_front_of_it() {
        let tabs = vec![tab(HOME, false, None), tab("tab-1", false, None), tab("tab-2", false, None)];
        assert_eq!(ids(&place(tabs.clone(), HOME, 2)), ids(&tabs));
        assert_eq!(ids(&place(tabs, "tab-2", 0)), vec![HOME, "tab-2", "tab-1"]);
    }

    #[test]
    fn a_pinned_tab_stays_among_the_pinned_tabs() {
        let tabs = vec![tab(HOME, false, None), pinned(tab("tab-1", false, None)), pinned(tab("tab-2", false, None)), tab("tab-3", false, None)];
        // Moving an unpinned tab to the front does not put it before the pinned ones.
        assert_eq!(ids(&place(tabs.clone(), "tab-3", 0)), vec![HOME, "tab-1", "tab-2", "tab-3"]);
        // A pinned tab moves within the pinned zone only.
        assert_eq!(ids(&place(tabs, "tab-2", 0)), vec![HOME, "tab-2", "tab-1", "tab-3"]);
    }

    #[test]
    fn restore_keeps_one_home_first_and_drops_old_file_browser_tabs() {
        let mut old_browser = tab("tab-2", false, None);
        old_browser.route = "/".into();
        let mut new_file = tab("tab-3", false, None);
        new_file.route = NEW_FILE.into();
        let tabs = vec![old_browser, new_file, tab("tab-4", false, None)];
        let restored = restored_tabs(tabs);
        assert_eq!(ids(&restored), vec![HOME, "tab-4"]);
        assert_eq!(restored.iter().filter(|t| t.id == HOME).count(), 1);
    }

    #[test]
    fn restore_never_has_two_homes() {
        let mut home = tab(HOME, false, None);
        home.route = "/".into();
        let restored = restored_tabs(vec![home, tab("tab-1", false, None)]);
        assert_eq!(restored.iter().filter(|t| t.id == HOME).count(), 1);
        assert_eq!(restored[0].id, HOME);
    }

    #[test]
    fn titles_follow_the_kind_of_tab() {
        assert_eq!(title_for(false, true, "/", "anything"), "Home");
        assert_eq!(title_for(false, false, NEW_FILE, "Midas"), "New file");
        assert_eq!(title_for(false, false, "/file/x", "Hero"), "Hero");
        assert_eq!(title_for(true, false, "/file/x", "Hero"), "Play: Hero");
    }

    #[test]
    fn saved_tabs_round_trip_with_the_active_tab() {
        let saved = Saved { tabs: vec![tab(HOME, false, None), tab("play-2", true, Some(HOME))], active: Some("play-2".into()) };
        let text = serde_json::to_string(&saved).unwrap();
        let back: Saved = serde_json::from_str(&text).unwrap();
        assert_eq!(back, saved);
    }

    #[test]
    fn a_saved_file_from_before_pins_and_home_still_loads() {
        let text = r#"{"tabs":[{"id":"tab-1","play":false,"source":null,"route":"/","title":"Midas"}],"active":"tab-1"}"#;
        let parsed: Saved = serde_json::from_str(text).unwrap();
        assert!(!parsed.tabs[0].pinned);
    }
}
