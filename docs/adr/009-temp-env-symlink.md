# ADR-009: Secure Temp .env Files with Symlink

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

Many development tools (docker-compose, npm, etc.) expect a `.env` file in the project directory. ENVEIL stores secrets encrypted in a vault, but developers need plain-text `.env` files during development. The challenge: keep the `.env` file accessible to tools while minimizing exposure.

## Decision

Create a **temp `.env` file** in `/tmp` with restrictive permissions (`600`), then **symlink** it into the project directory. The temp file is auto-updated when vault changes and auto-deleted on vault lock.

### Flow

```
1. User enables temp .env for a project
2. Rust: write decrypted env to /tmp/enveil-{project_id}.env (chmod 600)
3. Rust: create symlink at {project_path}/.env → /tmp/enveil-{project_id}.env
4. notify crate watches the .env file for external edits → syncs back to vault
5. On vault lock: delete temp file and symlink
```

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Write .env directly in project dir** | Simple | File persists after lock, no permission control, conflicts with git |
| **Copy to clipboard** | No file on disk | Only works for manual paste, not for docker-compose |
| **Temp file + symlink** | Auto-cleanup, permission-controlled, tools see it at expected path | Symlink creation may fail on Windows (requires admin or developer mode) |
| **Encrypted .env** | No plaintext on disk | Tools can't read it — defeats the purpose |
| **Docker secret** | Production-grade | Overkill for local dev |

## Consequences

- **Positive:** Temp file auto-deleted on lock (no lingering secrets), `600` perms prevent other users from reading, symlink means tools see `.env` at expected path, external edits sync back to vault
- **Negative:** Windows symlink support is inconsistent (may require developer mode), `/tmp` is world-readable directory (but file perms protect it)
- **Neutral:** `notify` crate watches for external edits — enables round-trip sync between vault and `.env` file

## References

- `src-tauri/src/commands/vault_commands.rs` — `generate_temp_env`, `regenerate_temp_env`, `cleanup_all_temp_envs`
- `desktop/src/components/ProjectView.tsx` — temp .env UI controls
- Security table in README.md — temp file permissions
