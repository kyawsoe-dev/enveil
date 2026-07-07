# ADR-003: Single Encrypted File Storage (vault.bin)

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

ENVEIL needs persistent storage for vault data. Options include a database (SQLite), multiple encrypted files, or a single encrypted blob.

## Decision

Store the entire vault as a single encrypted file `vault.bin` in the OS config directory (`~/.config/env-vault/` on Linux, `~/Library/Application Support/` on macOS, `%APPDATA%` on Windows).

### Format

```
vault.bin = Argon2id(salt, password) → key
          → ChaCha20Poly1305::encrypt(key, nonce, plaintext)
plaintext = serde_json::to_vec(Vault { version, projects[] })
```

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **SQLite + SQLCipher** | ACID, indexed queries | Larger binary, harder to audit, key management for DB key |
| **Multiple encrypted files** | Granular access control | File locking complexity, harder to backup/restore atomically |
| **Single vault.bin** | Simple, atomic, easy to backup/restore | Entire vault decrypted in memory on unlock |
| **Cloud storage** | Sync across devices | Requires auth infrastructure, offline-first breaks |

## Consequences

- **Positive:** Atomic writes (write to temp, rename), trivial backup (copy one file), easy export/import (`.vault` format), no database dependency
- **Negative:** Entire vault loaded into memory on unlock — not suitable for vaults with 10,000+ projects (but realistic usage is <100)
- **Neutral:** History snapshots stored inside each project (capped at 50) — grows file size but avoids separate snapshot files

## References

- `src-tauri/src/storage/vault_file.rs` — save/load logic
- `src-tauri/src/models/vault.rs` — `Vault { version, projects }`
- `src-tauri/src/commands/vault_commands.rs` — unlock, save, export, import
