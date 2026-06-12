use argon2::{Algorithm, Argon2, Params, Version};

use crate::error::VaultError;

pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], VaultError> {
    let params = Params::new(65536, 3, 4, Some(32))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2.hash_password_into(password.as_bytes(), salt, &mut key)?;
    Ok(key)
}
