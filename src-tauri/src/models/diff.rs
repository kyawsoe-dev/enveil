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

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::vault::Project;
    use std::collections::BTreeMap;

    fn make_project(name: &str, vars: Vec<(&str, &str)>) -> Project {
        let env_vars: BTreeMap<String, String> =
            vars.into_iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        Project {
            id: "test".to_string(),
            name: name.to_string(),
            description: String::new(),
            env_vars,
            share_password: None,
            run_cmd: None,
            history: Vec::new(),
        }
    }

    #[test]
    fn identical_projects_no_diff() {
        let a = make_project("A", vec![("PORT", "3000")]);
        let b = make_project("B", vec![("PORT", "3000")]);
        let result = diff_projects(&a, &b);
        assert!(result.only_in_a.is_empty());
        assert!(result.only_in_b.is_empty());
        assert!(result.changed.is_empty());
    }

    #[test]
    fn key_only_in_a() {
        let a = make_project("A", vec![("PORT", "3000"), ("DB", "postgres")]);
        let b = make_project("B", vec![("PORT", "3000")]);
        let result = diff_projects(&a, &b);
        assert_eq!(result.only_in_a.len(), 1);
        assert_eq!(result.only_in_a.get("DB").unwrap(), "postgres");
    }

    #[test]
    fn key_only_in_b() {
        let a = make_project("A", vec![("PORT", "3000")]);
        let b = make_project("B", vec![("PORT", "3000"), ("REDIS", "localhost")]);
        let result = diff_projects(&a, &b);
        assert_eq!(result.only_in_b.len(), 1);
        assert_eq!(result.only_in_b.get("REDIS").unwrap(), "localhost");
    }

    #[test]
    fn changed_value() {
        let a = make_project("A", vec![("PORT", "3000")]);
        let b = make_project("B", vec![("PORT", "8080")]);
        let result = diff_projects(&a, &b);
        assert_eq!(result.changed.len(), 1);
        let (val_a, val_b) = result.changed.get("PORT").unwrap();
        assert_eq!(val_a, "3000");
        assert_eq!(val_b, "8080");
    }

    #[test]
    fn mixed_changes() {
        let a = make_project("A", vec![("A_ONLY", "1"), ("SHARED", "x"), ("CHANGED", "old")]);
        let b = make_project("B", vec![("B_ONLY", "2"), ("SHARED", "x"), ("CHANGED", "new")]);
        let result = diff_projects(&a, &b);
        assert_eq!(result.only_in_a.len(), 1);
        assert!(result.only_in_a.contains_key("A_ONLY"));
        assert_eq!(result.only_in_b.len(), 1);
        assert!(result.only_in_b.contains_key("B_ONLY"));
        assert_eq!(result.changed.len(), 1);
        assert!(result.changed.contains_key("CHANGED"));
    }

    #[test]
    fn empty_projects_no_diff() {
        let a = make_project("A", vec![]);
        let b = make_project("B", vec![]);
        let result = diff_projects(&a, &b);
        assert!(result.only_in_a.is_empty());
        assert!(result.only_in_b.is_empty());
        assert!(result.changed.is_empty());
    }

    #[test]
    fn project_names_captured() {
        let a = make_project("Project Alpha", vec![]);
        let b = make_project("Project Beta", vec![]);
        let result = diff_projects(&a, &b);
        assert_eq!(result.project_a_name, "Project Alpha");
        assert_eq!(result.project_b_name, "Project Beta");
    }

    #[test]
    fn serde_round_trip() {
        let a = make_project("A", vec![("K", "V")]);
        let b = make_project("B", vec![("K", "V2")]);
        let result = diff_projects(&a, &b);
        let json = serde_json::to_string(&result).unwrap();
        let decoded: DiffResult = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.project_a_name, "A");
        assert_eq!(decoded.changed.len(), 1);
    }
}
