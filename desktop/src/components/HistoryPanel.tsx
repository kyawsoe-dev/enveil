'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, RotateCcw, Clock, ChevronRight, ArrowLeft, Plus, Minus, AlertTriangle, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVault } from './VaultProvider';
import * as tauri from '@/lib/tauri';
import type { EnvSnapshot } from '@/lib/types';

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 500;
const STORAGE_KEY = 'enveil_history_width';
const DEFAULT_WIDTH = 300;

function getStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
}

export default function HistoryPanel({ open, onClose }: HistoryPanelProps) {
  const { state, saveProject, getPassword } = useVault();
  const [history, setHistory] = useState<EnvSnapshot[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(getStoredWidth);
  const dragRef = useRef(false);
  const widthRef = useRef(width);

  useEffect(() => { widthRef.current = width; }, [width]);

  const selected = state.vault?.projects.find((p) => p.id === state.selectedProjectId);
  const currentVars = selected?.env_vars ?? {};

  useEffect(() => {
    if (!open || !selected) return;
    tauri.getProjectHistory(selected.id).then(setHistory).catch(() => {});
  }, [open, selected?.id]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const rect = document.querySelector('.history-panel-container')?.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, rect.right - ev.clientX));
      widthRef.current = newWidth;
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      dragRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const handlePreview = (idx: number) => {
    setPreviewIdx(idx);
  };

  const handleConfirmRestore = async () => {
    if (previewIdx === null) return;
    const pw = getPassword();
    if (!pw || !selected) return;
    setRestoring(true);
    try {
      await tauri.restoreSnapshot(selected.id, previewIdx, pw);
      const vault = await tauri.unlockVault(pw);
      const refreshed = vault.projects.find((p) => p.id === selected.id);
      if (refreshed) {
        saveProject(refreshed);
      }
      setPreviewIdx(null);
      const updated = await tauri.getProjectHistory(selected.id);
      setHistory(updated);
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setRestoring(false);
    }
  };

  const handleBack = () => {
    setPreviewIdx(null);
  };

  const timeAgo = (ts: number) => {
    const sec = Math.floor((Date.now() - ts * 1000) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const snapshot = previewIdx !== null ? history[previewIdx] : null;

  const previewChanges = snapshot ? (() => {
    const snapVars = snapshot.env_vars;
    const allKeys = new Set([...Object.keys(snapVars), ...Object.keys(currentVars)]);
    const added: string[] = [];
    const removed: string[] = [];
    const changed: [string, string, string][] = [];
    const unchanged: string[] = [];
    for (const k of allKeys) {
      if (!(k in snapVars)) { removed.push(k); }
      else if (!(k in currentVars)) { added.push(k); }
      else if (snapVars[k] !== currentVars[k]) { changed.push([k, currentVars[k], snapVars[k]]); }
      else { unchanged.push(k); }
    }
    return { added, removed, changed, unchanged };
  })() : null;

  return (
    <AnimatePresence>
      {open && (
        <div className="relative flex shrink-0 history-panel-container">
          <div
            className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:w-1.5 hover:bg-primary/30 transition-all"
            onMouseDown={handleMouseDown}
          />
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="flex flex-col border-l overflow-hidden"
          >
            {previewIdx !== null && snapshot ? (
              <>
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <button
                    onClick={handleBack}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    Preview
                  </span>
                </div>

                <div className="flex items-center gap-1.5 border-b border-border/30 px-3 py-1.5 bg-muted/20">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{timeAgo(snapshot.timestamp)}</span>
                  <span className="text-[10px] text-muted-foreground mx-0.5">·</span>
                  <span className="text-[10px] text-muted-foreground truncate">{snapshot.label}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {previewChanges && (
                    <>
                      {previewChanges.removed.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-red-500 mb-1 px-1">
                            <Minus className="h-3 w-3" />
                            Removed ({previewChanges.removed.length})
                          </div>
                          {previewChanges.removed.map((k) => (
                            <div key={k} className="flex items-center gap-1.5 rounded bg-red-500/5 px-2 py-1 text-[10px] font-mono text-red-600 dark:text-red-400">
                              <Minus className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{k}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {previewChanges.added.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 mb-1 px-1">
                            <Plus className="h-3 w-3" />
                            Added ({previewChanges.added.length})
                          </div>
                          {previewChanges.added.map((k) => (
                            <div key={k} className="flex items-center gap-1.5 rounded bg-emerald-500/5 px-2 py-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              <Plus className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{k}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {previewChanges.changed.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-amber-500 mb-1 px-1">
                            <AlertTriangle className="h-3 w-3" />
                            Changed ({previewChanges.changed.length})
                          </div>
                          {previewChanges.changed.map(([k, curr, snap]) => (
                            <div key={k} className="rounded bg-amber-500/5 px-2 py-1 space-y-0.5">
                              <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{k}</span>
                              </div>
                              <div className="space-y-0.5 pl-4">
                                <div className="text-[9px] font-mono text-muted-foreground line-through truncate">{curr}</div>
                                <div className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 truncate">{snap}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {previewChanges.unchanged.length > 0 && (
                        <div className="px-1 pt-1">
                          <p className="text-[9px] text-muted-foreground">
                            {previewChanges.unchanged.length} variable{previewChanges.unchanged.length !== 1 ? 's' : ''} unchanged
                          </p>
                        </div>
                      )}

                      {previewChanges.removed.length === 0 && previewChanges.added.length === 0 && previewChanges.changed.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                          <Check className="h-8 w-8 text-muted-foreground/30 mb-2" />
                          <p className="text-xs text-muted-foreground">No differences</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1">
                            This snapshot matches the current state.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="border-t px-3 py-2">
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5"
                    onClick={handleConfirmRestore}
                    disabled={restoring}
                  >
                    <RotateCcw className={cn("h-3.5 w-3.5", restoring && "animate-spin")} />
                    {restoring ? 'Restoring...' : 'Confirm Restore'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b px-3 py-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    Version History
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{history.length}</span>
                    <button
                      onClick={onClose}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">No version history yet.</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        Snapshots are created automatically when you save changes.
                      </p>
                    </div>
                  ) : (
                    [...history].reverse().map((snap, i) => {
                      const actualIdx = history.length - 1 - i;
                      return (
                        <div
                          key={snap.timestamp}
                          className="flex items-start gap-2 border-b border-border/30 px-3 py-2.5"
                        >
                          <span className="w-5 shrink-0 pt-0.5 text-right text-[10px] tabular-nums text-muted-foreground/50">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">{timeAgo(snap.timestamp)}</span>
                            </div>
                            <p className="text-[11px] text-foreground truncate mt-0.5">{snap.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {Object.keys(snap.env_vars).length} variable{Object.keys(snap.env_vars).length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] px-2 gap-1 shrink-0"
                            onClick={() => handlePreview(actualIdx)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Preview
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
