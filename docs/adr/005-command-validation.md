# ADR-005: Command Validation and Process Isolation

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

ENVEIL's Terminal Runner injects decrypted env vars into child processes. This creates a security risk: a malicious or careless command could destroy the system, leak secrets, or escape the sandbox.

## Decision

Implement a **denylist-based command validator** and **process group isolation** for all spawned commands.

### Command Validation (`validate_command`)

Blocked patterns (case-insensitive):
- `rm -rf /` and variants (`rm -rf ~`, `rm -rf *`)
- `mkfs`, `dd if=`, `:(){ :|:& };:` (fork bomb)
- `poweroff`, `reboot`, `shutdown`
- `curl | sh`, `wget | sh` (remote code execution)
- `> /dev/sda` (disk overwrite)

### Process Isolation

- `process_group(0)` on Unix — all child processes in a separate process group
- `kill(-pid, SIGTERM)` terminates entire group — no orphaned `node`/`npm` processes
- Port-based kill: `lsof -ti:{port} | xargs kill` to stop processes by port

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Allowlist (whitelist)** | Maximum security | Impractical — users need arbitrary commands |
| **Docker container** | Full isolation | Heavy, complex setup, not suitable for dev tools |
| **Denylist + process group** | Practical, blocks known dangerous patterns | Can't catch every novel attack vector |
| **SELinux/AppArmor** | Kernel-level enforcement | Platform-specific, complex |
| **No validation** | Simple | Catastrophic risk |

## Consequences

- **Positive:** Blocks most destructive commands, process group prevents orphaned processes, port-based kill is useful for web dev workflows
- **Negative:** Denylist can't catch every dangerous command (novel attack vectors), case-insensitive check may have false positives
- **Neutral:** Validation runs before command execution — fail-closed design, error returned to frontend as user-visible message

## References

- `src-tauri/src/commands/vault_commands.rs` — `validate_command()` + tests
- `src-tauri/src/commands/sync_commands.rs` — `run_command_stream()` with process_group
- `desktop/src/components/TerminalRunner.tsx` — frontend terminal UI
