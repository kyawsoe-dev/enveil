# Changelog

## v0.1.5 (2026-07-03)

### AI Integration
- AI-powered .env template generation — describe your stack, get structured suggestions
- Validate env variable values for suspicious patterns
- Generate docstrings explaining what each env key does
- Summarize diffs between project versions in plain English
- Smart suggestions when creating projects or adding env vars
- Floating AI chat — ask questions about ENVEIL, env vars, or secrets management
- 100 daily AI requests per user, resets each day
- All AI features disable automatically when you go offline
- **OpenRouter credentials embedded at build time** — API key, model, and base URL are baked into the binary via `option_env!()`. No manual environment setup required for end users

### Bug Fixes
- macOS terminal runner now loads your shell environment (fixes npm, nvm, brew not found)
- Back-to-top button no longer shows when you haven't scrolled

### Infrastructure
- Release CI passes `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, and `OPENROUTER_MODEL` as build env vars to all platform build jobs
- Rust `ai_env_var()` helper tries compile-time embedding first, falls back to runtime `std::env::var()`
