# ENVEIL — Centralized .env & Secret Vault

A desktop application for securely managing environment variables and secrets across multiple projects. Built with **Tauri v1** (Rust backend) + **Next.js 14** (TypeScript frontend).

<p align="center">
  <a href="https://github.com/kyawsoe-dev/enveil/releases/latest">
    <img alt="macOS" src="https://img.shields.io/badge/macOS-Download-black?logo=apple&style=for-the-badge" />
  </a>
  <a href="https://github.com/kyawsoe-dev/enveil/releases/latest">
    <img alt="Windows" src="https://img.shields.io/badge/Windows-Download-blue?logo=windows&style=for-the-badge" />
  </a>
  <a href="https://github.com/kyawsoe-dev/enveil/releases/latest">
    <img alt="Linux" src="https://img.shields.io/badge/Linux-Download-orange?logo=linux&style=for-the-badge" />
  </a>
</p>

## Download

Grab the latest installer for your platform from the [releases page](https://github.com/kyawsoe-dev/enveil/releases/latest) (`.dmg` for macOS, `.msi` for Windows, `.deb` for Linux).

### macOS Troubleshooting

If macOS blocks the app from opening (unverified developer), run this in Terminal:

```bash
xattr -cr /Applications/ENVEIL.app
```

This removes the quarantine attribute. Then open the app normally.

## Screenshots

| Dashboard | Env Table | Diff View | Terminal Runner |
|---|---|---|---|
| ![](screenshots/dashboard.png) | ![](screenshots/env-table.png) | ![](screenshots/diff-view.png) | ![](screenshots/terminal-runner.png) |
| **LAN Sync** | **LAN Download** | **Settings** | **Usage Guide** |
| ![](screenshots/lan-sync.png) | ![](screenshots/lan-sync-download.png) | ![](screenshots/settings.png) | ![](screenshots/usage-guide.png) |
| **Temp .env (before)** | **Temp .env (after)** | **Env Version History** | **Drag & Drop Import** |
| ![](screenshots/before-link-to-project.png) | ![](screenshots/after-link-to-project.png) | ![](screenshots/env-version-history.png) | ![](screenshots/env-drap-and-drop-import.png) |

## Features

| Feature | Description |
|---|---|---|
| **Encrypted Vault** | Master password → Argon2id → ChaCha20Poly1305 encrypted `vault.bin` on disk |
| **Project CRUD** | Create, edit, rename, delete projects (each with a key-value env map) |
| **Inline Env Editing** | Add, edit, bulk import, and delete env vars per project |
| **Multi-Select Bulk Ops** | Checkbox column + Shift-click range selection + floating action bar for batch delete/copy |
| **Export / Copy All** | Export project env vars as `.env` file; one-click Copy All button |
| **Project Diff** | Side-by-side comparison of any two projects or against a `.env` file |
| **Terminal Runner** | Run shell commands with decrypted env vars injected — streaming output, Stop, Kill by port, command history, per-project cwd |
| **Project Run Command** | Save a run command per project (e.g. `npm start`) and launch it from the linked toolbar with one click |
| **Env Var Version History** | Auto-snapshots on every save; browse history with side-by-side preview diff; restore any snapshot |
| **Dashboard Analytics** | Stats cards + bar chart ranking projects by env var count |
| **Search** | Cmd+K search across project names, env keys, and env values |
| **Drag & Drop Import** | Drop `.env` files or paste `KEY=VALUE` content onto the env table; conflict dialog for existing keys |
| **Open Folder / Terminal** | Open a project's linked folder in Finder and Terminal with one click |
| **.env.example Generation** | Generate a `.env.example` file from the current project's env var keys |
| **Change Password** | Re-encrypts entire vault with a new master password |
| **Auto-Lock** | Lock vault after configurable inactivity timeout; running processes auto-stop on lock |
| **Reset Vault** | Securely wipe the entire vault and all projects |
| **Temp .env File** | Generate a secure (600 perms) temporary `.env` file in `/tmp`, symlinked into your project folder. Auto-updated on edit, auto-deleted on vault lock |
| **LAN Sync** | Share projects with teammates on the same local network with per-project share passwords for download authorization |
| **Dark/Light/System Theme** | Class-based theming via `next-themes` |
| **Project Duplicate** | Duplicate existing projects to create copies with shared env vars |
| **Vault Backup & Restore** | Export your entire vault to a `.vault` backup file (same Argon2id + ChaCha20Poly1305 format) and restore later with Merge or Replace mode |
| **.env Auto-Sync** | Editing the linked `.env` file in your editor automatically syncs changes back to the vault — history snapshots are created on every sync |
| **Process Group Isolation** | Running commands use process groups so Kill/Stop terminates all child processes (no orphaned `node`/`npm` processes) |
| **CSS Tooltips** | Hover tooltips on Apply vault-to-file / Apply file-to-vault buttons in DiffView |

## Architecture

```
┌──────────────────────────────────┐
│         Frontend (Next.js)       │
│  ┌─────────┐ ┌────────────────┐  │
│  │ Sidebar │ │ Dashboard /    │  │
│  │ (nav)   │ │ DiffView /     │  │
│  │         │ │ TerminalRunner │  │
│  └─────────┘ └────────────────┘  │
│  ┌────────────────────────────┐  │
│  │   VaultProvider (context)  │  │
│  └────────────────────────────┘  │
└──────────────┬───────────────────┘
               │ IPC (tauri::invoke)
┌──────────────▼───────────────────┐
│         Rust Core (Tauri)        │
│  ┌────────────────────────────┐  │
│  │  31 tauri::commands          │  │
│  └──────────┬─────────────────┘  │
│  ┌──────────▼─────────────────┐  │
│  │  Vault in memory (plain)   │  │
│  │  ┌──────────────────────┐  │  │
│  │  │ Argon2id → Key       │  │  │
│  │  │ ChaCha20Poly1305     │  │  │
│  │  └──────────────────────┘  │  │
│  └──────────┬─────────────────┘  │
│  ┌──────────▼─────────────────┐  │
│  │  vault.bin (disk, enc.)    │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

## Flow Chart

```mermaid
flowchart TD
    subgraph Frontend["Frontend (Next.js 14)"]
        S[Sidebar]
        DV[Dashboard / DiffView / TerminalRunner]
        VP["VaultProvider<br/>(React Context)"]
        S --> VP
        DV --> VP
    end

    subgraph IPC["IPC Layer"]
        INV[tauri::invoke]
    end

    subgraph Rust["Rust Core (Tauri v1)"]
        CMD[31 tauri::commands]
        VAULT[Vault in Memory<br/><i>plaintext</i>]
        CRYPTO[Argon2id → ChaCha20Poly1305]
        CMD --> VAULT
        VAULT <--> CRYPTO
    end

    subgraph Storage["Disk"]
        FILE[vault.bin<br/><i>encrypted</i>]
    end

    subgraph Network["LAN Sync"]
        MDNS[mDNS Discovery]
        TCP[TCP Transport<br/><i>encrypted</i>]
        MDNS <--> TCP
    end

    VP --> IPC
    IPC --> CMD
    CRYPTO <--> FILE
    VAULT <--> TCP
    TCP <--> |same network| PEER[Peer Devices]
```

## LAN Sync Flow

```mermaid
flowchart TD
    START([User clicks Start]) --> IPC_start[invoke: start_lan_sync]
    IPC_start --> MDNS_REG[mDNS: register _enveil._tcp service]
    IPC_start --> MDNS_BROWSE[mDNS: browse for _enveil._tcp peers]
    MDNS_REG --> POLL{{get_sync_status every 3s}}
    MDNS_BROWSE --> POLL
    POLL --> DECIDE{Peers found?}

    DECIDE -->|No| POLL

    DECIDE -->|Yes| PEER_LIST[Frontend shows peer cards<br/>with device name + IP]
    PEER_LIST --> USER_CLICK[User clicks Download<br/>on a peer project]
    USER_CLICK --> PWD_DIALOG[Share password dialog opens]
    PWD_DIALOG --> IPC_SYNC[invoke: sync_project_from_peer]

    subgraph Rust["Rust Backend (Receiver)"]
        IPC_SYNC --> TCP_CONNECT[TCP connect to peer<br/>ip:port from PeerInfo]
        TCP_CONNECT --> HANDSHAKE["Send Hello
        wait for Challenge"]
        HANDSHAKE --> CHALLENGE_RESP[Send challenge response<br/>encrypted with vault master password]
        CHALLENGE_RESP --> RESP{Peer response}
        RESP -->|success| REQ_PROJ[Request project by ID]
        RESP -->|error| ERR[Return error to frontend]
        REQ_PROJ --> RECV_DATA[Receive encrypted project data]
        RECV_DATA --> DECRYPT[Decrypt with ChaCha20Poly1305]
        DECRYPT --> SAVE[Save project to vault]
        SAVE --> OK[Return success]
    end

    subgraph Peer["Peer Device (Sender)"]
        TCP_LISTEN[TCP listener on port] --> ACCEPT[Accept connection]
        ACCEPT --> SEND_CHALLENGE["Send Challenge
        (random bytes)"]
        SEND_CHALLENGE --> VERIFY[Verify decrypted challenge<br/>with project share password]
        VERIFY -->|OK| ENCRYPT[Encrypt project data<br/>with ChaCha20Poly1305]
        VERIFY -->|Fail| SEND_ERR[Send error response]
        ENCRYPT --> SEND_DATA[Send encrypted project]
    end

    OK --> REFRESH[Refresh vault UI]
    ERR --> RETRY[Show error on peer card<br/>auto-retry every 3s]
```

## Project Structure

```
├── desktop/                          Next.js 14 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            Root layout, metadata, font loading
│   │   │   ├── page.tsx              AppShell (sidebar + content routing)
│   │   │   └── globals.css           Tailwind base + custom CSS vars
│   │   ├── components/
│   │   │   ├── ui/                   shadcn-style primitives
│   │   │   │   ├── badge.tsx, button.tsx, card.tsx, dialog.tsx
│   │   │   │   ├── input.tsx, separator.tsx, toast.tsx, toaster.tsx
│   │   │   ├── AppBrand.tsx          Logo/wordmark component
│   │   │   ├── ChangePasswordDialog.tsx
│   │   │   ├── Dashboard.tsx         Analytics + env table view
│   │   │   ├── DeleteProjectDialog.tsx  Delete project confirmation
│   │   │   ├── DiffView.tsx          Side-by-side project comparison
│   │   │   ├── EditProjectDialog.tsx Add/edit project dialog
│   │   │   ├── EnvTable.tsx          Inline env var editing + bulk import + export
│   │   │   ├── MasterAuth.tsx        Login/create vault screen
│   │   │   ├── ProjectView.tsx       Selected project detail view
│   │   │   ├── ResetVaultDialog.tsx  Wipe vault confirmation
│   │   │   ├── SearchBar.tsx         Cmd+K search across all data
│   │   │   ├── SettingsDialog.tsx    Vault settings (auto-lock, security)
│   │   │   ├── Sidebar.tsx           Project list + collapse + theme toggle
│   │   │   ├── TerminalRunner.tsx    Shell command runner with env injection
│   │   │   ├── ThemeProvider.tsx     next-themes wrapper
│   │   │   ├── UsageGuide.tsx        Help modal
│   │   │   └── VaultProvider.tsx     React context (state + dispatch)
│   │   ├── lib/
│   │   │   ├── brand.ts              App name, logo paths, brand font class
│   │   │   ├── tauri.ts              invoke wrappers (31 commands)
│   │   │   ├── types.ts              TS interfaces (Vault, Project, DiffResult…)
│   │   │   └── utils.ts              cn() helper
│   │   ├── global.d.ts               *.css module declaration
│   │   └── hooks/
│   │       └── use-toast.ts          Toast notification hook
│   ├── tailwind.config.ts            Fonts (Bitcount Single, Inter, JetBrains Mono)
│   └── package.json                  Dependencies (next, react, tauri, tailwind…)
│
├── src-tauri/                        Rust backend
│   ├── src/
│   │   ├── main.rs                   Tauri builder, state, handler registration
│   │   ├── error.rs                  VaultError enum
│   │   ├── models/
│   │   │   ├── vault.rs              Vault, Project, SecurePayload
│   │   │   └── diff.rs               DiffResult + diff_projects()
│   │   ├── network/
│   │   │   ├── discovery.rs          mDNS service discovery
│   │   │   ├── transport.rs          Encrypted transfer over TCP
│   │   │   └── types.rs              PeerInfo, ProjectSummary, SyncState
│   │   ├── crypto/
│   │   │   ├── key_derivation.rs     Argon2id → 32-byte key
│   │   │   └── encryption.rs         ChaCha20Poly1305 encrypt/decrypt
│   │   ├── storage/
│   │   │   └── vault_file.rs         Save/load encrypted vault file
│   │   ├── commands/
│   │   │   │   ├── vault_commands.rs     Vault commands (unlock, save, delete…)
│   │   │   │   └── sync_commands.rs      LAN sync commands (start, stop, download)
│   ├── tauri.conf.json               Window config (fullscreen), allowlist, icons
│   └── Cargo.toml                    Rust dependencies
│
└── README.md                         This file
```

## Security

| Measure | Implementation |
|---|---|
| **Key Derivation** | Argon2id (64 MB memory, 3 iterations, 4 parallelism) |
| **Encryption** | ChaCha20Poly1305 — authenticated encryption with 192-bit nonce |
| **Storage** | Encrypted `vault.bin` in OS config directory (`~/.config/env-vault/`) |
| **Memory** | Plaintext vault held only in process memory after unlock |
| **Process Isolation** | Injected env vars scoped to child process — never written to global environment |
| **Error handling** | All Tauri commands return `Result<T, String>`; internal errors propagate via `VaultError` |

## IPC Commands

All commands return `Result<T, String>` for frontend consumption.

| Command | Args | Returns |
|---|---|---|
| `initialize_vault` | `password: String` | `()` |
| `unlock_vault` | `password: String` | `Vault` |
| `save_project` | `password: String, project: Project` | `()` |
| `delete_project` | `password: String, project_id: String` | `()` |
| `diff_projects` | `project_a_id: String, project_b_id: String` | `DiffResult` |
| `diff_project_with_file` | `project_id: String, file_path: String` | `DiffResult` |
| `run_command` | `command: String, project_id: String` | `String` (stdout + stderr) |
| `run_command_stream` | `command: String, project_id: String` | `()` (emits `terminal:output` / `terminal:done` events) |
| `stop_command` | — | `()` |
| `kill_process_on_port` | `port: u16` | `()` |
| `vault_exists` | — | `bool` |
| `change_password` | `old_password: String, new_password: String` | `()` |
| `get_vault` | — | `Option<Vault>` |
| `reset_vault` | — | `()` |
| `open_folder` | `path: String` | `()` |
| `open_in_terminal` | `path: String` | `()` |
| `generate_env_example` | `project_id: String, password: String` | `String` (file path) |
| `get_project_history` | `project_id: String` | `Vec<EnvSnapshot>` |
| `restore_snapshot` | `project_id: String, snapshot_index: number, password: String` | `()` |
| `start_lan_sync` | — | `()` |
| `stop_lan_sync` | — | `()` |
| `get_sync_status` | — | `SyncState` |
| `get_peers` | — | `Vec<PeerInfo>` |
| `get_peer_projects` | `peerDeviceName: String` | `Vec<ProjectSummary>` |
| `sync_project_from_peer` | `peerDeviceName: String, projectId: String, password: String, sharePassword: String` | `Project` |
| `set_device_name` | `name: String` | `()` |
| `generate_temp_env` | `projectId: String, symlinkPath: String?, password: String` | `String` (temp file path) |
| `regenerate_temp_env` | `projectId: String` | `()` |
| `delete_temp_env` | `projectId: String` | `()` |
| `cleanup_all_temp_envs` | — | `()` |
| `get_temp_env_status` | `projectId: String` | `TempEnvStatus?` |
| `export_vault` | `password: String, outputPath: String` | `()` |
| `import_vault` | `password: String, inputPath: String, mode: String ("replace" | "merge")` | `()` |

## Data Models

```rust
pub struct Vault {
    pub version: u32,
    pub projects: Vec<Project>,
}

pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub env_vars: BTreeMap<String, String>,
    pub share_password: Option<String>,  // Optional password for LAN sync downloads
    pub history: Vec<EnvSnapshot>,       // Auto-snapshotted on every save (capped at 50)
    pub run_cmd: Option<String>,         // Saved run command for Terminal (e.g. "npm start")
}

pub struct EnvSnapshot {
    pub timestamp: i64,
    pub label: String,
    pub env_vars: BTreeMap<String, String>,
}

pub struct SecurePayload {
    pub salt: Vec<u8>,       // 32 bytes
    pub nonce: Vec<u8>,      // 12 bytes
    pub ciphertext: Vec<u8>,
}

pub struct DiffResult {
    pub project_a_name: String,
    pub project_b_name: String,
    pub only_in_a: BTreeMap<String, String>,
    pub only_in_b: BTreeMap<String, String>,
    pub changed: BTreeMap<String, (String, String)>,
}

pub struct TempEnvStatus {
    pub temp_path: String,
    pub symlink_path: Option<String>,
}
```

## Typography

| Usage | Font |
|---|---|
| Brand (logo) | **Bitcount Single** |
| UI / system | **Inter** |
| Code / env values | **JetBrains Mono** |

Loaded via `<link>` + `<style>` in `layout.tsx` (not CSS `@import` to avoid PostCSS ordering issues).

## Development

```bash
# Prerequisites: Rust, Node.js, Tauri CLI

# Install frontend dependencies
cd desktop && npm install

# Run Tauri dev server (starts Next.js dev + Tauri window)
cargo tauri dev
```

### Build for Ubuntu 24.04 (Noble)

```bash
# Install system dependencies
sudo apt install \
  libwebkit2gtk-4.0-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  build-essential \
  libssl-dev \
  file

# Build release bundle (.deb, .AppImage) — for signed updater, set your private key
TAURI_PRIVATE_KEY="your_private_key_here" TAURI_KEY_PASSWORD="" cargo tauri build
```

The frontend is a static Next.js export (`next build`, output in `desktop/out/`). Tauri loads `../desktop/out/index.html` as the webview source.

## Rust Dependencies

| Crate | Purpose |
|---|---|
| `tauri` v1 | Desktop shell, IPC bridge, fs/path/shell/dialog allowlist |
| `serde` / `serde_json` | Serialization |
| `argon2` 0.5 | Argon2id key derivation |
| `chacha20poly1305` 0.10 | Authenticated symmetric encryption |
| `directories` 5 | Cross-platform config directory |
| `uuid` 1 | Project identifiers |
| `thiserror` 1 | Error types |
| `rand` 0.8 | Salt & nonce generation |
| `mdns-sd` 0.13 | LAN service discovery via mDNS |
| `notify` 7 | Cross-platform file system watcher for `.env` auto-sync |

---

**Developer:** Kyaw Soe &nbsp;|&nbsp; **License:** MIT