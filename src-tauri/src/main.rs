#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod error;
mod models;
mod storage;

use commands::vault_commands::AppState;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(None)))
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
