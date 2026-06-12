'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Play,
  Square,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Check,
  Clock,
  ChevronRight,
  ChevronDown,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useVault } from './VaultProvider';
import * as tauri from '@/lib/tauri';

type RunnerStatus = 'idle' | 'running' | 'success' | 'error';

interface HistoryEntry {
  command: string;
  timestamp: number;
  status: RunnerStatus;
}

const MAX_HISTORY = 50;

const SUGGESTIONS = [
  'help', '--help', '-h', 'clear', 'cls', 'env', 'printenv',
  'projects', 'select', 'vars', 'search',
  'echo', 'node', 'python3', 'npm', 'npx', 'cat', 'grep',
  'ls', 'cd', 'export', 'pwd', 'which', 'type', 'mkdir',
  'touch', 'rm', 'cp', 'mv', 'chmod', 'curl', 'wget',
];

const HELP_TEXT = `Built-in Commands
──────────────────

  help, --help, -h     Show this help message
  clear, cls           Clear the terminal output
  env                  Print all injected environment variables
  printenv             Print all environment variables
  projects             List all vault projects
  select <name>        Switch active project by name
  vars                 List env var keys for the active project
  search <query>       Search across all projects and env vars

Usage
  Any command not listed above runs in the system shell with
  the selected project's environment variables injected.

Examples (type these exactly)
  printenv                              List all injected env vars
  echo \$DATABASE_URL                    Print one specific variable
  node -e "console.log(process.env.API_KEY)"
  python3 -c "import os;print(os.environ.get('NODE_ENV'))"

Tips
  • Select a project from the sidebar to set the env context
  • ↑/↓ navigate suggestions when available, else cycle history
  • Tab instantly accepts and runs the selected suggestion
  • Ctrl+L clears the terminal output
`;

function ProjectSelector() {
  const { state, selectProject } = useVault();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projects = state.vault?.projects ?? [];
  const selected = projects.find((p) => p.id === state.selectedProjectId);

  const filtered = useMemo(() => {
    return projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [projects, search]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "h-7 gap-1.5 font-mono text-[11px] px-2.5",
          !selected
            ? "border-amber-500/50 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-600"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full bg-emerald-500", !selected && "bg-amber-500 animate-pulse")} />
        <span className="truncate max-w-[120px]">
          {selected ? selected.name : "Select Project..."}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute left-0 mt-1 z-50 w-52 rounded-md border bg-popover p-1 shadow-md">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-full mb-1 px-2 text-xs font-mono"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  selectProject(p.id);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={cn(
                  "flex w-full items-center rounded-sm px-2 py-1 text-left text-xs font-mono transition-colors hover:bg-accent hover:text-accent-foreground",
                  p.id === selected?.id ? "bg-accent text-accent-foreground font-semibold" : "text-popover-foreground"
                )}
              >
                {p.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                No projects found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TerminalRunner() {
  const { state, selectProject, setView } = useVault();
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [output, setOutput] = useState('');
  const [showEnvs, setShowEnvs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [runCount, setRunCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [suggestIdx, setSuggestIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  const selected = state.vault?.projects.find((p) => p.id === state.selectedProjectId);
  const envVars = selected?.env_vars ?? {};
  const envCount = Object.keys(envVars).length;

  const suggestions = useMemo(() => {
    if (!command.trim() || status === 'running') return [];
    const input = command.trim().toLowerCase();
    const envKeys = Object.keys(envVars).map((k) => `$\{${k}}`);
    const all = [...SUGGESTIONS, ...envKeys];
    const matches = all.filter((s) => s.toLowerCase().startsWith(input));
    return matches.slice(0, 8);
  }, [command, envVars, status]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (outputRef.current) {
        const parent = outputRef.current.parentElement;
        if (parent) parent.scrollTop = parent.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [output, scrollToBottom]);

  const handleStop = () => {
    setStatus('idle');
    setOutput((prev) => prev + '^C\n');
  };

  const handleClear = () => {
    setOutput('');
    setErrorMsg('');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    setCommand(entry.command);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const handleRun = useCallback(async (cmdOverride?: string) => {
    const cmd = (cmdOverride ?? command).trim();
    if (!cmd || !selected) return;
    setOutput((prev) => prev + `$ ${cmd}\n`);
    setErrorMsg('');
    setHistoryIdx(-1);
    setSuggestIdx(-1);
    setCommand('');

    const runBuiltIn = (handler: () => void, statusText: RunnerStatus = 'success') => {
      handler();
      setStatus(statusText);
      setHistory((prev) => [{ command: cmd, timestamp: Date.now(), status: statusText }, ...prev].slice(0, MAX_HISTORY));
      setRunCount((c) => c + 1);
    };

    const builtInHandlers: Record<string, () => void> = {
      help: () => setOutput((prev) => prev + HELP_TEXT + '\n'),
      '--help': () => setOutput((prev) => prev + HELP_TEXT + '\n'),
      '-h': () => setOutput((prev) => prev + HELP_TEXT + '\n'),
      clear: () => setOutput(''),
      cls: () => setOutput(''),
      env: () => { for (const [k, v] of Object.entries(envVars)) setOutput((prev) => prev + `${k}=${v}\n`); },
      vars: () => {
        const keys = Object.keys(envVars);
        if (keys.length === 0) setOutput((prev) => prev + '(no variables)\n');
        else keys.forEach((k) => setOutput((prev) => prev + `${k}\n`));
      },
      projects: () => {
        const all = state.vault?.projects ?? [];
        if (all.length === 0) setOutput((prev) => prev + '(no projects)\n');
        else all.forEach((p) => setOutput((prev) => prev + `${p.name}${p.id === state.selectedProjectId ? ' ← active' : ''}\n`));
      },
    };

    const selectMatch = cmd.match(/^select (.+)$/);
    if (selectMatch) {
      const name = selectMatch[1].toLowerCase();
      const match = state.vault?.projects.find((p) => p.name.toLowerCase() === name);
      if (match) {
        selectProject(match.id);
        setView('project');
        runBuiltIn(() => setOutput((prev) => prev + `Switched to project "${match.name}"\n`));
      } else {
        runBuiltIn(() => setOutput((prev) => prev + `Project not found: "${selectMatch[1]}"\n`), 'error');
      }
      return;
    }

    const searchMatch = cmd.match(/^search (.+)$/);
    if (searchMatch) {
      const query = searchMatch[1].toLowerCase();
      const results: { project: string; key?: string; value?: string }[] = [];
      for (const p of state.vault?.projects ?? []) {
        if (p.name.toLowerCase().includes(query)) results.push({ project: p.name });
        for (const [k, v] of Object.entries(p.env_vars)) {
          if (k.toLowerCase().includes(query) || v.toLowerCase().includes(query)) results.push({ project: p.name, key: k, value: v });
        }
      }
      if (results.length === 0) {
        runBuiltIn(() => setOutput((prev) => prev + `No results for "${searchMatch[1]}"\n`));
      } else {
        runBuiltIn(() => {
          setOutput((prev) => prev + `Search results for "${searchMatch[1]}":\n`);
          results.slice(0, 20).forEach((r) => {
            if (r.key) setOutput((prev) => prev + `  ${r.project} › ${r.key} = ${r.value}\n`);
            else setOutput((prev) => prev + `  ${r.project} (project)\n`);
          });
          if (results.length > 20) setOutput((prev) => prev + `  ... and ${results.length - 20} more\n`);
        });
      }
      return;
    }

    const handler = builtInHandlers[cmd];
    if (handler) { runBuiltIn(handler); return; }

    setStatus('running');
    try {
      const result = await tauri.runCommand(cmd, selected.id);
      setOutput((prev) => prev + result + '\n');
      setStatus('success');
      setHistory((prev) => [{ command: cmd, timestamp: Date.now(), status: 'success' as const }, ...prev].slice(0, MAX_HISTORY));
    } catch (err) {
      const msg = String(err);
      setErrorMsg(msg);
      setOutput((prev) => prev + msg + '\n');
      setStatus('error');
      setHistory((prev) => [{ command: cmd, timestamp: Date.now(), status: 'error' as const }, ...prev].slice(0, MAX_HISTORY));
    }
    setRunCount((c) => c + 1);
  }, [command, selected, envVars, state.vault, state.selectedProjectId, selectProject, setView]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0 && suggestIdx >= 0) {
      if (e.key === 'Tab') {
        e.preventDefault();
        setCommand('');
        setSuggestIdx(-1);
        handleRun(suggestions[suggestIdx]);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
    }

    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      setCommand('');
      setSuggestIdx(-1);
      handleRun(suggestions[0]);
      return;
    }

    if (e.key === 'Enter' && status !== 'running') {
      setSuggestIdx(-1);
      handleRun();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSuggestIdx(suggestions.length - 1);
        return;
      }
      if (history.length === 0) return;
      const newIdx = historyIdx < history.length - 1 ? historyIdx + 1 : historyIdx;
      setHistoryIdx(newIdx);
      setCommand(history[newIdx].command);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        if (suggestIdx < 0) {
          setSuggestIdx(0);
        } else if (suggestIdx < suggestions.length - 1) {
          setSuggestIdx(suggestIdx + 1);
        } else {
          setSuggestIdx(-1);
        }
        return;
      }
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setCommand('');
        return;
      }
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      setCommand(history[newIdx].command);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      handleClear();
    }
  };

  const timeAgo = (ts: number) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Terminal</span>
            {runCount > 0 && (
              <span className="text-[11px] tabular-nums text-muted-foreground">· {runCount} run{runCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          <ProjectSelector />
        </div>
        <div className="flex items-center gap-1.5">
          {output && (
            <>
              <button
                onClick={handleCopy}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Copy output"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={handleClear}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Clear output (Ctrl+L)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              showHistory
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            title="Command history"
          >
            <History className="h-3.5 w-3.5" />
          </button>
          <Badge
            variant={
              status === 'running'
                ? 'default'
                : status === 'success'
                  ? 'success'
                  : status === 'error'
                    ? 'destructive'
                    : 'secondary'
            }
            className="gap-1.5"
          >
            <AnimatePresence mode="wait">
              {status === 'running' && (
                <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Loader2 className="h-3 w-3 animate-spin" />
                </motion.div>
              )}
              {status === 'success' && <CheckCircle2 className="h-3 w-3" />}
              {status === 'error' && <AlertCircle className="h-3 w-3" />}
            </AnimatePresence>
            {status === 'idle' && 'Idle'}
            {status === 'running' && 'Running'}
            {status === 'success' && 'Completed'}
            {status === 'error' && 'Failed'}
          </Badge>
        </div>
      </div>

      <div className="relative flex items-center gap-2 border-b px-4 py-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={command}
            onChange={(e) => { setCommand(e.target.value); setHistoryIdx(-1); setSuggestIdx(-1); }}
            onKeyDown={handleKeyDown}
            placeholder={selected ? `$ ${selected.name} › Enter a command...` : 'Select a project above to unlock terminal...'}
            className="h-8 w-full font-mono text-sm"
            disabled={status === 'running' || !selected}
          />
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 top-full z-50 mt-0.5 overflow-hidden rounded-md border bg-popover shadow-md"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => { setCommand(''); setSuggestIdx(-1); handleRun(s); }}
                    onMouseEnter={() => setSuggestIdx(i)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs transition-colors',
                      i === suggestIdx ? 'bg-accent text-accent-foreground' : 'text-popover-foreground',
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground">Tab</span>
                    <span>{s}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {status === 'running' ? (
          <Button variant="destructive" size="sm" onClick={handleStop} className="h-8 gap-1.5">
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => { setSuggestIdx(-1); handleRun(); }} className="h-8 gap-1.5" disabled={!command.trim() || !selected}>
            <Play className="h-3.5 w-3.5" />
            Run
          </Button>
        )}
      </div>



      {envCount > 0 && selected && (
        <div className="border-b px-4 py-1.5">
          <button
            onClick={() => setShowEnvs(!showEnvs)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showEnvs ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showEnvs ? 'Hide' : 'Show'} injected variables ({envCount})
          </button>
          <AnimatePresence>
            {showEnvs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-1 max-h-32 overflow-y-auto rounded border bg-card p-2">
                  {Object.entries(envVars).map(([k, v]) => (
                    <div key={k} className="flex gap-2 py-0.5 text-xs">
                      <span className="font-mono text-env-key">{k}</span>
                      <span className="font-mono text-env-value text-transparent [text-shadow:0_0_6px_hsl(215_20%_65%/0.5)]">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black/30 p-4 font-mono text-xs leading-relaxed text-gray-700 dark:text-slate-300">
            {output ? (
              <pre ref={outputRef} className="min-h-full">
                {output}
                <span className="ml-1 animate-pulse text-primary">▊</span>
              </pre>
            ) : !selected ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-4">
                <Terminal className="h-10 w-10 text-muted-foreground/30 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No Project Active</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Select a project to inject environment variables and run commands.
                  </p>
                </div>
                {state.vault?.projects && state.vault.projects.length > 0 ? (
                  <div className="w-full max-w-xs space-y-1.5 pt-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-left px-1">
                      Available Projects
                    </p>
                    <div className="max-h-40 overflow-y-auto border rounded-md bg-card/50 p-1 divide-y divide-border/40">
                      {state.vault.projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectProject(p.id)}
                          className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs font-mono transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <span>{p.name}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No projects found. Create a project in the sidebar first.
                  </p>
                )}
              </div>
            ) : (
              <pre ref={outputRef} className="min-h-full">
                <span className="text-muted-foreground">
                  Type a command above and press Enter or click Run.
                </span>
                <span className="ml-1 animate-pulse text-primary">▊</span>
              </pre>
            )}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive dark:text-destructive-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showHistory && history.length > 0 && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="flex flex-col border-l overflow-hidden"
            >
              <div className="flex items-center justify-between border-b px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <History className="h-3 w-3" />
                  History
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{history.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {history.map((entry, i) => (
                  <button
                    key={`${entry.timestamp}-${i}`}
                    onClick={() => handleHistorySelect(entry)}
                    className="flex w-full flex-col gap-0.5 border-b border-border/30 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate font-mono text-xs">{entry.command}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-4">
                      <span
                        className={cn(
                          'inline-block h-1.5 w-1.5 rounded-full',
                          entry.status === 'success' ? 'bg-emerald-500' : 'bg-red-500',
                        )}
                      />
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(entry.timestamp)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
