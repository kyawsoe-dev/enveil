use std::collections::BTreeMap;
use std::sync::Mutex;

use crate::error::VaultError;
use crate::models::diff;
use crate::models::{DiffResult, Project, Vault};
use crate::storage::{delete_vault_file, load_vault, save_vault};

pub struct AppState(pub Mutex<Option<Vault>>);

#[tauri::command]
pub fn initialize_vault(
    state: tauri::State<AppState>,
    password: String,
) -> Result<(), String> {
    if password.is_empty() {
        return Err("Password must not be empty".into());
    }

    let vault = Vault::new();
    save_vault(&vault, &password).map_err(|e| e.to_string())?;

    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    *inner = Some(vault);
    Ok(())
}

#[tauri::command]
pub fn unlock_vault(
    state: tauri::State<AppState>,
    password: String,
) -> Result<Vault, String> {
    if password.is_empty() {
        return Err("Password must not be empty".into());
    }

    let vault = load_vault(&password).map_err(|e| match e {
        VaultError::Aead => "Invalid password or corrupted vault".to_string(),
        VaultError::NotInitialized => {
            "Vault not initialized. Create a new vault first.".to_string()
        }
        other => other.to_string(),
    })?;

    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    *inner = Some(vault.clone());
    Ok(vault)
}

#[tauri::command]
pub fn save_project(
    state: tauri::State<AppState>,
    password: String,
    project: Project,
) -> Result<(), String> {
    if password.is_empty() {
        return Err("Password must not be empty".into());
    }

    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_mut().ok_or_else(|| {
        "Vault is not unlocked. Call unlock_vault first.".to_string()
    })?;

    vault.upsert_project(project);
    save_vault(vault, &password).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_project(
    state: tauri::State<AppState>,
    password: String,
    project_id: String,
) -> Result<(), String> {
    if password.is_empty() {
        return Err("Password must not be empty".into());
    }

    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_mut().ok_or_else(|| {
        "Vault is not unlocked. Call unlock_vault first.".to_string()
    })?;

    vault.remove_project(&project_id).ok_or_else(|| format!("Project '{}' not found", project_id))?;
    save_vault(vault, &password).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn diff_projects(
    state: tauri::State<AppState>,
    project_a_id: String,
    project_b_id: String,
) -> Result<DiffResult, String> {
    let inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_ref().ok_or_else(|| {
        "Vault is not unlocked. Call unlock_vault first.".to_string()
    })?;

    let proj_a = vault
        .find_project(&project_a_id)
        .ok_or_else(|| format!("Project '{}' not found", project_a_id))?;
    let proj_b = vault
        .find_project(&project_b_id)
        .ok_or_else(|| format!("Project '{}' not found", project_b_id))?;

    Ok(diff::diff_projects(proj_a, proj_b))
}

#[tauri::command]
pub fn reset_vault(state: tauri::State<AppState>) -> Result<(), String> {
    delete_vault_file().map_err(|e| e.to_string())?;
    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    *inner = None;
    Ok(())
}

#[tauri::command]
pub fn vault_exists() -> Result<bool, String> {
    Ok(crate::storage::vault_file::vault_path()
        .map(|p| p.exists())
        .unwrap_or(false))
}

#[tauri::command]
pub fn change_password(
    state: tauri::State<AppState>,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let vault = load_vault(&old_password).map_err(|e| e.to_string())?;
    save_vault(&vault, &new_password).map_err(|e| e.to_string())?;

    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    *inner = Some(vault);
    Ok(())
}

#[tauri::command]
pub fn run_command(
    state: tauri::State<AppState>,
    command: String,
    project_id: String,
) -> Result<String, String> {
    let inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_ref().ok_or("Vault is not unlocked")?;
    let project = vault
        .find_project(&project_id)
        .ok_or_else(|| format!("Project not found: {}", project_id))?;

    let envs: BTreeMap<String, String> = project.env_vars.clone();

    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&command)
        .envs(&envs)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let combined = if stderr.is_empty() {
        stdout
    } else {
        format!("{}{}", stdout, stderr)
    };

    if !output.status.success() {
        return Err(format!(
            "Command exited with code {}:\n{}",
            output.status.code().unwrap_or(-1),
            combined,
        ));
    }

    Ok(combined)
}
