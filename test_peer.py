#!/usr/bin/env python3
"""Fake ENVEIL peer for testing LAN sync without a second device.

Usage:
    python3 test_peer.py --name "Test-Device" --port 51995

Runs a mock ENVEIL peer that:
  - Registers mDNS service so the real app discovers it
  - Responds to project list requests with fake projects
  - Responds to download requests (no encryption)

Press Ctrl+C to stop.
"""
import argparse
import json
import socket
import struct
import threading
import time

try:
    from zeroconf import Zeroconf, ServiceInfo
except ImportError:
    print("Install zeroconf: pip3 install zeroconf")
    raise


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


FAKE_PROJECTS = [
    {"id": "proj-001", "name": "staging-api-keys", "description": "Staging environment credentials", "env_count": 8},
    {"id": "proj-002", "name": "prod-db-creds", "description": "Production database credentials", "env_count": 4},
    {"id": "proj-003", "name": "s3-bucket-keys", "description": "S3 access keys and secrets", "env_count": 6},
]


def handle_client(conn, addr):
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
                print(f"  Project list requested → sending {len(FAKE_PROJECTS)} projects")
                send_msg(conn, {"type": "ProjectListResponse", "projects": FAKE_PROJECTS})
            elif typ == "ProjectRequest":
                pid = msg.get("project_id")
                pwd = msg.get("password", "")
                print(f"  Download requested: {pid} (password: {'yes' if pwd else 'no'})")
                proj = next((p for p in FAKE_PROJECTS if p["id"] == pid), None)
                if proj:
                    send_msg(conn, {
                        "type": "ProjectResponse",
                        "id": proj["id"],
                        "name": proj["name"],
                        "description": proj["description"],
                        "env_vars": {
                            "API_KEY": "sk-test-123456",
                            "DB_PASSWORD": "s3cret!",
                            "HOST": "localhost",
                            "PORT": "5432",
                            "USER": "admin",
                            "REGION": "us-east-1",
                            "BUCKET": "my-bucket",
                            "SECRET": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                        },
                    })
                else:
                    send_msg(conn, {"type": "Error", "message": f"Project {pid} not found"})
            else:
                print(f"  Unknown message type: {typ}")
                send_msg(conn, {"type": "Error", "message": f"Unexpected: {typ}"})
    except (ConnectionResetError, BrokenPipeError):
        pass
    finally:
        conn.close()
        print(f"  Client disconnected: {addr}")


def main():
    parser = argparse.ArgumentParser(description="Fake ENVEIL peer for testing")
    parser.add_argument("--name", default="Test-Device", help="Device name to advertise")
    parser.add_argument("--port", type=int, default=51995, help="TCP port to listen on")
    args = parser.parse_args()

    # Start TCP server
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", args.port))
    server.listen(5)
    print(f"TCP server listening on port {args.port}")

    # Register mDNS
    zc = Zeroconf()
    info = ServiceInfo(
        type_="_enveil._tcp.local.",
        name=f"{args.name}._enveil._tcp.local.",
        port=args.port,
        properties={},
        server=f"{args.name}.local.",
    )
    zc.register_service(info)
    print(f"mDNS registered as '{args.name}'")
    print(f"\n  Now open ENVEIL → LAN Sync → Start")
    print(f"  You should see '{args.name}' appear as a peer")
    print(f"  Press the Download button to fetch fake projects\n")
    print("Press Ctrl+C to stop\n")

    try:
        while True:
            conn, addr = server.accept()
            threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        zc.unregister_service(info)
        zc.close()
        server.close()


if __name__ == "__main__":
    main()
