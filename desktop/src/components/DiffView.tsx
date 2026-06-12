'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompare,
  Plus,
  Minus,
  Pencil,
  AlertCircle,
  ArrowRight,
  ArrowLeftRight,
  CheckCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useVault } from './VaultProvider';
import * as tauri from '@/lib/tauri';
import type { DiffResult } from '@/lib/types';

export default function DiffView() {
  const { state } = useVault();
  const projects = state.vault?.projects ?? [];
  const [projectA, setProjectA] = useState(projects[0]?.id ?? '');
  const [projectB, setProjectB] = useState(projects[1]?.id ?? '');
  const [result, setResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showIdentical, setShowIdentical] = useState(false);

  const projectAData = useMemo(
    () => projects.find((p) => p.id === projectA),
    [projects, projectA],
  );
  const projectBData = useMemo(
    () => projects.find((p) => p.id === projectB),
    [projects, projectB],
  );

  const identicalKeys = useMemo(() => {
    if (!projectAData || !projectBData) return [];
    return Object.keys(projectAData.env_vars).filter(
      (k) => k in projectBData.env_vars && projectAData.env_vars[k] === projectBData.env_vars[k],
    );
  }, [projectAData, projectBData]);

  const handleCompare = async () => {
    if (!projectA || !projectB || projectA === projectB) return;
    setLoading(true);
    setError('');
    try {
      const r = await tauri.diffProjects(projectA, projectB);
      setResult(r);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    setProjectA(projectB);
    setProjectB(projectA);
    setResult(null);
  };

  const stats = useMemo(() => {
    if (!result) return null;
    const aOnly = Object.keys(result.only_in_a).length;
    const bOnly = Object.keys(result.only_in_b).length;
    const changed = Object.keys(result.changed).length;
    const identical = identicalKeys.length;
    return { aOnly, bOnly, changed, identical, total: aOnly + bOnly + changed + identical };
  }, [result, identicalKeys]);

  if (projects.length < 2) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <GitCompare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Need at least two projects to compare</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Compare Projects</span>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b px-4 py-2">
        <div className="flex flex-1 items-center gap-2">
          <select
            className="h-7 flex-1 rounded border bg-card px-2 text-xs font-mono"
            value={projectA}
            onChange={(e) => { setProjectA(e.target.value); setResult(null); }}
          >
            <option value="">Select project A</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            className="h-7 flex-1 rounded border bg-card px-2 text-xs font-mono"
            value={projectB}
            onChange={(e) => { setProjectB(e.target.value); setResult(null); }}
          >
            <option value="">Select project B</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwap}
            disabled={!projectA || !projectB}
            className="h-7 w-7 p-0"
            title="Swap A and B"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={handleCompare}
            disabled={!projectA || !projectB || projectA === projectB || loading}
            className="h-7 gap-1.5"
          >
            {loading ? (
              'Comparing...'
            ) : (
              <><GitCompare className="h-3.5 w-3.5" /> Compare</>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && stats && (
        <>
          <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 text-xs">
            <span className="font-medium text-foreground">{result.project_a_name}</span>
            <span className="text-muted-foreground">
              {projectAData ? Object.keys(projectAData.env_vars).length : '?'} vars
            </span>
            <span className="text-muted-foreground">vs</span>
            <span className="font-medium text-foreground">{result.project_b_name}</span>
            <span className="text-muted-foreground">
              {projectBData ? Object.keys(projectBData.env_vars).length : '?'} vars
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <Minus className="h-2.5 w-2.5" />
                {stats.aOnly} only
              </Badge>
              <Badge variant="success" className="gap-1 text-[10px]">
                <Plus className="h-2.5 w-2.5" />
                {stats.bOnly} only
              </Badge>
              <Badge variant="warning" className="gap-1 text-[10px]">
                <Pencil className="h-2.5 w-2.5" />
                {stats.changed} changed
              </Badge>
              <button
                onClick={() => setShowIdentical(!showIdentical)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <CheckCheck className="h-2.5 w-2.5" />
                {stats.identical} identical
                {showIdentical ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-1 gap-0 overflow-hidden">
            <SplitPane label={`${result.project_a_name} view`} variant="a">
              <div className="divide-y divide-border/40">
                {stats.aOnly > 0 && (
                  <SectionHeader
                    icon={<Minus className="h-3 w-3 text-red-500" />}
                    label={`Only in ${result.project_a_name}`}
                    count={stats.aOnly}
                    variant="removed"
                  />
                )}
                {Object.entries(result.only_in_a).map(([key, val]) => (
                  <DiffRow key={key} variant="removed">
                    <span className="font-mono text-xs text-env-key">{key}</span>
                    <span className="font-mono text-xs text-muted-foreground">{val}</span>
                  </DiffRow>
                ))}
                {stats.changed > 0 && (
                  <SectionHeader
                    icon={<Pencil className="h-3 w-3 text-amber-500" />}
                    label="Changed values"
                    count={stats.changed}
                    variant="changed"
                  />
                )}
                {Object.entries(result.changed).map(([key, [valA]]) => (
                  <DiffRow key={key} variant="changed">
                    <span className="font-mono text-xs text-env-key">{key}</span>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{valA}</span>
                  </DiffRow>
                ))}
                {stats.bOnly === 0 && stats.aOnly === 0 && stats.changed === 0 && (
                  <p className="p-4 text-xs text-muted-foreground">No differences — projects are identical</p>
                )}
                {stats.identical > 0 && showIdentical && (
                  <>
                    <SectionHeader
                      icon={<CheckCheck className="h-3 w-3 text-emerald-500" />}
                      label="Identical"
                      count={stats.identical}
                      variant="identical"
                    />
                    {identicalKeys.map((key) => (
                      <DiffRow key={key} variant="identical">
                        <span className="font-mono text-xs text-env-key">{key}</span>
                        <span className="font-mono text-xs text-muted-foreground">{projectAData?.env_vars[key]}</span>
                      </DiffRow>
                    ))}
                  </>
                )}
              </div>
            </SplitPane>

            <div className="w-px shrink-0 bg-border" />

            <SplitPane label={`${result.project_b_name} view`} variant="b">
              <div className="divide-y divide-border/40">
                {stats.bOnly > 0 && (
                  <SectionHeader
                    icon={<Plus className="h-3 w-3 text-emerald-500" />}
                    label={`Only in ${result.project_b_name}`}
                    count={stats.bOnly}
                    variant="added"
                  />
                )}
                {Object.entries(result.only_in_b).map(([key, val]) => (
                  <DiffRow key={key} variant="added">
                    <span className="font-mono text-xs text-env-key">{key}</span>
                    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">{val}</span>
                  </DiffRow>
                ))}
                {stats.changed > 0 && (
                  <SectionHeader
                    icon={<Pencil className="h-3 w-3 text-amber-500" />}
                    label="Changed values"
                    count={stats.changed}
                    variant="changed"
                  />
                )}
                {Object.entries(result.changed).map(([key, [, valB]]) => (
                  <DiffRow key={key} variant="changed">
                    <span className="font-mono text-xs text-env-key">{key}</span>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{valB}</span>
                  </DiffRow>
                ))}
                {stats.aOnly === 0 && stats.bOnly === 0 && stats.changed === 0 && (
                  <p className="p-4 text-xs text-muted-foreground">No differences — projects are identical</p>
                )}
                {stats.identical > 0 && showIdentical && (
                  <>
                    <SectionHeader
                      icon={<CheckCheck className="h-3 w-3 text-emerald-500" />}
                      label="Identical"
                      count={stats.identical}
                      variant="identical"
                    />
                    {identicalKeys.map((key) => (
                      <DiffRow key={key} variant="identical">
                        <span className="font-mono text-xs text-env-key">{key}</span>
                        <span className="font-mono text-xs text-muted-foreground">{projectBData?.env_vars[key]}</span>
                      </DiffRow>
                    ))}
                  </>
                )}
              </div>
            </SplitPane>
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <GitCompare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Select two projects and click Compare</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  count,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  variant: 'added' | 'removed' | 'changed' | 'identical';
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium',
        variant === 'added' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        variant === 'removed' && 'bg-red-500/10 text-red-600 dark:text-red-400',
        variant === 'changed' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        variant === 'identical' && 'bg-muted text-muted-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="ml-auto tabular-nums opacity-70">{count}</span>
    </div>
  );
}

function SplitPane({
  label,
  variant,
  children,
}: {
  label: string;
  variant: 'a' | 'b';
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          'border-b px-3 py-1.5 text-xs font-medium',
          variant === 'a'
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            : 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
        )}
      >
        {label}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

function DiffRow({
  variant,
  children,
}: {
  variant: 'added' | 'removed' | 'changed' | 'identical';
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        variant === 'added' && 'bg-emerald-500/5',
        variant === 'removed' && 'bg-red-500/5',
        variant === 'changed' && 'bg-amber-500/5',
      )}
    >
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        {children}
      </div>
    </motion.div>
  );
}
