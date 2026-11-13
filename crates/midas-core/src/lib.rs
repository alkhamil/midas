//! Midas core: the paint model and the stroke geometry. Pure Rust, no bindings (see `midas-wasm` for the WASM ones).
pub mod geom;
pub mod paint;
pub mod stroke;

/// The version of the core.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    #[test]
    fn version_is_the_crate_version() {
        assert_eq!(super::VERSION, "0.1.0");
    }
}
