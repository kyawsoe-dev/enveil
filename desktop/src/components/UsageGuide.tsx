'use client';

import { useState } from 'react';
import { CircleHelp, Search, Plus, Terminal, GitCompare, Lock, BookOpen, Eye, Wifi, Copy, FileText, ExternalLink, RefreshCw, Trash2, Upload, FolderOpen, CheckSquare, History, FileOutput, Download, Merge, Activity, Sparkles, MessageCircle, BarChart3, AlertTriangle, GripVertical } from 'lucide-react';
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
              Switch to the <strong>Terminal</strong> view. Select a project and enter a command (e.g. <code className="text-xs bg-muted px-1 rounded">printenv</code>). {APP_NAME} injects the project's env vars into the process. Output streams in real time — click <strong>Stop</strong> to halt a running command. All commands run in an isolated process group — <strong>Stop</strong> and <strong>Kill</strong> terminate the command <em>and all of its child processes</em> (no orphaned <code className="text-xs bg-muted px-1 rounded">node</code> / <code className="text-xs bg-muted px-1 rounded">npm</code> processes left behind).
            </p>
            <p className="text-muted-foreground mt-2">
              If a command fails (e.g. port conflict), the button changes to <strong>Kill</strong> — click it to kill the process holding that port. Use <code className="text-xs bg-muted px-1 rounded">cd &lt;dir&gt;</code> as a built-in to change the working directory for subsequent commands.
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
              The temp file auto-updates when you edit env vars — no manual refresh needed. Edits made directly to the file (in your editor) are also synced <strong>back</strong> to the vault automatically, with a history snapshot created on each sync. Use <strong>Regenerate</strong> to force a refresh, or <strong>Unlink</strong> to remove the symlink and temp file. All temp files are automatically deleted when you lock the vault.
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

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Download className="h-3.5 w-3.5 text-primary" /> Vault Backup & Restore
            </h3>
            <p className="text-muted-foreground">
              Open <strong>Settings</strong> from the sidebar. Click <strong>Backup Vault</strong> to export your entire vault to a <code className="text-xs bg-muted px-1 rounded">.vault</code> file (same Argon2id + ChaCha20Poly1305 encryption as <code className="text-xs bg-muted px-1 rounded">vault.bin</code>). A native save dialog lets you choose the location.
            </p>
            <p className="text-muted-foreground mt-2">
              Click <strong>Restore Vault</strong> and pick a <code className="text-xs bg-muted px-1 rounded">.vault</code> file to restore. Choose <strong>Merge</strong> to import projects without overwriting existing ones (duplicate IDs are skipped), or <strong>Replace</strong> to completely overwrite your vault. The vault refreshes automatically after restore.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Activity className="h-3.5 w-3.5 text-primary" /> .env Auto-Sync
            </h3>
            <p className="text-muted-foreground">
              After linking a temp <code className="text-xs bg-muted px-1 rounded">.env</code> file, any edit you make to that file (in your editor or via <code className="text-xs bg-muted px-1 rounded">echo</code>) is automatically synced back to the vault. A history snapshot labeled <em>"Auto-sync from .env file"</em> is created on each sync so you can revert if needed.
            </p>
            <p className="text-muted-foreground mt-2">
              To prevent loops, the sync only triggers when the file content actually differs from the vault. Regenerating the temp file (via the <strong>Regenerate</strong> vault button) does <em>not</em> cause a reverse sync.
            </p>
          </section>

          {/* AI Features */}
          <section>
            <h2 className="flex items-center gap-1.5 font-semibold text-base mb-3 mt-6 border-b border-border/40 pb-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Assistant
            </h2>
            <p className="text-muted-foreground mb-3">
              {APP_NAME} integrates with <strong>OpenRouter</strong> to provide smart AI assistance for env var management. To enable, set these environment variables before launching the app: <code className="text-xs bg-muted px-1 rounded">OPENROUTER_API_KEY</code>, <code className="text-xs bg-muted px-1 rounded">OPENROUTER_MODEL</code>, <code className="text-xs bg-muted px-1 rounded">OPENROUTER_BASE_URL</code>. You can also set them in a <code className="text-xs bg-muted px-1 rounded">.env</code> file in the project root.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <MessageCircle className="h-3.5 w-3.5 text-primary" /> AI Chat
            </h3>
            <p className="text-muted-foreground">
              When AI is configured, a floating chat button appears in the bottom-right corner. Click it to open the AI chat. Ask questions about your env vars, get suggestions, or just chat. The button is <strong>draggable</strong> — its position is saved across sessions. A green signal ring indicates it's connected. You'll see your remaining daily AI requests (100 per day) at the bottom of the chat widget. All AI buttons are automatically disabled when you go offline.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <FileText className="h-3.5 w-3.5 text-primary" /> AI Env Template
            </h3>
            <p className="text-muted-foreground">
              When editing a project, click <strong>AI Template</strong> in the toolbar. Describe your tech stack in plain English (e.g. <em>"Next.js app with Prisma, Redis, and S3"</em>). The AI generates a structured list of env vars with descriptions. Preview them, check the ones you want, and click <strong>Import</strong> to merge them into your project. Existing keys are detected and marked to avoid overwrites.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-primary" /> AI Value Validation
            </h3>
            <p className="text-muted-foreground">
              Click the <strong>Validate</strong> button in the env table toolbar. The AI checks all env var values for security issues: empty values, placeholder text (like <code className="text-xs bg-muted px-1 rounded">password</code> or <code className="text-xs bg-muted px-1 rounded">changeme</code>), database URLs with default passwords, and localhost URLs. Flagged variables show a warning icon — hover to see the issue and severity.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <BookOpen className="h-3.5 w-3.5 text-primary" /> AI Env Docstrings
            </h3>
            <p className="text-muted-foreground">
              Click the <strong>Describe</strong> button next to Validate. The AI generates a one-line description for every env var in your project. Variable names get a dotted underline — hover to see the AI-generated description explaining what the variable is for.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <History className="h-3.5 w-3.5 text-primary" /> AI Diff Summary
            </h3>
            <p className="text-muted-foreground">
              Open a project's <strong>History</strong> panel. Click <strong>Summarize</strong> on any snapshot preview. The AI generates a plain-English paragraph explaining what changed and why — highlighting added, removed, and modified variables in context.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Suggestions
            </h3>
            <p className="text-muted-foreground">
              When creating a new project or env var, look for the <Sparkles className="h-3 w-3 inline" /> sparkle icon. Type a rough description and click the sparkle — the AI fills in the project name/description or env var key/value based on your input.
            </p>
          </section>

          {/* Dashboard */}
          <section>
            <h2 className="flex items-center gap-1.5 font-semibold text-base mb-3 mt-6 border-b border-border/40 pb-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Dashboard Analytics
            </h2>
            <p className="text-muted-foreground">
              The Dashboard gives you a bird's-eye view of your entire vault. Switch to <strong>Dashboard</strong> in the sidebar to see:
            </p>
            <ul className="mt-2 space-y-1 text-muted-foreground text-xs list-disc list-inside">
              <li><strong>Security Score</strong> — A donut chart showing your overall security health (0–100%). Click <strong>Review</strong> to see every flagged variable with its project, key, and the reason it was flagged.</li>
              <li><strong>Vault Stats</strong> — Total projects, variables, unique keys, shared projects, and remaining AI requests for today.</li>
              <li><strong>Projects by Variable Count</strong> — A bar chart ranking projects by env var count. Click any bar to navigate directly to that project.</li>
              <li><strong>Most Common Variable Names</strong> — The top 10 most frequently used keys across all projects.</li>
              <li><strong>Coverage Gaps</strong> — Common keys that some projects are missing (e.g. <code className="text-xs bg-muted px-1 rounded">DATABASE_URL</code>, <code className="text-xs bg-muted px-1 rounded">NODE_ENV</code>).</li>
              <li><strong>Key Categories</strong> — Variables grouped by prefix (e.g. <code className="text-xs bg-muted px-1 rounded">DATABASE_*</code>, <code className="text-xs bg-muted px-1 rounded">REDIS_*</code>, <code className="text-xs bg-muted px-1 rounded">API_*</code>) shown as color-coded chips.</li>
              <li><strong>Missing Critical Vars</strong> — Projects that are missing essential keys like <code className="text-xs bg-muted px-1 rounded">DATABASE_URL</code>, <code className="text-xs bg-muted px-1 rounded">PORT</code>, <code className="text-xs bg-muted px-1 rounded">SECRET_KEY</code>, etc.</li>
              <li><strong>Duplicate Values</strong> — Same secret value used in multiple places across different projects.</li>
              <li><strong>Change Velocity</strong> — How many snapshots each project has per week or month.</li>
              <li><strong>Stale Projects</strong> — Projects with no changes in the last 30 days.</li>
              <li><strong>Recent Changes</strong> — The most recent snapshot across all projects with relative timestamps.</li>
            </ul>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
