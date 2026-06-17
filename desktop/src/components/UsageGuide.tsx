'use client';

import { useState } from 'react';
import { CircleHelp, Search, Plus, Terminal, GitCompare, Lock, BookOpen, Eye, Wifi } from 'lucide-react';
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
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>How to Use {APP_NAME}</DialogTitle>
          <DialogDescription className="sr-only">
            A guide to managing projects, environment variables, and vault security in {APP_NAME}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1 text-sm flex-1 min-h-0">
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
              Switch to the <strong>Terminal</strong> view. Select a project and enter a command (e.g. <code className="text-xs bg-muted px-1 rounded">printenv</code>). {APP_NAME} injects the project's env vars into the process.
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
              Your vault is encrypted with <strong>Argon2id</strong> + <strong>ChaCha20Poly1305</strong> and stored locally. Click <strong>Lock Vault</strong> in the sidebar to lock it. Close the app to auto-lock.
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 font-semibold mb-1">
              <Wifi className="h-3.5 w-3.5 text-primary" /> LAN Sync (Team Collaboration)
            </h3>
            <p className="text-muted-foreground">
              Share projects with teammates on the same local network. Open the <strong>LAN Sync</strong> section in the sidebar and click <strong>Start</strong>. Give each device a unique name (click the pencil icon next to your device name).
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
                    <td className="px-2 py-1.5 text-muted-foreground break-words">Under Device B, you see B's projects <strong>4, 5</strong> — click to <strong>download</strong></td>
                    <td className="px-2 py-1.5 text-muted-foreground break-words">Under Device A, you see A's projects <strong>1, 2, 3</strong> — click to <strong>download</strong></td>
                  </tr>
                  <tr className="border-t border-border/40">
                    <td className="px-2 py-1.5 font-medium text-center">4</td>
                    <td className="px-2 py-1.5 text-muted-foreground break-words">Project <strong>4</strong> appears in your vault (alongside 1, 2, 3)</td>
                    <td className="px-2 py-1.5 text-muted-foreground break-words">Project <strong>1</strong> appears in your vault (alongside 4, 5)</td>
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
