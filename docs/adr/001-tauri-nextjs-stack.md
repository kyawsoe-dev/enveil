# ADR-001: Tauri v1 + Next.js 14 as Desktop Stack

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

ENVEIL needs a cross-platform desktop app (macOS, Windows, Linux) for managing encrypted `.env` vaults. The UI requires modern components (dashboards, diff views, terminal runners, drag-and-drop).

## Decision

Use **Tauri v1** (Rust backend) with **Next.js 14** (React/TypeScript frontend) instead of Electron or Tauri v2.

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Electron** | Mature, large ecosystem | ~150MB bundle, ships Chromium, high memory usage |
| **Tauri v2** | Newer APIs, mobile support | Still beta at project start, breaking changes from v1 |
| **Tauri v1 + Next.js** | Small binary (~8MB), native Rust crypto, SSR-capable | WebView quirks on some Linux distros |
| **Flutter desktop** | Single codebase for mobile+desktop | Weaker Rust interop, fewer security-focused crates |

## Consequences

- **Positive:** Tiny binaries, Rust-native crypto (Argon2id, ChaCha20Poly1305), no Chromium overhead, IPC bridge lets frontend call Rust commands directly
- **Negative:** Tauri v1 WebView can differ across OS; Next.js must be statically exported (`next build` → `desktop/out/`)
- **Neutral:** Tauri's allowlist model forces explicit capability declaration — good for security review but requires upfront planning

## References

- `src-tauri/tauri.conf.json` — allowlist, CSP, updater config
- `src-tauri/Cargo.toml` — 13 Rust dependencies, no unused crates
- `desktop/package.json` — Next.js 14.2.33, React 18, Tailwind
