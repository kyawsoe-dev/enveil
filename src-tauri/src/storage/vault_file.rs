use directories::ProjectDirs;
use std::path::PathBuf;

use crate::error::VaultError;
use crate::models::{SecurePayload, Vault};
use crate::crypto::{decrypt_vault, encrypt_vault};

const QUALIFIER: &str = "com";
const ORGANIZATION: &str = "envvault";
const APPLICATION: &str = "env-vault";

pub fn vault_path() -> Result<PathBuf, VaultError> {
    let proj_dirs =
        ProjectDirs::from(QUALIFIER, ORGANIZATION, APPLICATION).ok_or_else(|| {
            VaultError::General("Failed to resolve application data directory".into())
        })?;
    let data_dir = proj_dirs.config_dir();
    std::fs::create_dir_all(data_dir)?;
    Ok(data_dir.join("vault.bin"))
}

pub fn save_vault(vault: &Vault, password: &str) -> Result<(), VaultError> {
    let payload = encrypt_vault(vault, password)?;
    let path = vault_path()?;
    let data = serde_json::to_vec(&payload)?;
    std::fs::write(&path, data)?;
    Ok(())
}

pub fn delete_vault_file() -> Result<(), VaultError> {
    let path = vault_path()?;
    if path.exists() {
        std::fs::remove_file(&path)?;
    }
    Ok(())
}

pub fn load_vault(password: &str) -> Result<Vault, VaultError> {
    let path = vault_path()?;
    if !path.exists() {
        return Err(VaultError::NotInitialized);
    }
    let data = std::fs::read(&path)?;
    let payload: SecurePayload = serde_json::from_slice(&data)?;
    let vault = decrypt_vault(&payload, password)?;
    Ok(vault)
}
