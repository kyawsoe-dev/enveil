use directories::ProjectDirs;
use std::path::PathBuf;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use crate::error::VaultError;
use crate::models::{SecurePayload, Vault};
use crate::crypto::{decrypt_vault, encrypt_vault};

const QUALIFIER: &str = "com";
const ORGANIZATION: &str = "envvault";
const APPLICATION: &str = "env-vault";

fn set_private_permissions(path: &std::path::Path, is_dir: bool) -> Result<(), VaultError> {
    #[cfg(unix)]
    {
        let mode = if is_dir { 0o700 } else { 0o600 };
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode))?;
    }
    Ok(())
}

pub fn vault_path() -> Result<PathBuf, VaultError> {
    let proj_dirs =
        ProjectDirs::from(QUALIFIER, ORGANIZATION, APPLICATION).ok_or_else(|| {
            VaultError::General("Failed to resolve application data directory".into())
        })?;
    let data_dir = proj_dirs.config_dir();
    std::fs::create_dir_all(&data_dir)?;
    set_private_permissions(&data_dir, true)?;
    Ok(data_dir.join("vault.bin"))
}

pub fn save_vault(vault: &Vault, password: &str) -> Result<(), VaultError> {
    let payload = encrypt_vault(vault, password)?;
    let path = vault_path()?;
    let data = serde_json::to_vec(&payload)?;
    // Atomic write: write to temp file then rename
    let tmp_path = path.with_extension("tmp");
    std::fs::write(&tmp_path, &data)?;
    set_private_permissions(&tmp_path, false)?;
    std::fs::rename(&tmp_path, &path)?;
    set_private_permissions(&path, false)?;
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
