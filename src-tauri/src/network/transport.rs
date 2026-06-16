use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

use super::types::{PeerInfo, ProjectSummary, SyncMessage};
use crate::models::{Project, Vault};

pub struct SyncTransport {
    listener: Option<TcpListener>,
}

impl SyncTransport {
    pub fn new() -> Self {
        SyncTransport {
            listener: None,
        }
    }

    pub fn start_server(&mut self, port: u16, vault: Arc<Mutex<Option<Vault>>>) -> Result<u16, String> {
        let bind_addr = format!("0.0.0.0:{}", port);
        let listener = TcpListener::bind(&bind_addr)
            .map_err(|e| format!("Failed to bind TCP: {}", e))?;

        let actual_port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let listener_clone = listener
            .try_clone()
            .map_err(|e| format!("Failed to clone listener: {}", e))?;
        let vault_clone = Arc::clone(&vault);

        thread::spawn(move || {
            for stream in listener_clone.incoming() {
                match stream {
                    Ok(stream) => {
                        let vault = Arc::clone(&vault_clone);
                        thread::spawn(move || {
                            handle_client(stream, vault);
                        });
                    }
                    Err(_) => break,
                }
            }
        });

        self.listener = Some(listener);
        Ok(actual_port)
    }


}

fn send_message(stream: &mut TcpStream, msg: &SyncMessage) -> Result<(), String> {
    let json = serde_json::to_string(msg).map_err(|e| e.to_string())?;
    let len = json.len() as u32;
    let header = len.to_be_bytes();
    stream.write_all(&header).map_err(|e| e.to_string())?;
    stream.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn read_message(stream: &mut TcpStream) -> Result<SyncMessage, String> {
    let mut header = [0u8; 4];
    stream
        .read_exact(&mut header)
        .map_err(|e| format!("Failed to read header: {}", e))?;
    let len = u32::from_be_bytes(header) as usize;

    let mut buf = vec![0u8; len];
    stream
        .read_exact(&mut buf)
        .map_err(|e| format!("Failed to read body: {}", e))?;

    serde_json::from_slice(&buf).map_err(|e| format!("Failed to parse message: {}", e))
}

fn handle_client(mut stream: TcpStream, vault: Arc<Mutex<Option<Vault>>>) {
    let msg = match read_message(&mut stream) {
        Ok(msg) => msg,
        Err(_) => return,
    };

    match msg {
        SyncMessage::Hello { device_name: _, app_version: _ } => {
            let _ = send_message(&mut stream, &SyncMessage::Ack);
        }
        SyncMessage::ProjectListRequest => {
            let vault_guard = vault.lock().unwrap();
            let projects: Vec<ProjectSummary> = match vault_guard.as_ref() {
                Some(v) => v
                    .projects
                    .iter()
                    .map(|p| ProjectSummary {
                        id: p.id.clone(),
                        name: p.name.clone(),
                        description: p.description.clone(),
                        env_count: p.env_vars.len(),
                    })
                    .collect(),
                None => vec![],
            };
            let _ = send_message(
                &mut stream,
                &SyncMessage::ProjectListResponse { projects },
            );
        }
        SyncMessage::ProjectRequest { project_id } => {
            let vault_guard = vault.lock().unwrap();
            let response = match vault_guard.as_ref() {
                Some(v) => v
                    .projects
                    .iter()
                    .find(|p| p.id == project_id)
                    .map(|p| SyncMessage::ProjectResponse {
                        id: p.id.clone(),
                        name: p.name.clone(),
                        description: p.description.clone(),
                        env_vars: p.env_vars.clone(),
                    })
                    .unwrap_or(SyncMessage::Error {
                        message: "Project not found".to_string(),
                    }),
                None => SyncMessage::Error {
                    message: "Vault is locked".to_string(),
                },
            };
            let _ = send_message(&mut stream, &response);
        }
        _ => {
            let _ = send_message(
                &mut stream,
                &SyncMessage::Error {
                    message: "Unexpected message".to_string(),
                },
            );
        }
    }
}

pub fn request_project(peer: &PeerInfo, project_id: &str) -> Result<Project, String> {
    let mut stream = TcpStream::connect(format!("{}:{}", peer.ip, peer.port))
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let hello = SyncMessage::Hello {
        device_name: "ENVEIL".to_string(),
        app_version: "0.1.0".to_string(),
    };
    send_message(&mut stream, &hello)?;
    read_message(&mut stream)?;

    send_message(
        &mut stream,
        &SyncMessage::ProjectRequest {
            project_id: project_id.to_string(),
        },
    )?;

    match read_message(&mut stream)? {
        SyncMessage::ProjectResponse {
            id,
            name,
            description,
            env_vars,
        } => Ok(Project {
            id,
            name,
            description,
            env_vars,
        }),
        SyncMessage::Error { message } => Err(message),
        _ => Err("Unexpected response".to_string()),
    }
}
