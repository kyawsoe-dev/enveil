'use client';

import { useState, useEffect, useMemo } from 'react';
import { useVault } from './VaultProvider';
import * as tauri from '@/lib/tauri';
import {
  Key, FolderKanban, BarChart3, ShieldCheck, Hash, PieChart,
  AlertTriangle, Server, Clock, Activity, GitCompare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as ai from '@/lib/ai';

export default function Dashboard() {
  const { state, selectProject, setView } = useVault();
  const projects = state.vault?.projects ?? [];

  const [showIssues, setShowIssues] = useState(false);
  const [historyMap, setHistoryMap] = useState<Record<string, { projectName: string; timestamp: number; label: string }[]>>({});

  useEffect(() => {
    if (projects.length === 0) { setHistoryMap({}); return; }
    let cancelled = false;
    (async () => {
      const map: Record<string, { projectName: string; timestamp: number; label: string }[]> = {};
      for (const p of projects) {
        try {
          const h = await tauri.getProjectHistory(p.id);
          map[p.id] = h.map(snap => ({ projectName: p.name, timestamp: snap.timestamp, label: snap.label }));
        } catch { map[p.id] = []; }
      }
      if (!cancelled) setHistoryMap(map);
    })();
    return () => { cancelled = true; };
  }, [projects]);

  const totalVars = projects.reduce((sum, p) => sum + Object.keys(p.env_vars).length, 0);
  const allKeys = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) for (const k of Object.keys(p.env_vars)) set.add(k);
    return set;
  }, [projects]);

  const freqMap = useMemo(() => {
    const freq: Record<string, { count: number; projects: string[] }> = {};
    for (const p of projects) {
      for (const key of Object.keys(p.env_vars)) {
        if (!freq[key]) freq[key] = { count: 0, projects: [] };
        freq[key].count++;
        freq[key].projects.push(p.name);
      }
    }
    return freq;
  }, [projects]);

  const topProjects = useMemo(
    () => [...projects].sort((a, b) => Object.keys(b.env_vars).length - Object.keys(a.env_vars).length),
    [projects],
  );

  const varFrequency = useMemo(
    () => Object.entries(freqMap).sort(([, a], [, b]) => b.count - a.count).slice(0, 10),
    [freqMap],
  );

  const topCommonKeys = useMemo(() => varFrequency.map(([k]) => k).slice(0, 5), [varFrequency]);

  const coverageData = useMemo(() => {
    if (topCommonKeys.length === 0 || projects.length === 0) return [];
    return topCommonKeys.map((key) => {
      const covered = projects.filter((p) => key in p.env_vars);
      const missing = projects.filter((p) => !(key in p.env_vars));
      return { key, coverage: covered.length, total: projects.length, pct: Math.round((covered.length / projects.length) * 100), missingProjects: missing.map((p) => p.name) };
    });
  }, [topCommonKeys, projects]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const p of projects) for (const key of Object.keys(p.env_vars)) {
      const prefix = key.includes('_') ? key.split('_')[0] : 'OTHER';
      cats[prefix] = (cats[prefix] || 0) + 1;
    }
    return Object.entries(cats).sort(([, a], [, b]) => b - a).slice(0, 8);
  }, [projects]);

  const maxVars = topProjects[0] ? Object.keys(topProjects[0].env_vars).length : 1;

  const securityScore = useMemo(() => {
    let issueCount = 0;
    let total = 0;
    const details: { projectName: string; key: string; value: string; reason: string }[] = [];
    for (const p of projects) {
      for (const [k, v] of Object.entries(p.env_vars)) {
        total++;
        const val = v.trim();
        const lower = val.toLowerCase();
        let reason = '';
        if (!val) {
          reason = 'Empty value';
        } else if (/^(password|secret|changeme|placeholder|your_|xxxx)/i.test(val)) {
          reason = 'Obvious placeholder — replace with a real value';
        } else if (/^postgres(ql)?:\/\/.*:password@/i.test(val) || /^mysql:\/\/.*:password@/i.test(val) || /^redis:\/\/.*:password@/i.test(val)) {
          reason = 'Database URL with default password — use a real credential';
        } else if (/^http:\/\/localhost/i.test(val) && !k.includes('ENV')) {
          reason = 'Points to localhost — verify this is intended for production';
        }
        if (reason) {
          issueCount++;
          details.push({ projectName: p.name, key: k, value: val, reason });
        }
      }
    }
    const score = total === 0 ? 100 : Math.round(((total - issueCount) / total) * 100);
    const label = score >= 90 ? 'Great' : score >= 70 ? 'Fair' : score >= 50 ? 'Needs Work' : 'Poor';
    return { score, label, issues: issueCount, total, details };
  }, [projects]);

  const sharedCount = useMemo(() => projects.filter(p => p.share_password).length, [projects]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<FolderKanban className="h-3.5 w-3.5" />} label="Projects" value={String(projects.length)} />
        <StatCard icon={<Key className="h-3.5 w-3.5" />} label="Total Variables" value={String(totalVars)} />
        <StatCard icon={<BarChart3 className="h-3.5 w-3.5" />} label="Avg / Project" value={projects.length > 0 ? (totalVars / projects.length).toFixed(1) : '0'} />
        <StatCard icon={<Hash className="h-3.5 w-3.5" />} label="Unique Keys" value={String(allKeys.size)} />
      </div>

      {projects.length === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No projects yet. Add one from the sidebar.</p>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <>
          {/* Security Score + LAN + Vault Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Security Score */}
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <h2 className="flex items-center gap-1.5 text-sm font-medium flex-1">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Security Score
                </h2>
                {securityScore.issues > 0 && (
                  <button
                    onClick={() => setShowIssues(!showIssues)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    {showIssues ? 'Hide' : `Review ${securityScore.issues} Issue${securityScore.issues !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none"
                      stroke={securityScore.score >= 90 ? '#22c55e' : securityScore.score >= 70 ? '#eab308' : securityScore.score >= 50 ? '#f97316' : '#ef4444'}
                      strokeWidth="3" strokeDasharray={`${securityScore.score} ${100 - securityScore.score}`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-sm font-bold">{securityScore.score}%</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className={cn('font-medium', securityScore.score >= 90 ? 'text-emerald-500' : securityScore.score >= 70 ? 'text-amber-500' : 'text-red-500')}>{securityScore.label}</p>
                  <p>{securityScore.issues} issue{securityScore.issues !== 1 ? 's' : ''} found across {securityScore.total} variable{securityScore.total !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {showIssues && securityScore.details.length > 0 && (
                <div className="mt-3 space-y-1 max-h-48 overflow-y-auto border-t pt-2">
                  {securityScore.details.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 rounded bg-muted/30 px-2 py-1.5 text-[10px]">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-muted px-1 font-medium text-muted-foreground">{d.projectName}</span>
                          <span className="font-mono font-medium text-env-key">{d.key}</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{d.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vault Stats */}
            <div className="rounded-lg border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Server className="h-4 w-4 text-muted-foreground" />
                Vault Stats
              </h2>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Projects</span>
                  <span className="font-medium">{projects.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Variables</span>
                  <span className="font-medium">{totalVars}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Unique Keys</span>
                  <span className="font-medium">{allKeys.size}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Shared Projects</span>
                  <span className="font-medium">{sharedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">AI Rate Limit</span>
                  <span className="font-medium">{ai.getDailyRemaining()}/100 today</span>
                </div>
              </div>
            </div>
          </div>

          {/* Projects by Variable Count */}
          <div>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Projects by Variable Count
            </h2>
            <div className="space-y-1.5">
              {topProjects.map((p) => {
                const count = Object.keys(p.env_vars).length;
                const pct = maxVars > 0 ? (count / maxVars) * 100 : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => { selectProject(p.id); setView('project'); }}
                    className="w-full rounded-lg border bg-card px-3 py-2 text-left hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-primary/20 text-[10px] font-bold text-primary">
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{count} vars</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Most Common Variable Names */}
          {varFrequency.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Most Common Variable Names
              </h2>
              <div className="rounded-lg border bg-card p-3">
                {varFrequency.map(([key, { count, projects: projs }]) => {
                  const maxFreq = varFrequency[0][1].count;
                  const pct = (count / maxFreq) * 100;
                  return (
                    <div key={key} className="mb-2 last:mb-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-xs font-medium text-env-key">{key}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {count}/{projects.length} ({Math.round((count / projects.length) * 100)}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500/70 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key Categories */}
          {categoryData.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                Key Categories (by prefix)
              </h2>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap gap-2">
                  {categoryData.map(([prefix, count], idx) => {
                    const colors = ['bg-blue-500/20 text-blue-400 border-blue-500/30','bg-violet-500/20 text-violet-400 border-violet-500/30','bg-emerald-500/20 text-emerald-400 border-emerald-500/30','bg-amber-500/20 text-amber-400 border-amber-500/30','bg-rose-500/20 text-rose-400 border-rose-500/30','bg-cyan-500/20 text-cyan-400 border-cyan-500/30','bg-orange-500/20 text-orange-400 border-orange-500/30','bg-pink-500/20 text-pink-400 border-pink-500/30'];
                    return (
                      <div key={prefix} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${colors[idx % colors.length]}`}>
                        <span>{prefix}*</span>
                        <span className="opacity-70">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Coverage Gaps */}
          {coverageData.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Coverage Gaps
              </h2>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Variable</th>
                      <th className="px-3 py-2 font-medium">Coverage</th>
                      <th className="px-3 py-2 font-medium">Missing Projects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageData.map((item) => (
                      <tr key={item.key} className="border-t border-border/40">
                        <td className="px-3 py-2 font-mono text-xs font-medium text-env-key">{item.key}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${item.pct === 100 ? 'bg-emerald-500' : item.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${item.pct}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">{item.coverage}/{item.total}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {item.missingProjects.length > 0 ? item.missingProjects.join(', ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stale Projects */}
          {(() => {
            const now = Date.now() / 1000;
            const staleThreshold = now - 30 * 86400;
            const stale = projects.filter(p => {
              const snaps = historyMap[p.id] || [];
              return snaps.length === 0 || snaps[snaps.length - 1].timestamp < staleThreshold;
            });
            if (stale.length === 0) return null;
            return <div className="rounded-lg border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Stale Projects
              </h2>
              <div className="space-y-1">
                {stale.map(p => {
                  const snaps = historyMap[p.id] || [];
                  const last = snaps.length > 0 ? snaps[snaps.length - 1].timestamp : 0;
                  const days = last > 0 ? Math.floor((now - last) / 86400) : null;
                  return <div key={p.id} className="flex items-center gap-2 text-[10px]">
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                    <button onClick={() => { selectProject(p.id); setView('project'); }} className="font-medium text-foreground/80 hover:underline">{p.name}</button>
                    <span className="text-muted-foreground/60">{days ? `${days}d since last change` : 'No changes yet'}</span>
                  </div>;
                })}
              </div>
            </div>;
          })()}

          {/* Analytics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recent Changes */}
            <div className="rounded-lg border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Changes
              </h2>
              {(() => {
                const all = Object.values(historyMap).flat().sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
                if (all.length === 0) return <p className="text-[10px] text-muted-foreground">No snapshots yet.</p>;
                return <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {all.map((item, i) => {
                    const sec = Math.floor((Date.now() - item.timestamp * 1000) / 1000);
                    const ago = sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : sec < 86400 ? `${Math.floor(sec / 3600)}h` : `${Math.floor(sec / 86400)}d`;
                    return <div key={i} className="flex items-center gap-2 text-[10px]">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-medium text-muted-foreground">{item.projectName}</span>
                      <span className="truncate text-foreground/80">{item.label}</span>
                      <span className="shrink-0 text-muted-foreground/60 ml-auto">{ago} ago</span>
                    </div>;
                  })}
                </div>;
              })()}
            </div>

            {/* Missing Critical Vars */}
            <div className="rounded-lg border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                Missing Critical Vars
              </h2>
              {(() => {
                const critical = ['DATABASE_URL', 'PORT', 'NODE_ENV', 'API_KEY', 'SECRET_KEY', 'REDIS_URL'];
                const missing: { project: string; projectId: string; key: string }[] = [];
                for (const p of projects) {
                  for (const key of critical) {
                    if (!(key in p.env_vars)) missing.push({ project: p.name, projectId: p.id, key });
                  }
                }
                if (missing.length === 0) return <p className="text-[10px] text-muted-foreground">All critical vars covered.</p>;
                return <div className="space-y-1 max-h-40 overflow-y-auto">
                  {missing.slice(0, 12).map((item, i) => (
                    <button key={i} onClick={() => { selectProject(item.projectId); setView('project'); }} className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1.5 text-[10px] w-full text-left hover:bg-accent transition-colors">
                      <span className="rounded bg-amber-500/10 px-1 font-mono font-medium text-amber-500">{item.key}</span>
                      <span className="text-muted-foreground">missing in</span>
                      <span className="font-medium text-foreground/80">{item.project}</span>
                    </button>
                  ))}
                </div>;
              })()}
            </div>

            {/* Duplicate Values */}
            <div className="rounded-lg border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <GitCompare className="h-4 w-4 text-muted-foreground" />
                Duplicate Values
              </h2>
              {(() => {
                const valueMap: Record<string, { key: string; project: string; projectId: string }[]> = {};
                for (const p of projects) {
                  for (const [k, v] of Object.entries(p.env_vars)) {
                    if (!v.trim()) continue;
                    if (!valueMap[v]) valueMap[v] = [];
                    valueMap[v].push({ key: k, project: p.name, projectId: p.id });
                  }
                }
                const dupes = Object.entries(valueMap).filter(([, entries]) => {
                  const keySet = new Set(entries.map(e => e.key));
                  const projectSet = new Set(entries.map(e => e.project));
                  return keySet.size > 1 || projectSet.size > 1;
                });
                if (dupes.length === 0) return <p className="text-[10px] text-muted-foreground">No duplicate values found.</p>;
                return <div className="space-y-1 max-h-40 overflow-y-auto">
                  {dupes.slice(0, 6).map(([val, entries], i) => (
                    <div key={i} className="rounded bg-muted/30 px-2 py-1.5 text-[10px]">
                      <p className="font-mono text-muted-foreground truncate mb-0.5">{val}</p>
                      <div className="flex flex-wrap gap-1">
                        {entries.map((e, j) => (
                          <button key={j} onClick={() => { selectProject(e.projectId); setView('project'); }} className="rounded bg-muted px-1 py-0.5 hover:bg-accent transition-colors">
                            <span className="text-muted-foreground">{e.project}.</span><span className="font-mono font-medium text-env-key">{e.key}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>;
              })()}
            </div>

            {/* Change Velocity */}
            <div className="rounded-lg border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Change Velocity
              </h2>
              {(() => {
                const now = Date.now() / 1000;
                const week = now - 7 * 86400;
                const month = now - 30 * 86400;
                const rows: { project: string; projectId: string; week: number; month: number }[] = [];
                for (const p of projects) {
                  const snaps = historyMap[p.id] || [];
                  rows.push({
                    project: p.name,
                    projectId: p.id,
                    week: snaps.filter(s => s.timestamp >= week).length,
                    month: snaps.filter(s => s.timestamp >= month).length,
                  });
                }
                if (rows.every(r => r.week === 0 && r.month === 0)) return <p className="text-[10px] text-muted-foreground">No change data yet.</p>;
                return <div className="space-y-1 max-h-40 overflow-y-auto">
                  {rows.filter(r => r.week > 0 || r.month > 0).sort((a, b) => b.week - a.week).slice(0, 6).map((r, i) => {
                    const maxSnaps = Math.max(...rows.map(x => Math.max(x.week, 1)));
                    const pct = maxSnaps > 0 ? (r.week / maxSnaps) * 100 : 0;
                    return <div key={i} className="flex items-center gap-2 text-[10px]">
                      <button onClick={() => { selectProject(r.projectId); setView('project'); }} className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/80 hover:bg-accent transition-colors">{r.project}</button>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{r.week}w</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground/60">{r.month}m</span>
                    </div>;
                  })}
                </div>;
              })()}
            </div>
          </div>

        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}
