use std::fmt;

#[derive(Debug)]
#[allow(dead_code)]
pub enum VaultError {
    Crypto(String),
    Io(std::io::Error),
    Serialization(serde_json::Error),
    Argon(argon2::password_hash::Error),
    Argon2(argon2::Error),
    Aead,
    NotInitialized,
    InvalidPassword,
    ProjectNotFound(String),
    General(String),
}

impl fmt::Display for VaultError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VaultError::Crypto(msg) => write!(f, "Cryptographic error: {}", msg),
            VaultError::Io(err) => write!(f, "IO error: {}", err),
            VaultError::Serialization(err) => write!(f, "Serialization error: {}", err),
            VaultError::Argon(err) => write!(f, "Argon2 password-hash error: {}", err),
            VaultError::Argon2(err) => write!(f, "Argon2 error: {:?}", err),
            VaultError::Aead => write!(f, "AEAD decryption failure"),
            VaultError::NotInitialized => write!(f, "Vault has not been initialized"),
            VaultError::InvalidPassword => write!(f, "Invalid master password"),
            VaultError::ProjectNotFound(id) => write!(f, "Project not found: {}", id),
            VaultError::General(msg) => write!(f, "{}", msg),
        }
    }
}

impl From<std::io::Error> for VaultError {
    fn from(err: std::io::Error) -> Self {
        VaultError::Io(err)
    }
}

impl From<serde_json::Error> for VaultError {
    fn from(err: serde_json::Error) -> Self {
        VaultError::Serialization(err)
    }
}

impl From<argon2::password_hash::Error> for VaultError {
    fn from(err: argon2::password_hash::Error) -> Self {
        VaultError::Argon(err)
    }
}

impl From<argon2::Error> for VaultError {
    fn from(err: argon2::Error) -> Self {
        VaultError::Argon2(err)
    }
}

impl From<chacha20poly1305::aead::Error> for VaultError {
    fn from(_: chacha20poly1305::aead::Error) -> Self {
        VaultError::Aead
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_crypto() {
        let err = VaultError::Crypto("bad".into());
        assert_eq!(err.to_string(), "Cryptographic error: bad");
    }

    #[test]
    fn display_not_initialized() {
        assert_eq!(VaultError::NotInitialized.to_string(), "Vault has not been initialized");
    }

    #[test]
    fn display_invalid_password() {
        assert_eq!(VaultError::InvalidPassword.to_string(), "Invalid master password");
    }

    #[test]
    fn display_project_not_found() {
        let err = VaultError::ProjectNotFound("abc".into());
        assert_eq!(err.to_string(), "Project not found: abc");
    }

    #[test]
    fn display_general() {
        let err = VaultError::General("custom msg".into());
        assert_eq!(err.to_string(), "custom msg");
    }

    #[test]
    fn from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "nope");
        let vault_err: VaultError = io_err.into();
        assert!(matches!(vault_err, VaultError::Io(_)));
    }

    #[test]
    fn from_json_error() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid").unwrap_err();
        let vault_err: VaultError = json_err.into();
        assert!(matches!(vault_err, VaultError::Serialization(_)));
    }

    #[test]
    fn from_aead_error() {
        use chacha20poly1305::aead::Error;
        let vault_err: VaultError = Error.into();
        assert!(matches!(vault_err, VaultError::Aead));
    }
}
