use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng, Payload},
    ChaCha20Poly1305, Key, Nonce,
};
use rand::RngCore;

use crate::error::VaultError;
use crate::models::SecurePayload;

use super::key_derivation::derive_key;

pub fn encrypt_payload(plaintext: &[u8], password: &str) -> Result<SecurePayload, VaultError> {
    let mut salt = vec![0u8; 32];
    OsRng.fill_bytes(&mut salt);

    let mut key = derive_key(password, &salt)?;
    let cipher = ChaCha20Poly1305::new(Key::from_slice(&key));

    let mut nonce_bytes = vec![0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Authenticate salt + nonce as associated data
    let aad = build_aad(&salt, &nonce_bytes);
    let payload = Payload {
        msg: plaintext,
        aad: &aad,
    };
    let ciphertext = cipher.encrypt(nonce, payload)?;

    // Zeroize key
    zeroize_key(&mut key);

    Ok(SecurePayload {
        salt,
        nonce: nonce_bytes,
        ciphertext,
    })
}

pub fn decrypt_payload(payload: &SecurePayload, password: &str) -> Result<Vec<u8>, VaultError> {
    if payload.nonce.len() != 12 {
        return Err(VaultError::General("Invalid nonce length".into()));
    }
    if payload.salt.len() != 32 {
        return Err(VaultError::General("Invalid salt length".into()));
    }
    let mut key = derive_key(password, &payload.salt)?;
    let cipher = ChaCha20Poly1305::new(Key::from_slice(&key));
    let nonce = Nonce::from_slice(&payload.nonce);

    // Try with AAD first (new format), fall back to no-AAD (legacy vaults)
    let aad = build_aad(&payload.salt, &payload.nonce);
    let payload_aead = Payload {
        msg: payload.ciphertext.as_ref(),
        aad: &aad,
    };
    let result = cipher.decrypt(nonce, payload_aead);

    let plaintext = match result {
        Ok(p) => p,
        Err(_) => {
            // Fall back to legacy decryption without AAD
            let legacy = cipher.decrypt(Nonce::from_slice(&payload.nonce), payload.ciphertext.as_ref())?;
            legacy
        }
    };

    // Zeroize key
    zeroize_key(&mut key);

    Ok(plaintext)
}

fn build_aad(salt: &[u8], nonce: &[u8]) -> Vec<u8> {
    let mut aad = Vec::with_capacity(4 + salt.len() + 4 + nonce.len());
    aad.extend_from_slice(&(salt.len() as u32).to_be_bytes());
    aad.extend_from_slice(salt);
    aad.extend_from_slice(&(nonce.len() as u32).to_be_bytes());
    aad.extend_from_slice(nonce);
    aad
}

fn zeroize_key(key: &mut [u8; 32]) {
    use std::sync::atomic::{compiler_fence, Ordering};
    key.fill(0);
    compiler_fence(Ordering::SeqCst);
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
