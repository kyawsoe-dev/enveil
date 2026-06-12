'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVault } from './VaultProvider';

interface SearchResult {
  type: 'project' | 'key';
  projectName: string;
  projectId: string;
  keyName?: string;
  value?: string;
}

export default function SearchBar() {
  const { state, selectProject, setView } = useVault();
  const [open, setOpen] = useState(false);
  const queryRef = useRef('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    }
  };

  const projects = state.vault?.projects ?? [];

  const updateResults = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      const lower = q.toLowerCase();
      const hits: SearchResult[] = [];

      for (const p of projects) {
        if (p.name.toLowerCase().includes(lower)) {
          hits.push({ type: 'project', projectName: p.name, projectId: p.id });
        }
        for (const [key, value] of Object.entries(p.env_vars)) {
          if (key.toLowerCase().includes(lower) || value.toLowerCase().includes(lower)) {
            hits.push({ type: 'key', projectName: p.name, projectId: p.id, keyName: key, value });
          }
        }
      }
      setResults(hits.slice(0, 20));
    },
    [projects],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      queryRef.current = '';
      setResults([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleSelect = (r: SearchResult) => {
    selectProject(r.projectId);
    setView('project');
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-full items-center gap-2 rounded-md border bg-card px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">Search keys or projects...</span>
        <kbd className="hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
            onMouseDown={() => setOpen(false)}
          >
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg rounded-lg border bg-card shadow-xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  key={String(open)}
                  ref={inputRef}
                  defaultValue=""
                  onChange={(e) => {
                    queryRef.current = e.target.value;
                    updateResults(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search environment variables or projects..."
                  className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  spellCheck={false}
                />
              </div>

              {results.length > 0 && (
                <div className="max-h-64 overflow-y-auto p-1">
                  {results.map((r, i) => (
                    <button
                      key={`${r.projectId}-${r.keyName ?? ''}-${i}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(r);
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        i === activeIndex && "bg-accent text-accent-foreground"
                      )}
                    >
                      {r.type === 'project' ? (
                        <>
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary">
                            {r.projectName.charAt(0)}
                          </span>
                          <span className="font-medium">{r.projectName}</span>
                          <span className="ml-auto text-xs text-muted-foreground">Project</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-env-key text-xs">{r.keyName}</span>
                          <span className="ml-2 truncate text-xs text-muted-foreground">
                            {r.value}
                          </span>
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {r.projectName}
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {queryRef.current && results.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
