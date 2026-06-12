'use client';

import { useMemo } from 'react';
import { useVault } from './VaultProvider';
import { Key, FolderKanban, BarChart3, ShieldCheck, Hash, PieChart } from 'lucide-react';

export default function Dashboard() {
  const { state, selectProject, setView } = useVault();
  const projects = state.vault?.projects ?? [];

  const totalVars = projects.reduce((sum, p) => sum + Object.keys(p.env_vars).length, 0);
  const topProjects = useMemo(
    () => [...projects].sort((a, b) => Object.keys(b.env_vars).length - Object.keys(a.env_vars).length),
    [projects],
  );

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

  const uniqueKeyCount = Object.keys(freqMap).length;

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
      return {
        key,
        coverage: covered.length,
        total: projects.length,
        pct: Math.round((covered.length / projects.length) * 100),
        missingProjects: missing.map((p) => p.name),
      };
    });
  }, [topCommonKeys, projects]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const p of projects) {
      for (const key of Object.keys(p.env_vars)) {
        const prefix = key.includes('_') ? key.split('_')[0] : 'OTHER';
        cats[prefix] = (cats[prefix] || 0) + 1;
      }
    }
    return Object.entries(cats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [projects]);

  const maxVars = topProjects[0] ? Object.keys(topProjects[0].env_vars).length : 1;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<FolderKanban className="h-3.5 w-3.5" />} label="Projects" value={String(projects.length)} />
        <StatCard icon={<Key className="h-3.5 w-3.5" />} label="Total Variables" value={String(totalVars)} />
        <StatCard icon={<BarChart3 className="h-3.5 w-3.5" />} label="Avg / Project" value={projects.length > 0 ? (totalVars / projects.length).toFixed(1) : '0'} />
        <StatCard icon={<Hash className="h-3.5 w-3.5" />} label="Unique Keys" value={String(uniqueKeyCount)} />
      </div>

      {projects.length === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No projects yet. Add one from the sidebar.</p>
          </div>
        </div>
      )}

      {topProjects.length > 0 && (
        <>
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
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

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
                        <div
                          className="h-full rounded-full bg-emerald-500/70 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.pct === 100 ? 'bg-emerald-500' : item.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${item.pct}%` }}
                              />
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

          {categoryData.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                Key Categories (by prefix)
              </h2>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap gap-2">
                  {categoryData.map(([prefix, count], idx) => {
                    const colors = [
                      'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      'bg-violet-500/20 text-violet-400 border-violet-500/30',
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                      'bg-amber-500/20 text-amber-400 border-amber-500/30',
                      'bg-rose-500/20 text-rose-400 border-rose-500/30',
                      'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                      'bg-orange-500/20 text-orange-400 border-orange-500/30',
                      'bg-pink-500/20 text-pink-400 border-pink-500/30',
                    ];
                    return (
                      <div
                        key={prefix}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${colors[idx % colors.length]}`}
                      >
                        <span>{prefix}*</span>
                        <span className="opacity-70">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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
