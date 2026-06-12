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
