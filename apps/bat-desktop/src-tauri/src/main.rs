// BAT Cowork window process. No updater, no agent sidecar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    bat_cowork_lib::run()
}
