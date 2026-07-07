# ADR-004: LAN Sync via mDNS + TCP with Share Passwords

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

Teams need to share `.env` configurations between devices on the same network without a central server. The sharing must be secure (encrypted) and require explicit authorization per project.

## Decision

Use **mDNS** (`mdns-sd` crate) for peer discovery and **TCP** for encrypted project transfer. Each project has an optional `share_password` that authorizes download.

### Protocol

1. **Discovery:** `mdns-sd` registers `_enveil._tcp` service; peers browse for it
2. **Connection:** TCP connect to peer's advertised IP:port
3. **Handshake:** Send `Hello` → receive `Challenge` (random bytes)
4. **Auth:** Decrypt challenge using project's `share_password` as key; send response
5. **Transfer:** Request project by ID → receive encrypted project data → decrypt with ChaCha20Poly1305

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Bluetooth** | Works without WiFi | Low bandwidth, pairing complexity |
| **WebSocket server** | Real-time, works across networks | Requires hosting, authentication infrastructure |
| **mDNS + TCP** | Zero config, local network only, no internet needed | Only works on same LAN, no relay for different networks |
| **QR code / file export** | Simple, no network needed | Manual process, no real-time sync |
| **Git-based sync** | Version control built-in | Requires git, overkill for .env sharing |

## Consequences

- **Positive:** Zero configuration (mDNS auto-discovers), LAN-only (no internet exposure), per-project share passwords (granular access control), TCP transfer is fast for small payloads
- **Negative:** Only works on same LAN, no NAT traversal, no offline sync, mDNS can be flaky on some corporate networks
- **Neutral:** Challenge-response prevents replay attacks; share password is not the vault master password (separate authorization layer)

## References

- `src-tauri/src/network/discovery.rs` — mDNS registration and browsing
- `src-tauri/src/network/transport.rs` — TCP handshake and transfer
- `src-tauri/src/network/types.rs` — PeerInfo, SyncMessage enum
- `src-tauri/src/commands/sync_commands.rs` — IPC commands for sync
