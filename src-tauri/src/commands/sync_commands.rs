use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::network::discovery::Mdnssd;
use crate::network::transport::{request_peer_projects, request_project, SyncTransport};
use crate::network::types::PeerInfo;

pub struct SyncAppState {
    pub peer_list: Arc<Mutex<HashMap<String, PeerInfo>>>,
    pub mdnssd: Mutex<Option<Mdnssd>>,
    pub transport: Mutex<Option<SyncTransport>>,
    pub active: Mutex<bool>,
    pub device_name: Mutex<String>,
    pub port: Mutex<u16>,
}

impl SyncAppState {
    pub fn new() -> Self {
        SyncAppState {
            peer_list: Arc::new(Mutex::new(HashMap::new())),
            mdnssd: Mutex::new(None),
            transport: Mutex::new(None),
            active: Mutex::new(false),
            device_name: Mutex::new(hostname()),
            port: Mutex::new(0),
        }
    }
}

use std::process::Command;

fn hostname() -> String {
    if let Ok(name) = std::env::var("HOSTNAME") {
        let name = name.trim().trim_end_matches(".local").to_string();
        if !name.is_empty() {
            return name;
        }
    }
    if let Ok(name) = std::env::var("COMPUTERNAME") {
        let name = name.trim().to_string();
        if !name.is_empty() {
            return name;
        }
    }
    for cmd in &["/bin/hostname", "hostname"] {
        if let Ok(out) = Command::new(cmd).output() {
            if let Ok(name) = String::from_utf8(out.stdout) {
                let name = name.trim().trim_end_matches(".local").to_string();
                if !name.is_empty() {
                    return name;
                }
            }
        }
    }
    // Generate a unique fallback so devices never collide
    let fallback = format!("ENVEIL-{}", std::process::id());
    fallback
}

#[tauri::command]
pub fn start_lan_sync(
    sync_state: tauri::State<SyncAppState>,
    vault_state: tauri::State<crate::commands::vault_commands::AppState>,
) -> Result<(), String> {
    let mut active = sync_state.active.lock().map_err(|e| e.to_string())?;
    if *active {
        return Err("LAN sync is already running".to_string());
    }

    let device_name = sync_state.device_name.lock().map_err(|e| e.to_string())?.clone();
    let vault_arc = vault_state.0.clone();

    sync_state.peer_list.lock().map_err(|e| e.to_string())?.clear();

    let peers = Arc::clone(&sync_state.peer_list);

    let mut transport = SyncTransport::new();
    let actual_port = transport.start_server(0, Arc::clone(&vault_arc))?;

    let mut mdnssd = Mdnssd::new(Arc::clone(&peers), device_name, actual_port);
    mdnssd.start()?;

    let mut port = sync_state.port.lock().map_err(|e| e.to_string())?;
    *port = actual_port;

    *sync_state.mdnssd.lock().map_err(|e| e.to_string())? = Some(mdnssd);
    *sync_state.transport.lock().map_err(|e| e.to_string())? = Some(transport);
    *active = true;

    Ok(())
}

#[tauri::command]
pub fn stop_lan_sync(
    sync_state: tauri::State<SyncAppState>,
) -> Result<(), String> {
    let mut active = sync_state.active.lock().map_err(|e| e.to_string())?;
    if !*active {
        return Ok(());
    }

    *sync_state.mdnssd.lock().map_err(|e| e.to_string())? = None;
    *sync_state.transport.lock().map_err(|e| e.to_string())? = None;
    sync_state.peer_list.lock().map_err(|e| e.to_string())?.clear();
    *active = false;

    Ok(())
}

#[tauri::command]
pub fn get_peers(
    sync_state: tauri::State<SyncAppState>,
) -> Result<Vec<PeerInfo>, String> {
    let peers = sync_state.peer_list.lock().map_err(|e| e.to_string())?;
    Ok(peers.values().cloned().collect())
}

#[tauri::command]
pub fn get_sync_status(
    sync_state: tauri::State<SyncAppState>,
) -> Result<crate::network::types::SyncState, String> {
    let active = *sync_state.active.lock().map_err(|e| e.to_string())?;
    let peers = sync_state.peer_list.lock().map_err(|e| e.to_string())?;
    let device_name = sync_state.device_name.lock().map_err(|e| e.to_string())?.clone();
    let port = *sync_state.port.lock().map_err(|e| e.to_string())?;

    Ok(crate::network::types::SyncState {
        active,
        peers: peers.values().cloned().collect(),
        my_device_name: device_name,
        port,
    })
}

#[tauri::command]
pub fn sync_project_from_peer(
    peer_device_name: String,
    project_id: String,
    password: String,
    share_password: String,
    sync_state: tauri::State<SyncAppState>,
    vault_state: tauri::State<crate::commands::vault_commands::AppState>,
) -> Result<crate::models::Project, String> {
    if password.is_empty() {
        return Err("Password must not be empty".to_string());
    }

    let peers = sync_state.peer_list.lock().map_err(|e| e.to_string())?;
    let peer = peers
        .get(&peer_device_name)
        .ok_or_else(|| format!("Peer '{}' not found", peer_device_name))?
        .clone();
    drop(peers);

    let project = request_project(&peer, &project_id, &share_password)?;

    let mut vault_guard = vault_state.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut vault) = *vault_guard {
        vault.upsert_project(project.clone());
        crate::storage::save_vault(vault, &password).map_err(|e| e.to_string())?;
    }

    Ok(project)
}

#[tauri::command]
pub fn set_device_name(
    name: String,
    sync_state: tauri::State<SyncAppState>,
) -> Result<(), String> {
    {
        let mut device_name = sync_state.device_name.lock().map_err(|e| e.to_string())?;
        *device_name = name.clone();
    }

    let active = *sync_state.active.lock().map_err(|e| e.to_string())?;
    if active {
        let port = *sync_state.port.lock().map_err(|e| e.to_string())?;
        let peers = Arc::clone(&sync_state.peer_list);
        let mut new_mdns = Mdnssd::new(Arc::clone(&peers), name, port);
        new_mdns.start()?;

        *sync_state.mdnssd.lock().map_err(|e| e.to_string())? = Some(new_mdns);
        peers.lock().map_err(|e| e.to_string())?.clear();
    }

    Ok(())
}

#[tauri::command]
pub fn get_peer_projects(
    peer_device_name: String,
    sync_state: tauri::State<SyncAppState>,
) -> Result<Vec<crate::network::types::ProjectSummary>, String> {
    let peers = sync_state.peer_list.lock().map_err(|e| e.to_string())?;
    let peer = peers
        .get(&peer_device_name)
        .ok_or_else(|| format!("Peer '{}' not found", peer_device_name))?
        .clone();
    drop(peers);

    request_peer_projects(&peer)
}
