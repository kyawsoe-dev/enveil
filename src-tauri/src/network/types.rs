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

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[test]
    fn sync_message_hello_round_trip() {
        let msg = SyncMessage::Hello {
            device_name: "MacBook".into(),
            app_version: "0.1.5".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SyncMessage = serde_json::from_str(&json).unwrap();
        match decoded {
            SyncMessage::Hello { device_name, app_version } => {
                assert_eq!(device_name, "MacBook");
                assert_eq!(app_version, "0.1.5");
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn sync_message_project_list_request_round_trip() {
        let msg = SyncMessage::ProjectListRequest;
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SyncMessage = serde_json::from_str(&json).unwrap();
        assert!(matches!(decoded, SyncMessage::ProjectListRequest));
    }

    #[test]
    fn sync_message_project_list_response_round_trip() {
        let msg = SyncMessage::ProjectListResponse {
            projects: vec![ProjectSummary {
                id: "abc".into(),
                name: "App".into(),
                description: "desc".into(),
                env_count: 5,
                has_password: true,
            }],
        };
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SyncMessage = serde_json::from_str(&json).unwrap();
        match decoded {
            SyncMessage::ProjectListResponse { projects } => {
                assert_eq!(projects.len(), 1);
                assert_eq!(projects[0].name, "App");
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn sync_message_project_request_round_trip() {
        let msg = SyncMessage::ProjectRequest {
            project_id: "abc".into(),
            password: "secret".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SyncMessage = serde_json::from_str(&json).unwrap();
        match decoded {
            SyncMessage::ProjectRequest { project_id, password } => {
                assert_eq!(project_id, "abc");
                assert_eq!(password, "secret");
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn sync_message_project_response_round_trip() {
        let mut env_vars = BTreeMap::new();
        env_vars.insert("PORT".into(), "3000".into());
        let msg = SyncMessage::ProjectResponse {
            id: "abc".into(),
            name: "App".into(),
            description: "desc".into(),
            env_vars,
        };
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SyncMessage = serde_json::from_str(&json).unwrap();
        match decoded {
            SyncMessage::ProjectResponse { id, env_vars, .. } => {
                assert_eq!(id, "abc");
                assert_eq!(env_vars.get("PORT").unwrap(), "3000");
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn sync_message_ack_round_trip() {
        let msg = SyncMessage::Ack;
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SyncMessage = serde_json::from_str(&json).unwrap();
        assert!(matches!(decoded, SyncMessage::Ack));
    }

    #[test]
    fn sync_message_error_round_trip() {
        let msg = SyncMessage::Error { message: "fail".into() };
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SyncMessage = serde_json::from_str(&json).unwrap();
        match decoded {
            SyncMessage::Error { message } => assert_eq!(message, "fail"),
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn sync_message_encrypted_round_trip() {
        let msg = SyncMessage::EncryptedProjectResponse {
            encrypted_data: vec![1, 2, 3],
            nonce: vec![4, 5, 6],
            salt: vec![7, 8, 9],
        };
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SyncMessage = serde_json::from_str(&json).unwrap();
        match decoded {
            SyncMessage::EncryptedProjectResponse { encrypted_data, nonce, salt } => {
                assert_eq!(encrypted_data, vec![1, 2, 3]);
                assert_eq!(nonce, vec![4, 5, 6]);
                assert_eq!(salt, vec![7, 8, 9]);
            }
            _ => panic!("Wrong variant"),
        }
    }
}
