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

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_PASSWORD: &str = "testpass123";
    const VALID_SALT: [u8; 32] = [1u8; 32];

    #[test]
    fn same_inputs_produce_same_key() {
        let key1 = derive_key(VALID_PASSWORD, &VALID_SALT).unwrap();
        let key2 = derive_key(VALID_PASSWORD, &VALID_SALT).unwrap();
        assert_eq!(key1, key2);
    }

    #[test]
    fn different_password_produces_different_key() {
        let key1 = derive_key("password123", &VALID_SALT).unwrap();
        let key2 = derive_key("password456", &VALID_SALT).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn different_salt_produces_different_key() {
        let salt1 = [1u8; 32];
        let salt2 = [2u8; 32];
        let key1 = derive_key(VALID_PASSWORD, &salt1).unwrap();
        let key2 = derive_key(VALID_PASSWORD, &salt2).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn short_password_returns_error() {
        let result = derive_key("short", &VALID_SALT);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("at least 8 characters"), "Got: {}", err);
    }

    #[test]
    fn exactly_8_char_password_succeeds() {
        assert!(derive_key("12345678", &VALID_SALT).is_ok());
    }

    #[test]
    fn wrong_salt_length_returns_error() {
        let salt = [0u8; 16];
        let result = derive_key(VALID_PASSWORD, &salt);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Salt must be 32 bytes"), "Got: {}", err);
    }

    #[test]
    fn key_is_32_bytes() {
        let key = derive_key(VALID_PASSWORD, &VALID_SALT).unwrap();
        assert_eq!(key.len(), 32);
    }
}
