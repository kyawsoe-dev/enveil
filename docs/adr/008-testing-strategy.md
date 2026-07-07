# ADR-008: Vitest + Playwright for Testing

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

ENVEIL had zero test infrastructure. The project needs three layers: Rust unit tests (crypto, vault logic), frontend unit tests (pure functions, hooks), and E2E tests (browser automation).

## Decision

Use **cargo test** for Rust, **Vitest** for frontend unit tests, and **Playwright** for E2E tests.

### Test Breakdown (as of v0.1.5)

| Layer | Framework | Count | What's Tested |
|---|---|---|---|
| Rust | `cargo test` | 69 | Key derivation, encrypt/decrypt, vault CRUD, diff, command validation, AI config URL, error types, network serde |
| Frontend | Vitest | 73 | parseEnvContent, reducer (15 actions), duplicateProject logic, AI rate limiting, securityScore, useToast, useClipboardTimeout |
| E2E | Playwright | 9 | Vault auth screen, unlock button states, password toggle, input focus, page error handling |

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Jest** | Most popular | Slow, ESM issues, requires babel |
| **Vitest** | Fast, ESM-native, compatible with Jest API | Newer, smaller ecosystem |
| **Cypress** | Good DX, time-travel debugging | Heavier, Tauri compatibility issues |
| **Playwright** | Multi-browser, fast, good for Tauri webview | Newer than Cypress |
| **pytest (Python)** | Mature for backend | Doesn't integrate with Rust or frontend |
| **No tests** | Zero effort | Unacceptable for security-critical app |

## Consequences

- **Positive:** Vitest runs in <1s for 73 tests, Playwright catches real browser bugs, cargo test catches crypto logic errors, all three run in CI
- **Negative:** E2E tests require dev server running (Playwright `webServer` config starts Next.js), no integration tests yet (Tauri IPC mocking is complex)
- **Neutral:** Frontend tests use extracted pure functions (reducer, securityScore) rather than full component rendering — pragmatic trade-off for coverage speed

## References

- `desktop/vitest.config.ts` — Vitest config with jsdom, exclude e2e
- `desktop/playwright.config.ts` — Playwright config with webServer
- `desktop/src/__tests__/` — 7 test files
- `desktop/e2e/` — 2 spec files
- `src-tauri/src/` — inline `#[cfg(test)]` modules in 8 files
