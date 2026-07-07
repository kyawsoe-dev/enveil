# ADR-002: Argon2id + ChaCha20Poly1305 for Encryption

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

ENVEIL stores sensitive secrets (API keys, database credentials, passwords). The vault must be encrypted at rest with a user-chosen master password. The scheme must resist offline brute-force attacks and provide authenticated encryption.

## Decision

Use **Argon2id** for key derivation and **ChaCha20-Poly1305** for symmetric encryption.

### Parameters

| Parameter | Value | Rationale |
|---|---|---|
| Argon2id memory | 64 MB | High enough to slow GPU attacks, low enough for mobile/Raspberry Pi |
| Argon2id iterations | 3 | OWASP recommendation for interactive login |
| Argon2id parallelism | 4 | Matches typical 4-core devices |
| Key length | 32 bytes (256-bit) | ChaCha20-Poly1305 requirement |
| Nonce | 12 bytes (96-bit) | Standard for XChaCha20-Poly1305; random per encrypt |
| Salt | 32 bytes | Random per vault, stored in `vault.bin` header |

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **PBKDF2** | Simple, widely available | GPU-attackable, no memory hardness |
| **scrypt** | Memory-hard | Less audited than Argon2, no hybrid mode |
| **AES-256-GCM** | Hardware-accelerated on Intel/ARM | Nonce management trickier; nonce reuse = catastrophic failure |
| **XChaCha20-Poly1305** | Extended nonce (192-bit) | Not in `chacha20poly1305` 0.10 crate |
| **Argon2id + ChaCha20-Poly1305** | OWASP-recommended, memory-hard, no nonce reuse risk | Slightly slower than AES on Intel (but secure) |

## Consequences

- **Positive:** Resistant to GPU/ASIC attacks (Argon2id), authenticated encryption prevents tampering, nonce stored per-vault eliminates reuse risk
- **Negative:** 64 MB memory cost per unlock may be slow on very old devices
- **Neutral:** Salt and nonce are stored in `vault.bin` alongside ciphertext — not a security concern since they aren't secrets

## References

- `src-tauri/src/crypto/key_derivation.rs` — Argon2id implementation
- `src-tauri/src/crypto/encryption.rs` — ChaCha20Poly1305 encrypt/decrypt
- `src-tauri/src/models/vault.rs` — `SecurePayload { salt, nonce, ciphertext }`
