# Architecture Decision Records — ENVEIL

This directory contains Architecture Decision Records (ADRs) documenting key technical decisions in the ENVEIL project.

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [001](001-tauri-nextjs-stack.md) | Tauri v1 + Next.js 14 as Desktop Stack | Accepted | 2026 |
| [002](002-encryption-scheme.md) | Argon2id + ChaCha20Poly1305 for Encryption | Accepted | 2026 |
| [003](003-single-file-storage.md) | Single Encrypted File Storage (vault.bin) | Accepted | 2026 |
| [004](004-lan-sync-protocol.md) | LAN Sync via mDNS + TCP with Share Passwords | Accepted | 2026 |
| [005](005-command-validation.md) | Command Validation and Process Isolation | Accepted | 2026 |
| [006](006-state-management.md) | React Context + useReducer for State Management | Accepted | 2026 |
| [007](007-tauri-security-config.md) | Tauri Allowlist and CSP Configuration | Accepted | 2026 |
| [008](008-testing-strategy.md) | Vitest + Playwright for Testing | Accepted | 2026 |
| [009](009-temp-env-symlink.md) | Secure Temp .env Files with Symlink | Accepted | 2026 |

## Decision Categories

### Security
- **ADR-002** — Encryption scheme (Argon2id + ChaCha20Poly1305)
- **ADR-005** — Command validation and process isolation
- **ADR-007** — Tauri allowlist and CSP
- **ADR-009** — Temp .env file permissions

### Architecture
- **ADR-001** — Desktop stack (Tauri + Next.js)
- **ADR-003** — Storage format (single encrypted file)
- **ADR-006** — State management (React Context + useReducer)

### Integration
- **ADR-004** — LAN sync protocol (mDNS + TCP)

### Quality
- **ADR-008** — Testing strategy (cargo test + Vitest + Playwright)
