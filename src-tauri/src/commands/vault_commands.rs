use std::collections::{BTreeMap, HashMap};
use std::fs::Permissions;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(unix)]
use std::os::unix::process::CommandExt;

use serde::Serialize;
use tauri::Manager;

use crate::error::VaultError;
use crate::models::diff;
use crate::models::{DiffResult, Project, Vault};
use crate::storage::{delete_vault_file, load_vault, save_vault};

pub struct TerminalState {
    pub child: Mutex<Option<Arc<Mutex<Option<std::process::Child>>>>>,
    pub cwds: Mutex<HashMap<String, PathBuf>>,
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            cwds: Mutex::new(HashMap::new()),
        }
    }
}

pub struct AppState(pub Arc<Mutex<Option<Vault>>>);

pub struct TempEnvInfo {
    pub temp_dir: PathBuf,
    pub symlink_path: Option<PathBuf>,
    #[allow(dead_code)]
    pub watcher: Option<notify::RecommendedWatcher>,
}

#[derive(Serialize)]
pub struct TempEnvStatus {
    pub temp_path: String,
    pub symlink_path: Option<String>,
}

fn validate_path(path: &str) -> Result<std::path::PathBuf, String> {
    let path = std::path::Path::new(path);
    if !path.exists() {
        return Err("Path does not exist".into());
    }
    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("Invalid path: {}", e))?;
    let path_str = canonical.to_string_lossy();
    let lower = path_str.to_lowercase();

    // Unix system paths (Linux / macOS)
    let unix_system = [
        "/proc/",
        "/sys/",
        "/dev/",
        "/etc/",
        "/boot/",
        "/lost+found",
        "/root/",
        "/run/",
        "/snap/",
        "/System/",
        "/Library/",
        "/private/",
        "/cores/",
    ];
    for b in &unix_system {
        if path_str.starts_with(b) || path_str.contains(b) {
            return Err(format!("Access denied: system path is not allowed"));
        }
    }

    // Windows system paths
    let win_system = [
        r"c:\windows",
        r"c:\program files",
        r"c:\program files (x86)",
        r"c:\programdata",
        r"c:\recovery",
        r"c:\$recycle.bin",
        r"c:\system volume information",
        r"c:\boot",
        r"c:\config.msi",
        r"c:\drivers",
        r"c:\system32",
    ];
    for b in &win_system {
        if lower.starts_with(b) {
            return Err(format!("Access denied: system path is not allowed"));
        }
    }

    Ok(canonical)
}

fn validate_command(command: &str) -> Result<(), String> {
    let lower = command.to_lowercase();
    let blocked = [
        "rm -rf /",
        "rm -rf /*",
        ":(){ :|:& };:",
        "mkfs",
        "dd if=",
        "> /dev/",
        "poweroff",
        "shutdown",
        "reboot",
        "halt",
        "init 0",
        "init 6",
    ];
    for b in &blocked {
        if lower.contains(b) {
            return Err(format!("Blocked command pattern: {}", b));
        }
    }
    Ok(())
}

fn validate_output_path(path: &str) -> Result<std::path::PathBuf, String> {
    let p = std::path::Path::new(path);
    let parent = p.parent().unwrap_or(std::path::Path::new("."));
    if parent.exists() {
        let canonical = std::fs::canonicalize(parent)
            .map_err(|e| format!("Invalid parent directory: {}", e))?;
        let parent_str = canonical.to_string_lossy();
        let lower = parent_str.to_lowercase();

        let unix_system = [
            "/proc/", "/sys/", "/dev/", "/etc/", "/boot/",
            "/lost+found", "/root/", "/run/", "/snap/",
            "/System/", "/Library/", "/private/", "/cores/",
        ];
        for b in &unix_system {
            if parent_str.starts_with(b) || parent_str.contains(b) {
                return Err("Access denied: system path is not allowed".into());
            }
        }

        let win_system = [
            r"c:\windows", r"c:\program files", r"c:\program files (x86)",
            r"c:\programdata", r"c:\recovery", r"c:\$recycle.bin",
            r"c:\system volume information", r"c:\boot", r"c:\system32",
        ];
        for b in &win_system {
            if lower.starts_with(b) {
                return Err("Access denied: system path is not allowed".into());
            }
        }
    }
    Ok(p.to_path_buf())
}

pub struct TempEnvState(pub Mutex<HashMap<String, TempEnvInfo>>);

#[tauri::command]
pub fn initialize_vault(
    state: tauri::State<AppState>,
    password: String,
) -> Result<(), String> {
    if password.len() < crate::crypto::key_derivation::MIN_PASSWORD_LENGTH {
        return Err(format!(
            "Password must be at least {} characters",
            crate::crypto::key_derivation::MIN_PASSWORD_LENGTH
        ));
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
        let mut child_guard = terminal_state.child.lock().map_err(|e| e.to_string())?;
        if let Some(child_arc) = child_guard.take() {
            if let Ok(mut inner) = child_arc.lock() {
                if let Some(ref mut child) = *inner {
                    let _ = child.kill();
                    let _ = child.wait();
                }
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
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
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
    if new_password.len() < crate::crypto::key_derivation::MIN_PASSWORD_LENGTH {
        return Err(format!(
            "Password must be at least {} characters",
            crate::crypto::key_derivation::MIN_PASSWORD_LENGTH
        ));
    }
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
    validate_command(&command)?;
    let inner = state.0.lock().map_err(|e| e.to_string())?;
    let vault = inner.as_ref().ok_or("Vault is not unlocked")?;
    let project = vault
        .find_project(&project_id)
        .ok_or_else(|| format!("Project not found: {}", project_id))?;

    let envs: BTreeMap<String, String> = project.env_vars.clone();

    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("zsh")
            .args(["-l", "-c", &command])
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
    #[cfg(target_os = "linux")]
    {
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
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("cmd")
            .args(["/C", &command])
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
}

#[tauri::command]
pub fn run_command_stream(
    app_handle: tauri::AppHandle,
    vault_state: tauri::State<AppState>,
    terminal_state: tauri::State<TerminalState>,
    command: String,
    project_id: String,
) -> Result<(), String> {
    validate_command(&command)?;
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
    #[cfg(target_os = "macos")]
    {
        child = Command::new("zsh")
            .args(["-l", "-c", &command])
            .current_dir(&cwd)
            .envs(&envs)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .process_group(0)
            .spawn()
            .map_err(|e| format!("Failed to execute command: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        child = Command::new("sh")
            .arg("-c")
            .arg(&command)
            .current_dir(&cwd)
            .envs(&envs)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .process_group(0)
            .spawn()
            .map_err(|e| format!("Failed to execute command: {}", e))?;
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
    }

    // Take stdout/stderr before moving child into shared state
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Wrap child in shared state so both this thread and stop_command can access it
    let child_arc = Arc::new(Mutex::new(Some(child)));

    {
        let mut child_guard = terminal_state.child.lock().map_err(|e| e.to_string())?;
        *child_guard = Some(Arc::clone(&child_arc));
    }

    let window_out = window.clone();
    let pid_out = project_id.clone();

    std::thread::spawn(move || {
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

        // Wait on child through shared state
        let mut child_lock = child_arc.lock().unwrap();
        let status = child_lock.as_mut().and_then(|c| c.wait().ok());
        let _ = window_out.emit("terminal:done", serde_json::json!({
            "code": status.and_then(|s| s.code()),
            "project_id": pid_out.clone(),
        }));

        // Clear terminal state
        if let Ok(mut state_child) = app_handle.state::<TerminalState>().child.lock() {
            *state_child = None;
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_command(
    terminal_state: tauri::State<TerminalState>,
) -> Result<(), String> {
    let child_opt = terminal_state.child.lock().map_err(|e| e.to_string())?.take();
    if let Some(child_arc) = child_opt {
        let mut child_lock = child_arc.lock().unwrap();
        if let Some(ref mut child) = *child_lock {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn generate_temp_env(
    app_handle: tauri::AppHandle,
    vault_state: tauri::State<AppState>,
    temp_state: tauri::State<TempEnvState>,
    project_id: String,
    symlink_path: Option<String>,
    password: String,
) -> Result<String, String> {
    let (_env_vars, temp_dir, env_path) = {
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
        #[cfg(unix)]
        std::fs::set_permissions(&temp_dir, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("Failed to set temp dir permissions: {}", e))?;

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
            // Validate symlink parent directory to prevent symlink planting outside allowed paths
            if let Some(parent) = sym_path.parent() {
                let parent_str = parent.to_string_lossy();
                if parent_str.starts_with("/proc/") || parent_str.starts_with("/sys/") || parent_str.starts_with("/dev/") || parent_str.starts_with("/etc/") {
                    return Err("Access denied: symlink target in blocked directory".into());
                }
            }
            // Remove existing symlink atomically
            if sym_path.exists() || sym_path.is_symlink() {
                std::fs::remove_file(sym_path).ok();
            }
            #[cfg(unix)]
            std::os::unix::fs::symlink(&env_path, sym_path)
                .map_err(|e| format!("Failed to create symlink: {}", e))?;
            #[cfg(windows)]
            std::os::windows::fs::symlink_file(&env_path, sym_path)
                .map_err(|e| format!("Failed to create symlink: {}", e))?;
        }

        (project.env_vars.clone(), temp_dir, env_path)
    };

    // Start file watcher on the temp .env file
    let env_path_clone = env_path.clone();
    let project_id_clone = project_id.clone();
    let vault_state_inner = vault_state.0.clone();
    let pwd = password.clone();
    let window = app_handle.get_window("main");

    use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
    use std::sync::mpsc;
    use std::time::Duration;

    let (tx, rx) = mpsc::channel();
    let mut watcher = match RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| {
            let _ = tx.send(res);
        },
        Config::default(),
    ) {
        Ok(w) => Some(w),
        Err(_) => {
            None
        }
    };

    if let Some(ref mut w) = watcher {
        let _ = w.watch(&env_path_clone, RecursiveMode::NonRecursive);
    }

    std::thread::spawn(move || {
        // Keep watcher alive until rx disconnects
        loop {
            match rx.recv() {
                Ok(Ok(event)) => {
                    let should_process = matches!(
                        event.kind,
                        EventKind::Modify(_) | EventKind::Create(_)
                    );
                    if !should_process { continue; }

                    // Small delay to let writes settle
                    std::thread::sleep(Duration::from_millis(100));

                    // Read file
                    let content = match std::fs::read_to_string(&env_path_clone) {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    // Parse KEY=VALUE lines
                    let mut parsed: std::collections::BTreeMap<String, String> = std::collections::BTreeMap::new();
                    for line in content.lines() {
                        let line = line.trim();
                        if line.is_empty() || line.starts_with('#') {
                            continue;
                        }
                        if let Some(eq_pos) = line.find('=') {
                            let key = line[..eq_pos].trim().to_string();
                            let value = line[eq_pos + 1..].trim().to_string();
                            if !key.is_empty() {
                                parsed.insert(key, value);
                            }
                        }
                    }

                    // Update vault in memory if changed
                    let should_save = {
                        let mut guard = match vault_state_inner.lock() {
                            Ok(g) => g,
                            Err(_) => continue,
                        };
                        let vault = match guard.as_mut() {
                            Some(v) => v,
                            None => continue,
                        };
                        let project = match vault.find_project_mut(&project_id_clone) {
                            Some(p) => p,
                            None => continue,
                        };

                        if project.env_vars == parsed {
                            false // no change, skip to avoid loop
                        } else {
                            // Create history snapshot
                            let snapshot = crate::models::EnvSnapshot {
                                timestamp: std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs() as i64,
                                label: "Auto-sync from .env file".to_string(),
                                env_vars: project.env_vars.clone(),
                            };
                            project.history.push(snapshot);
                            if project.history.len() > 50 {
                                project.history.remove(0);
                            }

                            project.env_vars = parsed.clone();
                            true
                        }
                    };

                    if should_save {
                        if let Err(e) = save_vault(
                            &vault_state_inner.lock().unwrap().as_ref().unwrap(),
                            &pwd,
                        ) {
                            eprintln!("Failed to save vault after file sync: {}", e);
                        }

                        if let Some(ref w) = window {
                            let _ = w.emit("vault:env-synced", serde_json::json!({
                                "project_id": project_id_clone,
                            }));
                        }
                    }
                }
                Ok(Err(_)) => continue,
                Err(mpsc::RecvError) => break,
            }
        }
    });

    let mut temps = temp_state.0.lock().map_err(|e| e.to_string())?;
    temps.insert(
        project_id,
        TempEnvInfo {
            temp_dir: temp_dir.clone(),
            symlink_path: symlink_path.map(PathBuf::from),
            watcher,
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
    let _validated = validate_path(&path)?;
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
    let _validated = validate_path(&path)?;
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
        let _validated = validate_output_path(path)?;
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

    let _validated = validate_path(&file_path)?;
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
    let _validated = validate_output_path(&output_path)?;
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
    let _validated = validate_path(&input_path)?;
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

#[tauri::command]
pub fn read_env_file(path: String) -> Result<String, String> {
    let validated = validate_path(&path)?;
    std::fs::read_to_string(&validated).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn get_app_version() -> String {
    let version = env!("CARGO_PKG_VERSION").to_string();
    version
}
