use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::vault::Project;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffResult {
    pub project_a_name: String,
    pub project_b_name: String,
    pub only_in_a: BTreeMap<String, String>,
    pub only_in_b: BTreeMap<String, String>,
    pub changed: BTreeMap<String, (String, String)>,
}

pub fn diff_projects(a: &Project, b: &Project) -> DiffResult {
    let mut only_in_a = BTreeMap::new();
    let mut only_in_b = BTreeMap::new();
    let mut changed = BTreeMap::new();

    for (key, val_a) in &a.env_vars {
        match b.env_vars.get(key) {
            None => {
                only_in_a.insert(key.clone(), val_a.clone());
            }
            Some(val_b) if val_a != val_b => {
                changed.insert(key.clone(), (val_a.clone(), val_b.clone()));
            }
            _ => {}
        }
    }

    for (key, val_b) in &b.env_vars {
        if !a.env_vars.contains_key(key) {
            only_in_b.insert(key.clone(), val_b.clone());
        }
    }

    DiffResult {
        project_a_name: a.name.clone(),
        project_b_name: b.name.clone(),
        only_in_a,
        only_in_b,
        changed,
    }
}
