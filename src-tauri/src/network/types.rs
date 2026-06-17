use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub device_name: String,
    pub ip: String,
    pub port: u16,
    pub hostname: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub env_count: usize,
    pub has_password: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncMessage {
    Hello {
        device_name: String,
        app_version: String,
    },
    ProjectListRequest,
    ProjectListResponse {
        projects: Vec<ProjectSummary>,
    },
    ProjectRequest {
        project_id: String,
        password: String,
    },
    ProjectResponse {
        id: String,
        name: String,
        description: String,
        env_vars: std::collections::BTreeMap<String, String>,
    },
    EncryptedProjectResponse {
        encrypted_data: Vec<u8>,
        nonce: Vec<u8>,
        salt: Vec<u8>,
    },
    Ack,
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub active: bool,
    pub peers: Vec<PeerInfo>,
    pub my_device_name: String,
    pub port: u16,
}
