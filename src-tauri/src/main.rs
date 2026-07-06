#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod error;
mod models;
mod network;
mod storage;

use commands::sync_commands::SyncAppState;
use commands::vault_commands::{AppState, TempEnvState, TerminalState};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

fn main() {
    tauri::Builder::default()
        .manage(AppState(Arc::new(Mutex::new(None))))
        .manage(TempEnvState(Mutex::new(HashMap::new())))
        .manage(TerminalState::default())
        .manage(SyncAppState::new())
        .on_window_event(|event| {
            let drop_info = match event.event() {
                tauri::WindowEvent::FileDrop(e) => e,
                _ => return,
            };
            let (type_str, file_paths) = match &drop_info {
                tauri::FileDropEvent::Hovered(paths) => ("hovered", paths),
                tauri::FileDropEvent::Dropped(paths) => ("dropped", paths),
                tauri::FileDropEvent::Cancelled => return,
                _ => return,
            };
            let paths: Vec<String> =
                file_paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
            let payload = serde_json::json!({
                "type": type_str,
                "paths": paths,
            });
            let _ = event.window().emit("file-drop-internal", payload);
        })
        .invoke_handler(tauri::generate_handler![
            commands::ai_commands::get_ai_config,
            commands::ai_commands::call_ai,
            commands::ai_commands::generate_env_template,
            commands::ai_commands::validate_env_vars,
            commands::ai_commands::generate_env_docstrings,
            commands::ai_commands::explain_diff,
            commands::ai_commands::suggest_project,
            commands::ai_commands::suggest_env_var,
            commands::vault_commands::initialize_vault,
            commands::vault_commands::unlock_vault,
            commands::vault_commands::save_project,
            commands::vault_commands::diff_projects,
            commands::vault_commands::run_command,
            commands::vault_commands::run_command_stream,
            commands::vault_commands::stop_command,
            commands::vault_commands::vault_exists,
            commands::vault_commands::change_password,
            commands::vault_commands::delete_project,
            commands::vault_commands::reset_vault,
            commands::vault_commands::get_vault,
            commands::vault_commands::get_temp_env_status,
            commands::vault_commands::generate_temp_env,
            commands::vault_commands::regenerate_temp_env,
            commands::vault_commands::delete_temp_env,
            commands::vault_commands::cleanup_all_temp_envs,
            commands::vault_commands::open_folder,
            commands::vault_commands::open_in_terminal,
            commands::vault_commands::generate_env_example,
            commands::vault_commands::diff_project_with_file,
            commands::vault_commands::get_project_history,
            commands::vault_commands::restore_snapshot,
            commands::vault_commands::kill_process_on_port,
            commands::vault_commands::export_vault,
            commands::vault_commands::import_vault,
            commands::vault_commands::read_env_file,
            commands::vault_commands::get_app_version,
            commands::sync_commands::start_lan_sync,
            commands::sync_commands::stop_lan_sync,
            commands::sync_commands::get_peers,
            commands::sync_commands::get_sync_status,
            commands::sync_commands::sync_project_from_peer,
            commands::sync_commands::set_device_name,
            commands::sync_commands::get_peer_projects,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
