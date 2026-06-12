"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Key,
  FileEdit,
  Pencil,
  Trash2,
  Upload,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useVault } from "./VaultProvider";
import EditProjectDialog from "./EditProjectDialog";
import type { Project } from "@/lib/types";

export default function EnvTable() {
  const { state, saveProject } = useVault();
  const selected = state.vault?.projects.find(
    (p) => p.id === state.selectedProjectId,
  );
  const [revealAll, setRevealAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Key className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Select a project from the sidebar to view its variables
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/20 text-xs font-bold text-primary">
            {selected.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2 className="text-sm font-medium">{selected.name}</h2>
            {selected.description && (
              <p className="text-xs text-muted-foreground">
                {selected.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditProjectDialog project={selected} onSave={saveProject} />
          <Badge variant="secondary" className="font-mono text-xs">
            {Object.keys(selected.env_vars).length} vars
          </Badge>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">Variables</span>
        <div className="flex-1" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search variables..."
          className="h-7 w-44 rounded border bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {Object.keys(selected.env_vars).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevealAll(!revealAll)}
            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
            title={revealAll ? "Hide all values" : "Show all values"}
          >
            {revealAll ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {revealAll ? "Hide All" : "Show All"}
          </Button>
        )}
        <ExportButton project={selected} />
        <BulkImportDialog project={selected} onSave={saveProject} />
        <AddEnvVarDialog project={selected} onSave={saveProject} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-8 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="w-28 px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(selected.env_vars)
              .filter(([key, value]) =>
                `${key} ${value}`
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase()),
              )
              .map(([key, value], idx) => (
                <EnvVarRow
                  key={key}
                  idx={idx}
                  name={key}
                  value={value}
                  project={selected}
                  onSave={saveProject}
                  revealAll={revealAll}
                />
              ))}
            {Object.keys(selected.env_vars).length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  No environment variables defined
                </td>
              </tr>
            )}
            {searchQuery &&
              Object.keys(selected.env_vars).length > 0 &&
              Object.entries(selected.env_vars).filter(([key, value]) =>
                `${key} ${value}`
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase()),
              ).length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-sm text-muted-foreground"
                  >
                    No variables match &quot;{searchQuery}&quot;
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EnvVarRow({
  idx,
  name,
  value,
  project,
  onSave,
  revealAll,
}: {
  idx: number;
  name: string;
  value: string;
  project: Project;
  onSave: (p: Project) => Promise<void>;
  revealAll: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRevealed(revealAll);
  }, [revealAll]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleDelete = async () => {
    const updated: Project = {
      ...project,
      env_vars: Object.fromEntries(
        Object.entries(project.env_vars).filter(([k]) => k !== name),
      ),
    };
    await onSave(updated);
  };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: idx * 0.015 }}
      className="border-b border-border/40 transition-colors hover:bg-accent/30"
    >
      <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
        {idx + 1}
      </td>
      <td className="px-3 py-2">
        <span className="font-mono text-xs font-medium text-env-key">
          {name}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="max-w-[400px] overflow-x-auto scrollbar-thin">
          <span
            className={cn(
              "font-mono text-xs transition-all",
              revealed
                ? "text-env-value"
                : "text-transparent [text-shadow:0_0_8px_hsl(215_20%_65%/0.6)]",
            )}
          >
            {value}
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <EditEnvVarDialog
            project={project}
            onSave={onSave}
            oldKey={name}
            oldValue={value}
          />
          <button
            onClick={() => setRevealed(!revealed)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleCopy}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleDelete}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

function EditEnvVarDialog({
  project,
  onSave,
  oldKey,
  oldValue,
}: {
  project: Project;
  onSave: (p: Project) => Promise<void>;
  oldKey: string;
  oldValue: string;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(oldKey);
  const [value, setValue] = useState(oldValue);

  const handleSave = async () => {
    if (!key.trim()) return;
    const newKey = key.trim();
    const envs = { ...project.env_vars };
    delete envs[oldKey];
    envs[newKey] = value;
    const updated: Project = { ...project, env_vars: envs };
    await onSave(updated);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={() => {
            setKey(oldKey);
            setValue(oldValue);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Variable</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the key and value of this environment variable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              KEY
            </label>
            <Input
              value={key}
              onChange={(e) =>
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
              }
              className="font-mono text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              VALUE
            </label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <Button
            onClick={handleSave}
            className="w-full gap-2"
            disabled={!key.trim()}
          >
            <FileEdit className="h-4 w-4" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportButton({ project }: { project: Project }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const content = Object.entries(project.env_vars)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const safeName = project.name.replace(/[^\w.-]+/g, "_") || "project";

    setExporting(true);
    try {
      const { save } = await import("@tauri-apps/api/dialog");
      const { writeTextFile } = await import("@tauri-apps/api/fs");
      const path = await save({
        defaultPath: `${safeName}.env`,
        filters: [{ name: "Env", extensions: ["env"] }],
      });
      if (!path) return;
      await writeTextFile(path, content);
    } catch (err) {
      console.error("Export failed:", err);
      try {
        await navigator.clipboard.writeText(content);
        window.alert(
          "Could not save file. Environment variables were copied to your clipboard instead.",
        );
      } catch {
        window.alert(`Export failed: ${String(err)}`);
      }
    } finally {
      setExporting(false);
    }
  };

  if (Object.keys(project.env_vars).length === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className="gap-1.5 h-7 text-xs"
      title="Export as .env"
    >
      <Download className="h-3.5 w-3.5" />
      {exporting ? "Saving..." : "Export"}
    </Button>
  );
}

function BulkImportDialog({
  project,
  onSave,
}: {
  project: Project;
  onSave: (p: Project) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const handleImport = async () => {
    const envs = { ...project.env_vars };
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      if (k) envs[k] = v;
    }
    const updated: Project = { ...project, env_vars: envs };
    await onSave(updated);
    setText("");
    setOpen(false);
  };

  const parsedCount = text.split("\n").filter((l) => {
    const t = l.trim();
    return t && !t.startsWith("#") && t.includes("=");
  }).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs">
          <Upload className="h-3.5 w-3.5" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import Variables</DialogTitle>
          <DialogDescription className="text-xs">
            Paste your .env content below. One KEY=VALUE per line. Lines
            starting with # are ignored.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="DATABASE_URL=postgres://localhost:5432/db&#10;API_KEY=sk-abc123&#10;NODE_ENV=production"
            rows={8}
            className="w-full rounded border bg-card px-3 py-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {parsedCount} variable{parsedCount !== 1 ? "s" : ""} detected
            </span>
            <Button
              onClick={handleImport}
              className="gap-2"
              disabled={parsedCount === 0}
            >
              <Upload className="h-4 w-4" />
              Import {parsedCount > 0 ? `(${parsedCount})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddEnvVarDialog({
  project,
  onSave,
}: {
  project: Project;
  onSave: (p: Project) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  const handleSave = async (close?: boolean) => {
    if (!key.trim()) return;
    const updated: Project = {
      ...project,
      env_vars: { ...project.env_vars, [key.trim()]: value },
    };
    await onSave(updated);
    setKey("");
    setValue("");
    if (close) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Add Variable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Environment Variable</DialogTitle>
          <DialogDescription className="sr-only">
            Add a new key-value pair to this project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              KEY
            </label>
            <Input
              value={key}
              onChange={(e) =>
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
              }
              placeholder="DATABASE_URL"
              className="font-mono text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              VALUE
            </label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="postgres://localhost:5432/db"
              className="font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleSave()}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              disabled={!key.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add & Continue
            </Button>
            <Button
              onClick={() => handleSave(true)}
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              disabled={!key.trim()}
            >
              Add & Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
