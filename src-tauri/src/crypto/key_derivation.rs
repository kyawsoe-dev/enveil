use argon2::{Algorithm, Argon2, Params, Version};

use crate::error::VaultError;

pub const MIN_PASSWORD_LENGTH: usize = 8;

pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], VaultError> {
    if password.len() < MIN_PASSWORD_LENGTH {
        return Err(VaultError::General(format!(
            "Password must be at least {} characters",
            MIN_PASSWORD_LENGTH
        )));
    }
    // Validate salt length early
    if salt.len() != 32 {
        return Err(VaultError::General("Salt must be 32 bytes".into()));
    }
    let params = Params::new(65536, 3, 4, Some(32))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2.hash_password_into(password.as_bytes(), salt, &mut key)?;
    Ok(key)
}
