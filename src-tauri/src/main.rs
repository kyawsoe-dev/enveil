#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod error;
mod models;
mod network;
mod storage;

use commands::sync_commands::SyncAppState;
use commands::vault_commands::AppState;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(None)))
        .manage(SyncAppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::vault_commands::initialize_vault,
            commands::vault_commands::unlock_vault,
            commands::vault_commands::save_project,
            commands::vault_commands::diff_projects,
            commands::vault_commands::run_command,
            commands::vault_commands::vault_exists,
            commands::vault_commands::change_password,
            commands::vault_commands::delete_project,
            commands::vault_commands::reset_vault,
            commands::sync_commands::start_lan_sync,
            commands::sync_commands::stop_lan_sync,
            commands::sync_commands::get_peers,
            commands::sync_commands::get_sync_status,
            commands::sync_commands::sync_project_from_peer,
            commands::sync_commands::set_device_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
