"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Loader2,
  X,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Sparkles,
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
import { parseEnvContent } from "@/lib/env";
import { useVault } from "./VaultProvider";
import { useClipboardTimeout } from "@/hooks/use-clipboard-timeout";
import EditProjectDialog from "./EditProjectDialog";
import type { Project } from "@/lib/types";
import * as ai from "@/lib/ai";

export default function EnvTable() {
  const { state, saveProject } = useVault();
  const selected = state.vault?.projects.find(
    (p) => p.id === state.selectedProjectId,
  );
  const [revealAll, setRevealAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropState, setDropState] = useState<
    { phase: 'idle' } | { phase: 'drag-over' } | { phase: 'importing' } | { phase: 'success'; count: number } | { phase: 'error'; message: string }
  >({ phase: 'idle' });
  const [pendingImport, setPendingImport] = useState<{
    parsed: Record<string, string>;
    fileName: string;
  } | null>(null);
  const { copyWithTimeout } = useClipboardTimeout();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [copyAllDone, setCopyAllDone] = useState(false);
  const [copySelDone, setCopySelDone] = useState(false);
  const [validateLoading, setValidateLoading] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<Record<string, { issue: string; severity: string }>>({});
  const [docstringsLoading, setDocstringsLoading] = useState(false);
  const [docstrings, setDocstrings] = useState<Record<string, string>>({});
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const go = () => setOnline(true);
    const goOff = () => setOnline(false);
    window.addEventListener('online', go);
    window.addEventListener('offline', goOff);
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', goOff); };
  }, []);
  const lastClickedRef = useRef<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const filteredEntries = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.env_vars)
      .filter(([key, value]) =>
        `${key} ${value}`.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  }, [selected?.env_vars, searchQuery]);

  const filteredKeys = useMemo(() => filteredEntries.map(([k]) => k), [filteredEntries]);

  const allSelected = filteredKeys.length > 0 && filteredKeys.every(k => selectedKeys.has(k));
  const someSelected = filteredKeys.some(k => selectedKeys.has(k));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredKeys));
    }
  };

  const handleSelect = (key: string, shiftKey?: boolean) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (shiftKey && lastClickedRef.current) {
        const currentIdx = filteredKeys.indexOf(key);
        const lastIdx = filteredKeys.indexOf(lastClickedRef.current);
        if (currentIdx !== -1 && lastIdx !== -1) {
          const start = Math.min(currentIdx, lastIdx);
          const end = Math.max(currentIdx, lastIdx);
          for (let i = start; i <= end; i++) {
            next.add(filteredKeys[i]);
          }
        }
      } else {
        if (next.has(key)) next.delete(key);
        else next.add(key);
      }
      return next;
    });
    lastClickedRef.current = key;
  };

  const handleClearSelection = () => {
    setSelectedKeys(new Set());
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedKeys(new Set());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  useEffect(() => {
    setSelectedKeys(new Set());
    setValidationWarnings({});
    setDocstrings({});
  }, [selected?.id]);

  const handleDeleteSelected = async () => {
    if (selectedKeys.size === 0 || !selected) return;
    const keys = Array.from(selectedKeys);
    if (!confirm(`Delete ${keys.length} variable${keys.length !== 1 ? 's' : ''}?\n\n${keys.join('\n')}`)) return;
    const envs = Object.fromEntries(
      Object.entries(selected.env_vars).filter(([k]) => !selectedKeys.has(k)),
    );
    const updated: Project = { ...selected, env_vars: envs };
    await saveProject(updated);
    setSelectedKeys(new Set());
  };

  const handleCopyAll = async () => {
    if (!selected) return;
    const text = Object.entries(selected.env_vars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopyAllDone(true);
    setTimeout(() => setCopyAllDone(false), 1200);
  };

  const handleCopySelected = async () => {
    if (selectedKeys.size === 0 || !selected) return;
    const text = Array.from(selectedKeys)
      .map(k => `${k}=${selected.env_vars[k]}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopySelDone(true);
    setTimeout(() => setCopySelDone(false), 1200);
  };

  const handleExportSelected = async () => {
    if (selectedKeys.size === 0 || !selected) return;
    const content = Array.from(selectedKeys)
      .map(k => `${k}=${selected.env_vars[k]}`)
      .join('\n');
    const safeName = selected.name.replace(/[^\w.-]+/g, '_') || 'selected';
    try {
      const { save } = await import('@tauri-apps/api/dialog');
      const { writeTextFile } = await import('@tauri-apps/api/fs');
      const path = await save({
        defaultPath: `${safeName}.env`,
        filters: [{ name: 'Env', extensions: ['env'] }],
      });
      if (!path) return;
      await writeTextFile(path, content);
    } catch {
      await navigator.clipboard.writeText(content);
      window.alert('Could not save file. Selected variables were copied to clipboard instead.');
    }
  };

  const handleValidate = async () => {
    if (!selected || Object.keys(selected.env_vars).length === 0) return;
    setValidateLoading(true);
    setValidationWarnings({});
    try {
      const raw = await ai.validateEnvVars(selected.env_vars);
      let json = raw.trim();
      if (json.startsWith('```')) {
        json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      }
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) throw new Error('AI did not return an array');
      const map: Record<string, { issue: string; severity: string }> = {};
      for (const item of parsed) {
        if (item.key && item.issue) map[item.key] = { issue: item.issue, severity: item.severity || 'warning' };
      }
      setValidationWarnings(map);
    } catch {
      setValidationWarnings({ __error__: { issue: 'Validation failed. Check console for details.', severity: 'error' } });
    } finally {
      setValidateLoading(false);
    }
  };

  const handleGenerateDocstrings = async () => {
    if (!selected || Object.keys(selected.env_vars).length === 0) return;
    setDocstringsLoading(true);
    try {
      const raw = await ai.generateEnvDocstrings(selected.env_vars);
      let json = raw.trim();
      if (json.startsWith('```')) {
        json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      }
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AI did not return an object');
      setDocstrings(parsed);
    } catch {
      // silently fail
    } finally {
      setDocstringsLoading(false);
    }
  };

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setDropState({ phase: 'drag-over' });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDropState({ phase: 'idle' });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    const files = Array.from(e.dataTransfer.files);
    const envFile = files.find((f) => f.name === '.env' || /\.env(\.[a-zA-Z0-9_-]+)?$/.test(f.name));
    if (!envFile) {
      setDropState({ phase: 'idle' });
      return;
    }
    setDropState({ phase: 'importing' });
    try {
      const content = await envFile.text();
      const parsed = parseEnvContent(content);
      const parsedCount = Object.keys(parsed).length;
      const conflicts = Object.keys(parsed).filter((k) => k in selected.env_vars);
      if (conflicts.length > 0) {
        setPendingImport({ parsed, fileName: envFile.name });
        setDropState({ phase: 'idle' });
      } else {
        const envs = { ...selected.env_vars, ...parsed };
        const updated: Project = { ...selected, env_vars: envs };
        await saveProject(updated);
        setDropState({ phase: 'success', count: parsedCount });
        setTimeout(() => setDropState({ phase: 'idle' }), 1500);
      }
    } catch (err) {
      setDropState({ phase: 'error', message: String(err) });
      setTimeout(() => setDropState({ phase: 'idle' }), 2500);
    }
  };

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const saveRef = useRef(saveProject);
  saveRef.current = saveProject;

  useEffect(() => {
    let unlisten: () => void;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<{ type: string; paths: string[] }>('file-drop-internal', (event) => {
          const { type, paths } = event.payload;
          if (type === 'hovered') {
            dragCounterRef.current += 1;
            if (dragCounterRef.current === 1) setDropState({ phase: 'drag-over' });
          } else if (type === 'cancelled') {
            dragCounterRef.current = 0;
            setDropState({ phase: 'idle' });
          } else if (type === 'dropped') {
            dragCounterRef.current = 0;
            const envPath = paths.find(p => {
              const name = p.split(/[\\/]/).pop() || '';
              return name === '.env' || /\.env(\.[a-zA-Z0-9_-]+)?$/.test(name);
            });
            if (!envPath) {
              setDropState({ phase: 'idle' });
              return;
            }
            setDropState({ phase: 'importing' });
            (async () => {
              try {
                const { invoke } = await import('@tauri-apps/api/tauri');
                const content: string = await invoke('read_env_file', { path: envPath });
                const fileName = envPath.split(/[\\/]/).pop() || '.env';
                const parsed = parseEnvContent(content);
                const parsedCount = Object.keys(parsed).length;
                const sel = selectedRef.current;
                if (!sel) { setDropState({ phase: 'idle' }); return; }
                const conflicts = Object.keys(parsed).filter((k) => k in sel.env_vars);
                if (conflicts.length > 0) {
                  setPendingImport({ parsed, fileName });
                  setDropState({ phase: 'idle' });
                } else {
                  const envs = { ...sel.env_vars, ...parsed };
                  const updated: Project = { ...sel, env_vars: envs };
                  await saveRef.current(updated);
                  setDropState({ phase: 'success', count: parsedCount });
                  setTimeout(() => setDropState({ phase: 'idle' }), 1500);
                }
              } catch (err) {
                setDropState({ phase: 'error', message: String(err) });
                setTimeout(() => setDropState({ phase: 'idle' }), 2500);
              }
            })();
          }
        });
      } catch {}
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const text = e.clipboardData.getData('text');
    if (!text.includes('=')) return;
    const parsed = parseEnvContent(text);
    if (Object.keys(parsed).length === 0) return;
    e.preventDefault();
    const conflicts = Object.keys(parsed).filter((k) => k in selected.env_vars);
    if (conflicts.length > 0) {
      setPendingImport({ parsed, fileName: 'clipboard' });
      return;
    }
    setDropState({ phase: 'importing' });
    const parsedCount = Object.keys(parsed).length;
    const envs = { ...selected.env_vars, ...parsed };
    const updated: Project = { ...selected, env_vars: envs };
    await saveProject(updated);
    setDropState({ phase: 'success', count: parsedCount });
    setTimeout(() => setDropState({ phase: 'idle' }), 1500);
  };

  const handleConfirmImport = async (selectedKeys: Record<string, string>) => {
    if (!pendingImport) return;
    setDropState({ phase: 'importing' });
    const envs = { ...selected.env_vars, ...selectedKeys };
    const updated: Project = { ...selected, env_vars: envs };
    await saveProject(updated);
    setPendingImport(null);
    setDropState({ phase: 'success', count: Object.keys(selectedKeys).length });
    setTimeout(() => setDropState({ phase: 'idle' }), 1500);
  };

  const handleCancelImport = () => {
    setPendingImport(null);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden transition-shadow",
        dropState.phase === 'drag-over' && "ring-2 ring-primary/30",
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <AnimatePresence>
        {dropState.phase !== 'idle' && (
          <motion.div
            key="drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-background/80"
          >
            {dropState.phase === 'importing' ? (
              <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm shadow-lg">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Importing vars...</span>
              </div>
            ) : dropState.phase === 'success' ? (
              <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm shadow-lg">
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Imported {dropState.count} variable{dropState.count !== 1 ? 's' : ''}</span>
              </div>
            ) : dropState.phase === 'error' ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/50 bg-card px-4 py-3 text-sm shadow-lg">
                <span className="text-destructive font-medium">Import failed</span>
                {dropState.message && (
                  <span className="text-xs text-muted-foreground text-center max-w-[300px]">{dropState.message}</span>
                )}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-primary/50 bg-card/80 px-16 py-16 text-center shadow-lg">
                <Upload className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="text-base font-medium">Drop .env file to import</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
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

      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-4">
        <span className="text-xs text-muted-foreground">{selectedKeys.size > 0 ? 'Selected Variables' : 'Variables'}</span>
        {selectedKeys.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tabular-nums text-foreground">{selectedKeys.size}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySelected}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Copy selected"
              >
                {copySelDone ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={handleExportSelected}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Export selected"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={handleDeleteSelected}
                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Delete selected"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={handleClearSelection}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        <div className="flex-1" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search variables..."
          className="h-7 w-44 rounded border bg-background px-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {Object.keys(selected.env_vars).length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevealAll(!revealAll)}
              className="gap-1.5 h-7 text-xs hover:text-foreground"
              title={revealAll ? "Hide all values" : "Show all values"}
            >
              {revealAll ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {revealAll ? "Hide All" : "Show All"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAll}
              className="gap-1.5 h-7 text-xs hover:text-foreground"
            >
              {copyAllDone ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Copy All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleValidate}
              disabled={validateLoading || Object.keys(selected.env_vars).length === 0 || !online}
              className="gap-1.5 h-7 text-xs hover:text-foreground relative"
            >
              {validateLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : Object.keys(validationWarnings).some(k => k !== '__error__') ? (
                <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              Validate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateDocstrings}
              disabled={docstringsLoading || !online}
              className="gap-1.5 h-7 text-xs hover:text-foreground"
            >
              {docstringsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : Object.keys(docstrings).length > 0 ? (
                <FileText className="h-3.5 w-3.5 text-sky-400" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Annotate
            </Button>
          </>
        )}
        <ExportButton project={selected} />
        <BulkImportDialog project={selected} onSave={saveProject} />
        <AddEnvVarDialog project={selected} onSave={saveProject} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-8 px-3 py-2 font-medium">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="h-3.5 w-3.5 accent-primary"
                />
              </th>
              <th className="w-8 px-3 py-2 font-medium">#</th>
              <th className="w-[35%] px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="w-28 pl-0 py-2 font-medium text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(([key, value], idx) => (
              <EnvVarRow
                key={key}
                idx={idx}
                name={key}
                value={value}
                project={selected}
                onSave={saveProject}
                revealAll={revealAll}
                selected={selectedKeys.has(key)}
                onSelect={() => handleSelect(key)}
                onSelectRange={() => handleSelect(key, true)}
                warning={validationWarnings[key]}
                docstring={docstrings[key]}
              />
            ))}
            {Object.keys(selected.env_vars).length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  No environment variables defined
                </td>
              </tr>
            )}
            {searchQuery &&
              Object.keys(selected.env_vars).length > 0 && filteredEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-sm text-muted-foreground"
                  >
                    No variables match &quot;{searchQuery}&quot;
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
      <DropConflictDialog
        parsed={pendingImport?.parsed ?? null}
        existing={selected.env_vars}
        fileName={pendingImport?.fileName ?? ''}
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
      />
    </div>
  );
}

function DropConflictDialog({
  parsed,
  existing,
  fileName,
  onConfirm,
  onCancel,
}: {
  parsed: Record<string, string> | null;
  existing: Record<string, string>;
  fileName: string;
  onConfirm: (selected: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (parsed) setEnabled(new Set(Object.keys(parsed)));
  }, [parsed]);

  const keys = parsed ? Object.keys(parsed) : [];
  const newKeys = keys.filter((k) => !(k in existing));
  const conflictKeys = keys.filter((k) => k in existing);
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = enabled.size > 0 && enabled.size < keys.length;
    }
  }, [enabled, keys.length]);

  const handleToggle = (key: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleOverwriteAll = () => {
    if (!parsed) return;
    setEnabled(new Set(keys));
  };

  const handleSkipAll = () => {
    setEnabled(new Set());
  };

  if (!parsed || keys.length === 0) return null;

  return (
    <Dialog open={!!parsed} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[75vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import from {fileName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {newKeys.length} new, {conflictKeys.length} conflict{conflictKeys.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg text-xs">
          <table className="w-full">
            <thead className="sticky top-0 bg-background">
              <tr className="text-left text-muted-foreground border-b">
                <th className="w-8 px-2 py-1.5 font-medium">
                  <input
                    ref={checkboxRef}
                    type="checkbox"
                    checked={enabled.size === keys.length}
                    onChange={() => {
                      if (enabled.size === keys.length) handleSkipAll();
                      else handleOverwriteAll();
                    }}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                </th>
                <th className="px-2 py-1.5 font-medium">Key</th>
                <th className="px-2 py-1.5 font-medium">Value</th>
                <th className="w-16 px-2 py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const isConflict = k in existing;
                return (
                  <tr key={k} className="border-b border-border/30 hover:bg-accent/20">
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={enabled.has(k)}
                        onChange={() => handleToggle(k)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                    </td>
                    <td className="px-2 py-1.5 font-mono text-env-key">{k}</td>
                    <td className="px-2 py-1.5 font-mono text-env-value max-w-[200px] truncate">
                      {parsed[k]}
                    </td>
                    <td className="px-2 py-1.5">
                      {isConflict ? (
                        <span className="text-amber-500 font-medium">overwrite</span>
                      ) : (
                        <span className="text-emerald-500 font-medium">new</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleOverwriteAll}>
              All
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleSkipAll}>
              None
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs h-7 gap-1.5"
              disabled={enabled.size === 0}
              onClick={() => {
                const selected: Record<string, string> = {};
                for (const k of enabled) selected[k] = parsed[k];
                onConfirm(selected);
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              Import {enabled.size > 0 ? `(${enabled.size})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EnvVarRow({
  idx,
  name,
  value,
  project,
  onSave,
  revealAll,
  selected,
  onSelect,
  onSelectRange,
  warning,
  docstring,
}: {
  idx: number;
  name: string;
  value: string;
  project: Project;
  onSave: (p: Project) => Promise<void>;
  revealAll: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onSelectRange?: () => void;
  warning?: { issue: string; severity: string };
  docstring?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { copyWithTimeout } = useClipboardTimeout();

  useEffect(() => {
    setRevealed(revealAll);
  }, [revealAll]);

  const handleCopy = async () => {
    await copyWithTimeout(`${name}=${value}`);
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
      className={cn(
        "border-b border-border/40 transition-colors hover:bg-accent/30",
        selected && "bg-accent/20",
      )}
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={!!selected}
          onClick={(e) => {
            if (e.shiftKey) { onSelectRange?.(); e.preventDefault(); return; }
          }}
          onChange={onSelect}
          className="h-3.5 w-3.5 accent-primary"
        />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
        {idx + 1}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {docstring ? (
            <span className="group relative inline-flex">
              <span className="font-mono text-xs font-medium text-env-key border-b border-dotted border-muted-foreground/30 cursor-help">
                {name}
              </span>
              <div className="pointer-events-none invisible group-hover:visible absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 w-60 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md whitespace-normal">
                {docstring}
              </div>
            </span>
          ) : (
            <span className="font-mono text-xs font-medium text-env-key">
              {name}
            </span>
          )}
          {warning && (
            <span className="group relative inline-flex">
              <AlertTriangle className={`h-3 w-3 ${warning.severity === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
              <div className="pointer-events-none invisible group-hover:visible absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 w-56 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md whitespace-normal">
                {warning.issue}
              </div>
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="max-w-[400px] overflow-x-auto scrollbar-thin">
          <span
            className={cn(
              "font-mono text-xs transition-all select-none relative inline-block",
              revealed ? "text-env-value" : "text-transparent",
            )}
          >
            {value}
            {!revealed && (
              <span className="absolute inset-0 text-muted-foreground/40" aria-hidden="true">
                {'•'.repeat(Math.min(value.length, 32))}
              </span>
            )}
          </span>
        </div>
      </td>
      <td className="pl-0 py-2">
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
        <div className="space-y-3 pt-2" onKeyDown={(e) => { if (e.key === 'Enter' && key.trim()) handleSave(); }}>
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
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
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
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
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
    const parsed = parseEnvContent(text);
    const envs = { ...project.env_vars, ...parsed };
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
  const [envSuggestLoading, setEnvSuggestLoading] = useState(false);
  const [envDialogOnline, setEnvDialogOnline] = useState(true);
  useEffect(() => {
    setEnvDialogOnline(navigator.onLine);
    const go = () => setEnvDialogOnline(true);
    const goOff = () => setEnvDialogOnline(false);
    window.addEventListener('online', go);
    window.addEventListener('offline', goOff);
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', goOff); };
  }, []);

  const handleSuggestEnvVar = async () => {
    if (!key.trim()) return;
    setEnvSuggestLoading(true);
    try {
      const raw = await ai.suggestEnvVar(key.trim(), Object.keys(project.env_vars));
      let json = raw.trim();
      if (json.startsWith('```')) {
        json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      }
      const parsed = JSON.parse(json);
      if (parsed.key) setKey(parsed.key.toUpperCase().replace(/[^A-Z0-9_]/g, ""));
      if (parsed.value) setValue(parsed.value);
    } catch {
      // silently fail
    } finally {
      setEnvSuggestLoading(false);
    }
  };

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
        <div className="space-y-3 pt-2" onKeyDown={(e) => { if (e.key === 'Enter' && key.trim()) handleSave(true); }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-xs font-medium text-muted-foreground">
                KEY
              </label>
              <button
                onClick={handleSuggestEnvVar}
                disabled={envSuggestLoading || !key.trim() || !envDialogOnline}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                title="Suggest key and value with AI"
              >
                {envSuggestLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Suggest
              </button>
            </div>
            <Input
              value={key}
              onChange={(e) =>
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
              }
              placeholder="e.g. connection string for PostgreSQL"
              className="font-mono text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
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
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
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
