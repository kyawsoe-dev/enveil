use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Key, Nonce,
};
use rand::RngCore;

use crate::error::VaultError;
use crate::models::SecurePayload;

use super::key_derivation::derive_key;

pub fn encrypt_payload(plaintext: &[u8], password: &str) -> Result<SecurePayload, VaultError> {
    let mut salt = vec![0u8; 32];
    OsRng.fill_bytes(&mut salt);

    let key = derive_key(password, &salt)?;
    let cipher = ChaCha20Poly1305::new(Key::from_slice(&key));

    let mut nonce_bytes = vec![0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, plaintext)?;

    Ok(SecurePayload {
        salt,
        nonce: nonce_bytes,
        ciphertext,
    })
}

pub fn decrypt_payload(payload: &SecurePayload, password: &str) -> Result<Vec<u8>, VaultError> {
    let key = derive_key(password, &payload.salt)?;
    let cipher = ChaCha20Poly1305::new(Key::from_slice(&key));
    let nonce = Nonce::from_slice(&payload.nonce);
    let plaintext = cipher.decrypt(nonce, payload.ciphertext.as_ref())?;
    Ok(plaintext)
}

pub fn encrypt_vault(vault: &crate::models::Vault, password: &str) -> Result<SecurePayload, VaultError> {
    let json = serde_json::to_vec(vault)?;
    encrypt_payload(&json, password)
}

pub fn decrypt_vault(payload: &SecurePayload, password: &str) -> Result<crate::models::Vault, VaultError> {
    let plaintext = decrypt_payload(payload, password)?;
    let vault: crate::models::Vault = serde_json::from_slice(&plaintext)?;
    Ok(vault)
}
