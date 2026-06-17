#!/usr/bin/env python3
"""Fake ENVEIL peer for testing LAN sync without a second device.

Simulates the full ENVEIL peer behavior: vault lock/unlock state,
mDNS registration, TCP server with all protocol messages.

Usage:
    python3 test_peer.py --name "Test-Device"

Commands (type in terminal):
    unlock <password>   Unlock vault (default password: test123)
    lock                Lock vault
    status              Show current state
    help                Show commands
    quit / Ctrl+C       Stop

When locked:  ProjectListRequest returns empty [].
When unlocked: Returns 3 fake projects.
"""
import argparse
import json
import os
import signal
import socket
import struct
import subprocess
import sys
import threading
import time

try:
    from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305  # type: ignore[import-untyped]
    from cryptography.hazmat.primitives.kdf.argon2 import Argon2id  # type: ignore[import-untyped]
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

VAULT_PASSWORD = "test123"
vault_locked = True
vault_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Fake project data
# ---------------------------------------------------------------------------

FAKE_PROJECTS_DATA = [
     {
        "id": "proj-test",
        "name": "example-project-test",
        "description": "Example project for testing LAN sync",
        "share_password": "test-share-1",
        "env_vars": {
            "EXAMPLE_KEY1": "value-aaaa",
            "EXAMPLE_KEY2": "value-bbbb",
            "EXAMPLE_KEY3": "value-cccc",
            "EXAMPLE_KEY4": "value-dddd",
            "EXAMPLE_KEY5": "value-eeee",
            "EXAMPLE_KEY6": "value-ffff",
            "EXAMPLE_KEY7": "value-gggg",
            "EXAMPLE_KEY8": "value-hhhh",
        },
    },
    {
        "id": "proj-001",
        "name": "example-project-alpha",
        "description": "Example project for testing LAN sync",
        "share_password": "test-share-1",
        "env_vars": {
            "EXAMPLE_KEY1": "value-aaaa",
            "EXAMPLE_KEY2": "value-bbbb",
            "EXAMPLE_KEY3": "value-cccc",
            "EXAMPLE_KEY4": "value-dddd",
            "EXAMPLE_KEY5": "value-eeee",
            "EXAMPLE_KEY6": "value-ffff",
            "EXAMPLE_KEY7": "value-gggg",
            "EXAMPLE_KEY8": "value-hhhh",
        },
    },
    {
        "id": "proj-002",
        "name": "example-project-beta",
        "description": "Another example project for LAN sync testing",
        "share_password": "test-share-2",
        "env_vars": {
            "EXAMPLE_KEY_A": "value-01",
            "EXAMPLE_KEY_B": "value-02",
            "EXAMPLE_KEY_C": "value-03",
            "EXAMPLE_KEY_D": "value-04",
        },
    },
    {
        "id": "proj-003",
        "name": "example-project-gamma",
        "description": "Third example project for testing",
        "share_password": "test-share-3",
        "env_vars": {
            "EXAMPLE_VAR1": "test-value-1",
            "EXAMPLE_VAR2": "test-value-2",
            "EXAMPLE_VAR3": "test-value-3",
            "EXAMPLE_VAR4": "test-value-4",
            "EXAMPLE_VAR5": "test-value-5",
            "EXAMPLE_VAR6": "test-value-6",
        },
    },
]


def make_project_summary(data):
    return {
        "id": data["id"],
        "name": data["name"],
        "description": data["description"],
        "env_count": len(data["env_vars"]),
        "has_password": True,
    }


# ---------------------------------------------------------------------------
# Protocol helpers
# ---------------------------------------------------------------------------

def send_msg(conn, msg):
    data = json.dumps(msg).encode()
    conn.sendall(struct.pack(">I", len(data)))
    conn.sendall(data)


def recv_msg(conn):
    raw = conn.recv(4)
    if not raw:
        return None
    length = struct.unpack(">I", raw)[0]
    data = b""
    while len(data) < length:
        chunk = conn.recv(length - len(data))
        if not chunk:
            return None
        data += chunk
    return json.loads(data)


# ---------------------------------------------------------------------------
# Encryption (matches Rust: Argon2id + ChaCha20-Poly1305)
# ---------------------------------------------------------------------------

if HAS_CRYPTO:
    def encrypt_project(project_json: bytes, password: str) -> dict:
        salt = os.urandom(16)
        kdf = Argon2id(
            salt=salt,
            length=32,
            memory_cost=19456,
            time_cost=2,
            parallelism=1,
        )
        key = kdf.derive(password.encode())
        nonce = os.urandom(12)
        aead = ChaCha20Poly1305(key)
        ct = aead.encrypt(nonce, project_json, None)
        return {
            "type": "EncryptedProjectResponse",
            "encrypted_data": list(ct),
            "nonce": list(nonce),
            "salt": list(salt),
        }
else:
    def encrypt_project(project_json: bytes, password: str) -> dict:
        print("  [WARN] cryptography not installed — sending unencrypted")
        return None


# ---------------------------------------------------------------------------
# TCP client handler
# ---------------------------------------------------------------------------

def handle_client(conn, addr):
    global vault_locked
    print(f"  Client connected: {addr}")
    try:
        while True:
            msg = recv_msg(conn)
            if msg is None:
                break
            typ = msg.get("type")

            if typ == "Hello":
                print(f"  Hello from: {msg.get('device_name')} v{msg.get('app_version')}")
                send_msg(conn, {"type": "Ack"})

            elif typ == "ProjectListRequest":
                with vault_lock:
                    locked = vault_locked
                if locked:
                    print("  Project list requested -> vault LOCKED, returning []")
                    send_msg(conn, {"type": "ProjectListResponse", "projects": []})
                else:
                    shared = [d for d in FAKE_PROJECTS_DATA if d.get("share_password")]
                    summaries = [make_project_summary(d) for d in shared]
                    print(f"  Project list requested -> sending {len(summaries)} shared projects")
                    send_msg(conn, {"type": "ProjectListResponse", "projects": summaries})

            elif typ == "ProjectRequest":
                pid = msg.get("project_id")
                share_pwd = msg.get("password", "")
                with vault_lock:
                    locked = vault_locked

                if locked:
                    print(f"  Download requested: {pid} — vault LOCKED, refusing")
                    send_msg(conn, {"type": "Error", "message": "Vault is locked"})
                    continue

                data = next((d for d in FAKE_PROJECTS_DATA if d["id"] == pid), None)
                if not data:
                    print(f"  Download requested: {pid} — not found")
                    send_msg(conn, {"type": "Error", "message": f"Project {pid} not found"})
                    continue

                print(f"  Download requested: {pid} (session key: {'yes' if share_pwd else 'no'})")

                expected_pwd = data.get("share_password", "")
                if share_pwd != expected_pwd:
                    print(f"  Incorrect share password for {pid}")
                    send_msg(conn, {"type": "Error", "message": "Incorrect share password"})
                    continue

                project_json = json.dumps({
                    "id": data["id"],
                    "name": data["name"],
                    "description": data["description"],
                    "env_vars": data["env_vars"],
                    "share_password": data.get("share_password"),
                }).encode()

                if HAS_CRYPTO:
                    encrypted = encrypt_project(project_json, share_pwd)
                    if encrypted:
                        send_msg(conn, encrypted)
                        continue

                # No crypto available: send unencrypted
                resp = {
                    "type": "ProjectResponse",
                    "id": data["id"],
                    "name": data["name"],
                    "description": data["description"],
                    "env_vars": data["env_vars"],
                }
                send_msg(conn, resp)

            else:
                print(f"  Unknown message type: {typ}")
                send_msg(conn, {"type": "Error", "message": f"Unexpected: {typ}"})

    except (ConnectionResetError, BrokenPipeError):
        pass
    except json.JSONDecodeError:
        pass
    finally:
        conn.close()
        print(f"  Client disconnected: {addr}")


# ---------------------------------------------------------------------------
# Stdin command loop
# ---------------------------------------------------------------------------

def cmd_loop():
    global vault_locked
    while True:
        try:
            line = sys.stdin.readline()
        except KeyboardInterrupt:
            break
        if not line:
            break
        line = line.strip()
        parts = line.split()
        if not parts:
            continue
        cmd = parts[0].lower()
        if cmd == "unlock":
            if len(parts) < 2:
                print("  Usage: unlock <password>")
            elif parts[1] == VAULT_PASSWORD:
                with vault_lock:
                    vault_locked = False
                print("  Vault UNLOCKED — projects now visible to peers")
            else:
                print("  Wrong password")
        elif cmd == "lock":
            with vault_lock:
                vault_locked = True
            print("  Vault LOCKED — projects hidden from peers")
        elif cmd == "status":
            with vault_lock:
                locked = vault_locked
            print(f"  Vault: {'LOCKED' if locked else 'UNLOCKED'}")
            print(f"  Vault password: {VAULT_PASSWORD}")
            print(f"  Crypto available: {HAS_CRYPTO}")
        elif cmd in ("quit", "exit", "q"):
            print("  Stopping...")
            os._exit(0)
        elif cmd == "help":
            print("  Commands:")
            print("    unlock <password>   Unlock vault")
            print("    lock                Lock vault")
            print("    status              Show state")
            print("    help                This help")
            print("    quit                Stop")
        else:
            print(f"  Unknown command: {cmd}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Full ENVEIL test peer")
    parser.add_argument("--name", default="Test-Device", help="Device name to advertise")
    parser.add_argument("--port", type=int, default=0, help="TCP port (0 = auto)")
    args = parser.parse_args()

    port = args.port or 0
    name = args.name.replace(" ", "-")

    # Start TCP server
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", port))
    server.listen(5)
    actual_port = server.getsockname()[1]
    print(f"TCP server listening on port {actual_port}")

    # Register mDNS via system dns-sd command
    proc = subprocess.Popen(
        ["dns-sd", "-R", name, "_enveil._tcp", "local.", str(actual_port)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)
    if proc.poll() is not None:
        print("ERROR: dns-sd failed to start (already running?)")
        server.close()
        sys.exit(1)
    print(f"mDNS registered as '{name}' via dns-sd (PID {proc.pid})")
    if not HAS_CRYPTO:
        print("  [WARN] 'cryptography' package not installed — encrypted sync not available")
        print("         Install: pip install cryptography\n")

    print(f"  Vault password: {VAULT_PASSWORD}  (type 'unlock {VAULT_PASSWORD}' to unlock)")
    print(f"  Start ENVEIL -> LAN Sync -> you'll see '{name}' as a peer")
    print(f"  Download projects and type commands here to test lock/unlock\n")

    print("Commands: unlock <pwd>, lock, status, help, quit")
    print("─" * 50)

    def cleanup(*_):
        print("\nShutting down...")
        proc.terminate()
        proc.wait()
        server.close()

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # Start stdin command thread
    t = threading.Thread(target=cmd_loop, daemon=True)
    t.start()

    try:
        while True:
            conn, addr = server.accept()
            threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()
    except (KeyboardInterrupt, OSError):
        cleanup()
        sys.exit(0)


if __name__ == "__main__":
    main()
