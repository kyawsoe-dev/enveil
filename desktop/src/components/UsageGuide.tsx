'use client';

import { useState } from 'react';
import { CircleHelp, Search, Plus, Terminal, GitCompare, Lock, BookOpen, Eye, Wifi, Copy, FileText, ExternalLink, RefreshCw, Trash2, Upload, FolderOpen, CheckSquare, History, FileOutput } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { APP_NAME } from '@/lib/brand';

export default function UsageGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors" title="Usage Guide">
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="fixed inset-0 w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 rounded-none flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>How to Use {APP_NAME}</DialogTitle>
          <DialogDescription className="sr-only">
            A guide to managing projects, environment variables, and vault security in {APP_NAME}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1 text-sm flex-1 min-h-0 p-6">
          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Plus className="h-3.5 w-3.5 text-primary" /> Add a Project
            </h3>
            <p className="text-muted-foreground">
              Click the <strong>Add Project</strong> button in the sidebar. Enter a name (e.g. <code className="text-xs bg-muted px-1 rounded">my-service</code>) and optional description, then click <strong>Create Project</strong>.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Copy className="h-3.5 w-3.5 text-primary" /> Duplicate a Project
            </h3>
<p className="text-muted-foreground">
              Hover over a project in the sidebar and click the copy icon to duplicate it. The duplicate copies all env vars from the original project with a new ID.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Search className="h-3.5 w-3.5 text-primary" /> Search Env Vars
            </h3>
            <p className="text-muted-foreground">
              Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Cmd+K</kbd> to open the search bar. Search by <strong>project name</strong>, <strong>env key</strong>, or <strong>env value</strong>. Select a result to jump directly to it.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Terminal className="h-3.5 w-3.5 text-primary" /> Run Commands
            </h3>
            <p className="text-muted-foreground">
              Switch to the <strong>Terminal</strong> view. Select a project and enter a command (e.g. <code className="text-xs bg-muted px-1 rounded">printenv</code>). {APP_NAME} injects the project's env vars into the process. Output streams in real time — click <strong>Stop</strong> to halt a running command.
            </p>
            <p className="text-muted-foreground mt-2">
              If a command fails (e.g. port conflict), the button changes to <strong>Kill</strong> — click it to kill the orphaned process holding that port. Use <code className="text-xs bg-muted px-1 rounded">cd &lt;dir&gt;</code> as a built-in to change the working directory for subsequent commands.
            </p>
            <p className="text-muted-foreground mt-2">
              Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">↑</kbd><kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">↓</kbd> to cycle through command history, or <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Ctrl+L</kbd> to clear output.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <BookOpen className="h-3.5 w-3.5 text-primary" /> Terminal Built-in Commands
            </h3>
            <p className="text-muted-foreground mb-2">
              These commands run locally without calling the system shell:
            </p>
            <div className="overflow-hidden rounded-lg border text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">Command</th>
                    <th className="px-3 py-1.5 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/40">
                    <td className="px-3 py-1.5 font-mono text-env-key">help, --help, -h</td>
                    <td className="px-3 py-1.5 text-muted-foreground">Show help message with available commands and examples</td>
                  </tr>
                  <tr className="border-t border-border/40">
                    <td className="px-3 py-1.5 font-mono text-env-key">clear, cls</td>
                    <td className="px-3 py-1.5 text-muted-foreground">Clear the terminal output</td>
                  </tr>
                  <tr className="border-t border-border/40">
                    <td className="px-3 py-1.5 font-mono text-env-key">env</td>
                    <td className="px-3 py-1.5 text-muted-foreground">Print all injected environment variables</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-2">
              All other commands run in the system shell with the selected project's env vars injected.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <GitCompare className="h-3.5 w-3.5 text-primary" /> Compare Projects
            </h3>
            <p className="text-muted-foreground">
              Switch to the <strong>Compare</strong> view. Pick two projects to see their env var differences: keys only in A, only in B, and keys with changed values.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Lock className="h-3.5 w-3.5 text-primary" /> Security
            </h3>
            <p className="text-muted-foreground">
              Your vault is encrypted with <strong>Argon2id</strong> + <strong>ChaCha20Poly1305</strong> and stored locally. Click <strong>Lock Vault</strong> in the sidebar to lock it — any running terminal process is automatically stopped. Close the app to auto-lock.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <FileText className="h-3.5 w-3.5 text-primary" /> Temp .env File
            </h3>
            <p className="text-muted-foreground">
              Generate a secure temporary <code className="text-xs bg-muted px-1 rounded">.env</code> file in your project folder. Click <strong>Generate &amp; Link</strong>, pick your project folder, and choose an environment suffix (<code className="text-xs bg-muted px-1 rounded">.env</code>, <code className="text-xs bg-muted px-1 rounded">.env.development</code>, etc.). A symlink is created in your project folder pointing to a secure temp file (600 permissions) in the system temp directory.
            </p>
            <p className="text-muted-foreground mt-2">
              The temp file auto-updates when you edit env vars — no manual refresh needed. Use <strong>Regenerate</strong> to force a refresh, or <strong>Unlink</strong> to remove the symlink and temp file. All temp files are automatically deleted when you lock the vault.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Terminal className="h-3.5 w-3.5 text-primary" /> Run Project Command
            </h3>
            <p className="text-muted-foreground">
              Once a project is <strong>Linked</strong> (has a temp .env symlink), the toolbar shows a command bar with the project directory and a <strong>Play</strong> button. Click the command label to set a run command (e.g. <code className="text-xs bg-muted px-1 rounded">npm run dev</code>, <code className="text-xs bg-muted px-1 rounded">npm start</code>, <code className="text-xs bg-muted px-1 rounded">python3 app.py</code>).
            </p>
            <p className="text-muted-foreground mt-2">
              Click <strong>Play</strong> to run that command in the linked project directory with all vault env vars injected. The terminal opens automatically and shows live streaming output. The command is saved to the project — it persists across sessions.
            </p>
            <p className="text-muted-foreground mt-2">
              Example: if your symlink is at <code className="text-xs bg-muted px-1 rounded">/Users/me/my-project/.env</code>, the command runs from <code className="text-xs bg-muted px-1 rounded">/Users/me/my-project/</code> with env vars injected, just like having a real <code className="text-xs bg-muted px-1 rounded">.env</code> file in the folder.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <CheckSquare className="h-3.5 w-3.5 text-primary" /> Multi-Select Bulk Operations
            </h3>
            <p className="text-muted-foreground">
              Click the checkbox next to a variable to select it. <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Shift+Click</kbd> to select a range. The floating action bar appears at the top of the table — delete or copy selected variables in one click. Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Esc</kbd> to clear all selections.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <FolderOpen className="h-3.5 w-3.5 text-primary" /> Open Folder & Terminal
            </h3>
            <p className="text-muted-foreground">
              When a project is <strong>Linked</strong> (has a temp .env symlink), the toolbar shows <strong>Finder</strong> and <strong>Terminal</strong> buttons. Click <strong>Finder</strong> to reveal the project folder. Click <strong>Terminal</strong> to open a system terminal in that directory.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <FileOutput className="h-3.5 w-3.5 text-primary" /> .env.example Generation
            </h3>
            <p className="text-muted-foreground">
              Click the <strong>Generate .env.example</strong> outline button (right side of the toolbar) to create a <code className="text-xs bg-muted px-1 rounded">.env.example</code> file from the current project's env var keys. A native save dialog lets you choose the location.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <History className="h-3.5 w-3.5 text-primary" /> Env Var Version History
            </h3>
            <p className="text-muted-foreground">
              Every time you save a project, a snapshot is automatically created. Click the <strong>History</strong> button (clock icon) in the project toolbar to open the history panel. Browse snapshots (newest first), preview exact changes (added / removed / changed / unchanged), and click <strong>Confirm Restore</strong> to revert to any snapshot. The panel is resizable — drag the left edge to adjust its width.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <GitCompare className="h-3.5 w-3.5 text-primary" /> Compare with .env File
            </h3>
            <p className="text-muted-foreground">
              Click <strong>Compare with .env File</strong> (right side of the toolbar) to diff the current project's env vars against an external <code className="text-xs bg-muted px-1 rounded">.env</code> file on disk. A native open dialog lets you pick the file. The diff view shows added, removed, and changed keys. Click <strong>Apply</strong> to overwrite the project's vars with the file's values, or <strong>Exit</strong> to discard.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Copy className="h-3.5 w-3.5 text-primary" /> Copy All Variables
            </h3>
            <p className="text-muted-foreground">
              Click the <strong>Copy All</strong> ghost button next to <strong>Show All</strong> in the env table header to copy all env vars as <code className="text-xs bg-muted px-1 rounded">KEY=VALUE</code> lines to your clipboard. The button shows a green checkmark briefly as confirmation.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Upload className="h-3.5 w-3.5 text-primary" /> Drag & Drop Import
            </h3>
            <p className="text-muted-foreground">
              Drag a <code className="text-xs bg-muted px-1 rounded">.env</code> file onto the env var table to import. A compact banner appears on drag — release to import. If keys already exist, a conflict dialog lets you pick which to overwrite. You can also paste <code className="text-xs bg-muted px-1 rounded">KEY=VALUE</code> content directly onto the table.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Wifi className="h-3.5 w-3.5 text-primary" /> LAN Sync (Team Collaboration)
            </h3>
            <p className="text-muted-foreground">
               Share projects with teammates on the same local network. Open the <strong>LAN Sync</strong> section in the sidebar and click <strong>Start</strong>. Give each device a unique name (click the pencil icon next to your device name). Only projects with a password can be downloaded from other devices.
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border text-xs">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="bg-muted/50 text-left text-muted-foreground">
                    <th className="w-10 px-2 py-1.5 font-medium">Step</th>
                    <th className="px-2 py-1.5 font-medium">Device A (has projects 1, 2, 3)</th>
                    <th className="px-2 py-1.5 font-medium">Device B (has projects 4, 5)</th>
                  </tr>
                </thead>
                <tbody>
                   <tr className="border-t border-border/40">
                     <td className="px-2 py-1.5 font-medium text-center">1</td>
                     <td className="px-2 py-1.5 text-muted-foreground break-words">Click <strong>Start</strong> in LAN Sync</td>
                     <td className="px-2 py-1.5 text-muted-foreground break-words">Click <strong>Start</strong> in LAN Sync</td>
                   </tr>
                   <tr className="border-t border-border/40">
                     <td className="px-2 py-1.5 font-medium text-center">2</td>
                     <td className="px-2 py-1.5 text-muted-foreground break-words">See <strong>Device B</strong> appear in your peer list</td>
                     <td className="px-2 py-1.5 text-muted-foreground break-words">See <strong>Device A</strong> appear in your peer list</td>
                   </tr>
                   <tr className="border-t border-border/40">
                     <td className="px-2 py-1.5 font-medium text-center">3</td>
                     <td className="px-2 py-1.5 text-muted-foreground break-words">Under Device B, you see B's projects <strong>4, 5</strong> — click to <strong>download</strong> and enter the project password</td>
                     <td className="px-2 py-1.5 text-muted-foreground break-words">Under Device A, you see A's projects <strong>1, 2, 3</strong> — click to <strong>download</strong> and enter the project password</td>
                   </tr>
                   <tr className="border-t border-border/40">
                     <td className="px-2 py-1.5 font-medium text-center">4</td>
                     <td className="px-2 py-1.5 text-muted-foreground break-words">Project <strong>4</strong> appears in your vault (alongside 1, 2, 3) after entering the correct password</td>
                     <td className="px-2 py-1.5 text-muted-foreground break-words">Project <strong>1</strong> appears in your vault (alongside 4, 5) after entering the correct password</td>
                   </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              All data stays on your LAN. Both devices must be on the same network. Transfers are encrypted with a random session key — no plaintext ever leaves your machine. Rename each device using the pencil icon to easily tell them apart.
            </p>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
