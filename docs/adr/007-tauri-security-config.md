# ADR-007: Tauri Allowlist and CSP Configuration

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

Tauri v1 uses an allowlist model to declare which OS capabilities the frontend can access. Combined with Content Security Policy (CSP), this limits the attack surface of the webview.

## Decision

Use a **minimal allowlist** with explicit capabilities, and a **strict CSP** that blocks external scripts and resources.

### Allowlist

```json
{
  "all": false,
  "dialog": { "open": true, "save": true },
  "fs": { "all": true },
  "shell": { "all": false, "open": true },
  "clipboard": { "writeText": true }
}
```

### CSP

```
default-src 'self';
font-src 'self' https://fonts.gstatic.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
script-src 'self';
img-src 'self' data:;
connect-src 'self' https://api.github.com
```

### Design Rationale

| Capability | Needed For | Risk Mitigation |
|---|---|---|
| `fs.all` | Read/write vault.bin, temp .env files | Path traversal protection in `validate_path()` |
| `dialog.open/save` | Import/export vault, .env files | User explicitly selects paths |
| `shell.open` | Open folder in Finder/Terminal | No shell command execution via Tauri API |
| `clipboard.writeText` | Copy env vars to clipboard | Write-only, no read (prevents silent clipboard theft) |
| `connect-src 'self'` | AI proxy, GitHub updater | Blocks arbitrary network from webview |

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **`"all": true`** | Easy | Exposes dangerous APIs (http, execute, etc.) |
| **No CSP** | Simple | XSS could exfiltrate data to external servers |
| **Strict CSP + minimal allowlist** | Defense in depth | More configuration, but security justifies it |

## Consequences

- **Positive:** Webview can't execute arbitrary shell commands, can't read arbitrary files (enforced by Tauri + path validation), can't make arbitrary network requests
- **Negative:** `fs.all: true` is broad — mitigated by `validate_path()` in Rust; no clipboard read (user can paste but app can't silently read)
- **Neutral:** CSP `unsafe-inline` for styles is required by Tailwind's dynamic class generation; `connect-src` allows GitHub for update checks

## References

- `src-tauri/tauri.conf.json` — allowlist, CSP, updater config
- `src-tauri/src/commands/vault_commands.rs` — `validate_path()` blocks `/proc/`, `/sys/`, `/dev/`
