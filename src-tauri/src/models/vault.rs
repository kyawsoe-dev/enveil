use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub version: u32,
    pub projects: Vec<Project>,
}

impl Vault {
    pub fn new() -> Self {
        Vault {
            version: 1,
            projects: Vec::new(),
        }
    }

    pub fn find_project(&self, id: &str) -> Option<&Project> {
        self.projects.iter().find(|p| p.id == id)
    }

    pub fn find_project_mut(&mut self, id: &str) -> Option<&mut Project> {
        self.projects.iter_mut().find(|p| p.id == id)
    }

    pub fn upsert_project(&mut self, project: Project) {
        if let Some(existing) = self.find_project_mut(&project.id) {
            *existing = project;
        } else {
            self.projects.push(project);
        }
    }

    pub fn remove_project(&mut self, id: &str) -> Option<Project> {
        let idx = self.projects.iter().position(|p| p.id == id)?;
        Some(self.projects.remove(idx))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub env_vars: BTreeMap<String, String>,
    pub share_password: Option<String>,
    #[serde(default)]
    pub run_cmd: Option<String>,
    #[serde(default)]
    pub history: Vec<EnvSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvSnapshot {
    pub timestamp: i64,
    pub label: String,
    pub env_vars: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurePayload {
    pub salt: Vec<u8>,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}
