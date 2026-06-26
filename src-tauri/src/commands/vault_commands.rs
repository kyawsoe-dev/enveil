use std::collections::{BTreeMap, HashMap};
use std::fs::Permissions;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use serde::Serialize;
use tauri::Manager;

use crate::error::VaultError;
use crate::models::diff;
use crate::models::{DiffResult, Project, Vault};
use crate::storage::{delete_vault_file, load_vault, save_vault};

pub struct TerminalState {
    pub pid: Mutex<Option<u32>>,
    pub cwds: Mutex<HashMap<String, PathBuf>>,
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            pid: Mutex::new(None),
            cwds: Mutex::new(HashMap::new()),
        }
    }
}

pub struct AppState(pub Arc<Mutex<Option<Vault>>>);

pub struct TempEnvInfo {
    pub temp_dir: PathBuf,
    pub symlink_path: Option<PathBuf>,
}

#[derive(Serialize)]
pub struct TempEnvStatus {
    pub temp_path: String,
    pub symlink_path: Option<String>,
}

pub struct TempEnvState(pub Mutex<HashMap<String, TempEnvInfo>>);

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
    terminal_state: tauri::State<TerminalState>,
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

    {
        let mut pid_guard = terminal_state.pid.lock().map_err(|e| e.to_string())?;
        if let Some(pid) = pid_guard.take() {
            #[cfg(unix)]
            {
                let _ = Command::new("kill")
                    .arg(pid.to_string())
                    .output();
            }
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .arg("/F")
                    .arg("/PID")
                    .arg(pid.to_string())
                    .output();
            }
        }
    }

    {
        let mut inner = state.0.lock().map_err(|e| e.to_string())?;
        *inner = Some(vault.clone());
    }
    Ok(vault)
}

#[tauri::command]
pub fn get_vault(
    state: tauri::State<AppState>,
) -> Result<Option<Vault>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
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

    if let Some(existing) = vault.find_project(&project.id) {
        if existing.env_vars != project.env_vars {
            let mut project_with_history = project;
            let mut history = existing.history.clone();
            let snapshot = crate::models::EnvSnapshot {
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
                label: format!("Before save on {}", chrono_now()),
                env_vars: existing.env_vars.clone(),
            };
            history.push(snapshot);
            if history.len() > 50 {
                history.remove(0);
            }
            project_with_history.history = history;
            vault.upsert_project(project_with_history);
        } else {
            vault.upsert_project(project);
        }
    } else {
        vault.upsert_project(project);
    }
    save_vault(vault, &password).map_err(|e| e.to_string())?;

    Ok(())
}

fn chrono_now() -> String {
    #[cfg(target_os = "windows")]
    {
        // Fallback: use a simple timestamp format
        use std::time::{SystemTime, UNIX_EPOCH};
        let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
        format!("{}", d.as_secs())
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Use the `date` command as a portable way to get formatted time
        std::process::Command::new("date")
            .arg("+%Y-%m-%d %H:%M:%S")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| {
                use std::time::{SystemTime, UNIX_EPOCH};
                let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
                format!("{}", d.as_secs())
            })
    }
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

#[tauri::command]
pub fn run_command_stream(
    app_handle: tauri::AppHandle,
    vault_state: tauri::State<AppState>,
    terminal_state: tauri::State<TerminalState>,
    command: String,
    project_id: String,
) -> Result<(), String> {
    let window = app_handle.get_window("main").ok_or("Main window not found")?;
    let envs = {
        let inner = vault_state.0.lock().map_err(|e| e.to_string())?;
        let vault = inner.as_ref().ok_or("Vault is not unlocked")?;
        let project = vault
            .find_project(&project_id)
            .ok_or_else(|| format!("Project not found: {}", project_id))?;
        project.env_vars.clone()
    };

    if command.starts_with("cd ") && !command.contains("&&") && !command.contains(';') && !command.contains('|') {
        let dir = command.strip_prefix("cd ").unwrap().trim();
        if dir.contains(' ') {
            // Quoted path or complex arg — let shell handle it
        } else {
            let mut cwds = terminal_state.cwds.lock().map_err(|e| e.to_string())?;
            let current = cwds.get(&project_id).cloned();
            let new_cwd = match dir {
            "~" | "~/" => {
                std::env::var("HOME").map(PathBuf::from).unwrap_or_default()
            }
            "-" => {
                current.as_ref().and_then(|p| p.parent()).map(|p| p.to_path_buf())
                    .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
            }
            _ if dir.starts_with('/') => PathBuf::from(dir),
            ".." => {
                current.as_ref().and_then(|p| p.parent()).map(|p| p.to_path_buf())
                    .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
            }
            _ => {
                let base = current.unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
                base.join(dir)
            }
        };
        let resolved = std::fs::canonicalize(&new_cwd).unwrap_or(new_cwd);
        cwds.insert(project_id.clone(), resolved.clone());
        let _ = window.emit("terminal:done", serde_json::json!({
            "code": 0,
            "project_id": project_id,
        }));
        return Ok(());
        }
    }

    let cwd = {
        let cwds = terminal_state.cwds.lock().map_err(|e| e.to_string())?;
        cwds.get(&project_id).cloned()
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
    };

    let mut child: std::process::Child;
    let child_pid: u32;
    #[cfg(unix)]
    {
        child = Command::new("sh")
            .arg("-c")
            .arg(&command)
            .current_dir(&cwd)
            .envs(&envs)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to execute command: {}", e))?;
        child_pid = child.id();
    }
    #[cfg(windows)]
    {
        child = Command::new("cmd")
            .args(["/C", &command])
            .current_dir(&cwd)
            .envs(&envs)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to execute command: {}", e))?;
        child_pid = child.id();
    }
    {
        let mut pid_guard = terminal_state.pid.lock().map_err(|e| e.to_string())?;
        *pid_guard = Some(child_pid);
    }

    let window_out = window.clone();
    let pid_out = project_id.clone();

    std::thread::spawn(move || {
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let win_err = window_out.clone();
        let pid_err = pid_out.clone();

        let err_handle = std::thread::spawn(move || {
            if let Some(stderr) = stderr {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(text) = line {
                        let _ = win_err.emit("terminal:output", serde_json::json!({
                            "stream": "stderr",
                            "text": text,
                            "project_id": pid_err,
                        }));
                    }
                }
            }
        });

        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(text) = line {
                    let _ = window_out.emit("terminal:output", serde_json::json!({
                        "stream": "stdout",
                        "text": text,
                        "project_id": pid_out.clone(),
                    }));
                }
            }
        }

        let _ = err_handle.join();

        let status = child.wait();
        let _ = window_out.emit("terminal:done", serde_json::json!({
            "code": status.ok().and_then(|s| s.code()),
            "project_id": pid_out.clone(),
        }));

        if let Ok(mut pid_guard) = app_handle.state::<TerminalState>().pid.lock() {
            *pid_guard = None;
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_command(
    terminal_state: tauri::State<TerminalState>,
) -> Result<(), String> {
    let pid = {
        let mut pid_guard = terminal_state.pid.lock().map_err(|e| e.to_string())?;
        pid_guard.take()
    };
    if let Some(pid) = pid {
        #[cfg(unix)]
        {
            let _ = Command::new("kill")
                .arg(pid.to_string())
                .output();
        }
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .arg("/F")
                .arg("/PID")
                .arg(pid.to_string())
                .output();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn generate_temp_env(
    vault_state: tauri::State<AppState>,
    temp_state: tauri::State<TempEnvState>,
    project_id: String,
    symlink_path: Option<String>,
) -> Result<String, String> {
    let vault = vault_state
        .0
        .lock()
        .map_err(|e| e.to_string())?;
    let vault = vault.as_ref().ok_or("Vault is not unlocked")?;
    let project = vault
        .find_project(&project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let temp_dir = std::env::temp_dir().join(format!("enveil_{}", &project_id));
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let env_path = temp_dir.join(".env");
    let content: String = project
        .env_vars
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("\n");
    std::fs::write(&env_path, &content).map_err(|e| format!("Failed to write .env: {}", e))?;

    #[cfg(unix)]
    std::fs::set_permissions(&env_path, Permissions::from_mode(0o600))
        .map_err(|e| format!("Failed to set permissions: {}", e))?;

    if let Some(ref sym_path_str) = symlink_path {
        let sym_path = std::path::Path::new(sym_path_str);
        if sym_path.exists() {
            std::fs::remove_file(sym_path).map_err(|e| format!("Failed to remove existing symlink target: {}", e))?;
        }
        #[cfg(unix)]
        std::os::unix::fs::symlink(&env_path, sym_path)
            .map_err(|e| format!("Failed to create symlink: {}", e))?;
        #[cfg(windows)]
        std::os::windows::fs::symlink_file(&env_path, sym_path)
            .map_err(|e| format!("Failed to create symlink: {}", e))?;
    }

    let mut temps = temp_state.0.lock().map_err(|e| e.to_string())?;
    temps.insert(
        project_id,
        TempEnvInfo {
            temp_dir: temp_dir.clone(),
            symlink_path: symlink_path.map(PathBuf::from),
        },
    );

    Ok(env_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn regenerate_temp_env(
    vault_state: tauri::State<AppState>,
    temp_state: tauri::State<TempEnvState>,
    project_id: String,
) -> Result<(), String> {
    let vault = vault_state
        .0
        .lock()
        .map_err(|e| e.to_string())?;
    let vault = vault.as_ref().ok_or("Vault is not unlocked")?;
    let project = vault
        .find_project(&project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let temps = temp_state.0.lock().map_err(|e| e.to_string())?;
    let info = temps
        .get(&project_id)
        .ok_or_else(|| format!("No temp .env for project '{}'", project_id))?;

    let env_path = info.temp_dir.join(".env");
    let content: String = project
        .env_vars
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("\n");
    std::fs::write(&env_path, &content).map_err(|e| format!("Failed to write .env: {}", e))?;

    #[cfg(unix)]
    std::fs::set_permissions(&env_path, Permissions::from_mode(0o600))
        .map_err(|e| format!("Failed to set permissions: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_temp_env(
    temp_state: tauri::State<TempEnvState>,
    project_id: String,
) -> Result<(), String> {
    let mut temps = temp_state.0.lock().map_err(|e| e.to_string())?;
    if let Some(info) = temps.remove(&project_id) {
        if let Some(ref sym_path) = info.symlink_path {
            if sym_path.exists() {
                std::fs::remove_file(sym_path).ok();
            }
        }
        if info.temp_dir.exists() {
            std::fs::remove_dir_all(&info.temp_dir).ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_temp_env_status(
    temp_state: tauri::State<TempEnvState>,
    project_id: String,
) -> Result<Option<TempEnvStatus>, String> {
    let temps = temp_state.0.lock().map_err(|e| e.to_string())?;
    Ok(temps.get(&project_id).map(|info| TempEnvStatus {
        temp_path: info.temp_dir.join(".env").to_string_lossy().to_string(),
        symlink_path: info
            .symlink_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
    }))
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    Err("Unsupported platform".into())
}

#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Terminal", &path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("x-terminal-emulator")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", &format!("cd /d \"{}\"", &path)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    Err("Unsupported platform".into())
}

#[tauri::command]
pub fn generate_env_example(
    state: tauri::State<AppState>,
    project_id: String,
    output_path: Option<String>,
) -> Result<String, String> {
    let inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_ref().ok_or("Vault is not unlocked")?;
    let project = vault
        .find_project(&project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let content: String = project
        .env_vars
        .keys()
        .map(|k| format!("{}={}", k, k))
        .collect::<Vec<_>>()
        .join("\n");

    if let Some(ref path) = output_path {
        if let Some(parent) = std::path::Path::new(path).parent() {
            std::fs::create_dir_all(parent).ok();
        }
        std::fs::write(path, &content).map_err(|e| format!("Failed to write file: {}", e))?;
    }

    Ok(content)
}

#[tauri::command]
pub fn diff_project_with_file(
    state: tauri::State<AppState>,
    project_id: String,
    file_path: String,
) -> Result<DiffResult, String> {
    let inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_ref().ok_or("Vault is not unlocked")?;
    let project = vault
        .find_project(&project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let file_vars: BTreeMap<String, String> = content
        .lines()
        .filter(|l| {
            let t = l.trim();
            !t.is_empty() && !t.starts_with('#') && t.contains('=')
        })
        .filter_map(|l| {
            let eq = l.find('=')?;
            let key = l[..eq].trim().to_string();
            let val = l[eq + 1..].trim().to_string();
            if key.is_empty() { None } else { Some((key, val)) }
        })
        .collect();

    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());

    let file_project = Project {
        id: String::new(),
        name: file_name,
        description: String::new(),
        env_vars: file_vars,
        share_password: None,
        run_cmd: None,
        history: Vec::new(),
    };

    Ok(diff::diff_projects(project, &file_project))
}

#[tauri::command]
pub fn cleanup_all_temp_envs(
    temp_state: tauri::State<TempEnvState>,
) -> Result<(), String> {
    let mut temps = temp_state.0.lock().map_err(|e| e.to_string())?;
    for (_id, info) in temps.drain() {
        if let Some(ref sym_path) = info.symlink_path {
            if sym_path.exists() {
                std::fs::remove_file(sym_path).ok();
            }
        }
        if info.temp_dir.exists() {
            std::fs::remove_dir_all(&info.temp_dir).ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_project_history(
    state: tauri::State<AppState>,
    project_id: String,
) -> Result<Vec<crate::models::EnvSnapshot>, String> {
    let inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_ref().ok_or("Vault is not unlocked")?;
    let project = vault
        .find_project(&project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;
    Ok(project.history.clone())
}

#[tauri::command]
pub fn restore_snapshot(
    state: tauri::State<AppState>,
    password: String,
    project_id: String,
    snapshot_index: usize,
) -> Result<(), String> {
    if password.is_empty() {
        return Err("Password must not be empty".into());
    }

    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_mut().ok_or_else(|| {
        "Vault is not unlocked. Call unlock_vault first.".to_string()
    })?;

    let project = vault
        .find_project_mut(&project_id)
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    if snapshot_index >= project.history.len() {
        return Err("Snapshot index out of range".into());
    }

    let snapshot = project.history[snapshot_index].clone();
    let current_vars = project.env_vars.clone();

    let new_snapshot = crate::models::EnvSnapshot {
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        label: format!("Before restore on {}", chrono_now()),
        env_vars: current_vars,
    };
    project.history.push(new_snapshot);
    if project.history.len() > 50 {
        project.history.remove(0);
    }

    project.env_vars = snapshot.env_vars;
    save_vault(vault, &password).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn kill_process_on_port(port: u16) -> Result<(), String> {
    #[cfg(unix)]
    {
        let output = Command::new("sh")
            .args(["-c", &format!("lsof -ti :{} 2>/dev/null", port)])
            .output()
            .map_err(|e| e.to_string())?;
        let pids = String::from_utf8_lossy(&output.stdout);
        for pid in pids.lines() {
            if let Ok(pid) = pid.trim().parse::<u32>() {
                let _ = Command::new("kill").arg("-9").arg(pid.to_string()).output();
            }
        }
    }
    #[cfg(windows)]
    {
        let output = Command::new("cmd")
            .args(["/C", &format!("netstat -ano | findstr :{}", port)])
            .output()
            .map_err(|e| e.to_string())?;
        let out = String::from_utf8_lossy(&output.stdout);
        for line in out.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(pid_str) = parts.last() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    let _ = Command::new("taskkill").arg("/F").arg("/PID").arg(pid.to_string()).output();
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn export_vault(
    state: tauri::State<AppState>,
    password: String,
    output_path: String,
) -> Result<(), String> {
    let vault = {
        let guard = state.0.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or("Vault is not unlocked")?
    };
    let payload = crate::crypto::encrypt_vault(&vault, &password).map_err(|e| e.to_string())?;
    let data = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    std::fs::write(&output_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_vault(
    state: tauri::State<AppState>,
    password: String,
    input_path: String,
    mode: String,
) -> Result<(), String> {
    let data = std::fs::read(&input_path).map_err(|e| e.to_string())?;
    let payload: crate::models::SecurePayload =
        serde_json::from_slice(&data).map_err(|e| e.to_string())?;
    let imported =
        crate::crypto::decrypt_vault(&payload, &password).map_err(|e| e.to_string())?;

    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let vault = guard.as_mut().ok_or("Vault is not unlocked")?;

    match mode.as_str() {
        "replace" => {
            *vault = imported;
        }
        "merge" => {
            let existing_ids: std::collections::HashSet<String> =
                vault.projects.iter().map(|p| p.id.clone()).collect();
            for project in imported.projects {
                if !existing_ids.contains(&project.id) {
                    vault.projects.push(project);
                }
            }
        }
        _ => return Err("Invalid mode. Use 'replace' or 'merge'.".into()),
    }

    save_vault(vault, &password).map_err(|e| e.to_string())?;
    Ok(())
}
