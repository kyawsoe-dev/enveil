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

impl Drop for Project {
    fn drop(&mut self) {
        if let Some(ref mut pw) = self.share_password {
            zeroize_str(pw);
        }
    }
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

fn zeroize_str(s: &mut String) {
    let bytes = unsafe { s.as_mut_vec() };
    for b in bytes.iter_mut() {
        *b = 0;
    }
    s.clear();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn make_project(id: &str, name: &str) -> Project {
        Project {
            id: id.to_string(),
            name: name.to_string(),
            description: String::new(),
            env_vars: BTreeMap::new(),
            share_password: None,
            run_cmd: None,
            history: Vec::new(),
        }
    }

    #[test]
    fn new_vault_has_version_1() {
        let vault = Vault::new();
        assert_eq!(vault.version, 1);
    }

    #[test]
    fn new_vault_has_no_projects() {
        let vault = Vault::new();
        assert!(vault.projects.is_empty());
    }

    #[test]
    fn find_project_returns_existing() {
        let mut vault = Vault::new();
        vault.upsert_project(make_project("abc", "My App"));
        assert!(vault.find_project("abc").is_some());
        assert_eq!(vault.find_project("abc").unwrap().name, "My App");
    }

    #[test]
    fn find_project_returns_none_for_missing() {
        let vault = Vault::new();
        assert!(vault.find_project("nonexistent").is_none());
    }

    #[test]
    fn upsert_inserts_new_project() {
        let mut vault = Vault::new();
        vault.upsert_project(make_project("abc", "App"));
        assert_eq!(vault.projects.len(), 1);
    }

    #[test]
    fn upsert_updates_existing_project() {
        let mut vault = Vault::new();
        vault.upsert_project(make_project("abc", "Old Name"));
        vault.upsert_project(make_project("abc", "New Name"));
        assert_eq!(vault.projects.len(), 1);
        assert_eq!(vault.find_project("abc").unwrap().name, "New Name");
    }

    #[test]
    fn remove_existing_project_returns_it() {
        let mut vault = Vault::new();
        vault.upsert_project(make_project("abc", "App"));
        let removed = vault.remove_project("abc");
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().name, "App");
    }

    #[test]
    fn remove_nonexistent_returns_none() {
        let mut vault = Vault::new();
        assert!(vault.remove_project("nope").is_none());
    }

    #[test]
    fn remove_decreases_count() {
        let mut vault = Vault::new();
        vault.upsert_project(make_project("a", "A"));
        vault.upsert_project(make_project("b", "B"));
        vault.remove_project("a");
        assert_eq!(vault.projects.len(), 1);
    }

    #[test]
    fn find_project_mut_allows_mutation() {
        let mut vault = Vault::new();
        vault.upsert_project(make_project("abc", "Old"));
        vault.find_project_mut("abc").unwrap().name = "Mutated".to_string();
        assert_eq!(vault.find_project("abc").unwrap().name, "Mutated");
    }

    #[test]
    fn serde_round_trip() {
        let mut vault = Vault::new();
        vault.upsert_project(make_project("abc", "App"));
        let json = serde_json::to_string(&vault).unwrap();
        let decoded: Vault = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.version, 1);
        assert_eq!(decoded.projects.len(), 1);
        assert_eq!(decoded.projects[0].name, "App");
    }
}
