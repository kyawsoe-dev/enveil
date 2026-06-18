'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  Users,
  Download,
  RefreshCw,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Globe,
  Lock,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useVault } from './VaultProvider';
import * as lan from '@/lib/lan';
import type { PeerInfo, ProjectSummary } from '@/lib/lan';

export default function LanSyncView() {
  const { state, setView, refreshVault } = useVault();
  const [syncState, setSyncState] = useState<lan.SyncState | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [peerErrors, setPeerErrors] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [peerProjects, setPeerProjects] = useState<Record<string, ProjectSummary[]>>({});
  const [loadedPeers, setLoadedPeers] = useState<Set<string>>(new Set());
  const [refreshingPeers, setRefreshingPeers] = useState(false);
  const [requestingProject, setRequestingProject] = useState<{ peer: PeerInfo; id: string; name: string } | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [showSharePwd, setShowSharePwd] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const status = syncState ?? { active: false, peers: [], my_device_name: '', port: 0 };

  const refreshStatus = useCallback(async () => {
    try {
      const s = await lan.getSyncStatus();
      setSyncState(s);
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    setPeerProjects({});
    setLoadedPeers(new Set());
    setPeerErrors({});
    const saved = localStorage.getItem('enveil_device_name');
    if (saved) {
      lan.setDeviceName(saved).catch(() => {});
    }
    const init = async () => {
      await refreshStatus();
      setRefreshTick((t) => t + 1);
    };
    init();
    const interval = setInterval(async () => {
      await refreshStatus();
      setRefreshTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const toggleSync = async () => {
    setLoading(true);
    setSyncErr(null);
    try {
      if (status.active) {
        await lan.stopLanSync();
        setPeerProjects({});
        setPeerErrors({});
      } else {
        await lan.startLanSync();
      }
      await refreshStatus();
    } catch (err) {
      setSyncErr(String(err));
    } finally {
      setLoading(false);
    }
  };

  const refreshPeers = async () => {
    setRefreshingPeers(true);
    setPeerProjects({});
    setLoadedPeers(new Set());
    setPeerErrors({});
    await refreshStatus();
    setRefreshTick((t) => t + 1);
    setRefreshingPeers(false);
  };

  const peersKey = JSON.stringify(status.peers.map((p) => p.device_name).sort());
  useEffect(() => {
    if (!status.active) {
      setPeerProjects({});
      setLoadedPeers(new Set());
      setPeerErrors({});
      return;
    }
    const names: string[] = JSON.parse(peersKey);
    names.forEach((name) => {
      setLoadedPeers((prev) => { const n = new Set(prev); n.delete(name); return n; });
      lan.getPeerProjects(name).then((projects) => {
        setPeerProjects((prev) => ({ ...prev, [name]: projects }));
        setLoadedPeers((prev) => { const n = new Set(prev); n.add(name); return n; });
      }).catch((err) => {
        console.error(`Failed to fetch projects from ${name}:`, err);
        setPeerProjects((prev) => ({ ...prev, [name]: [] }));
        setLoadedPeers((prev) => { const n = new Set(prev); n.add(name); return n; });
        setPeerErrors((prev) => ({ ...prev, [name]: String(err) }));
      });
    });
  }, [status.active, peersKey, refreshTick]);

  const confirmSync = async () => {
    if (!requestingProject || !state.password) return;
    const { peer, id, name } = requestingProject;
    setRequestingProject(null);
    setSharePassword('');
    setShowSharePwd(false);
    setLoading(true);
    setSyncErr(null);
    setSuccessMsg(null);
    try {
      await lan.syncProjectFromPeer(peer.device_name, id, state.password, sharePassword);
      await refreshVault();
      setSuccessMsg(`"${name}" synced from ${peer.device_name}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setSyncErr(String(err));
    } finally {
      setLoading(false);
    }
  };

  const syncProject = (peer: PeerInfo, project: ProjectSummary) => {
    if (!state.password) return;
    setRequestingProject({ peer, id: project.id, name: project.name });
    setSharePassword('');
    setShowSharePwd(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
      {requestingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">Download &ldquo;{requestingProject.name}&rdquo;</p>
              <button
                onClick={() => { setRequestingProject(null); setSharePassword(''); setShowSharePwd(false); }}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">from {requestingProject.peer.device_name}</p>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Share password
            </label>
            <div className="relative mb-3">
              <Input
                type={showSharePwd ? 'text' : 'password'}
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                placeholder="Enter the share password set by the sender"
                className="h-8 pr-9 text-xs"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') confirmSync(); }}
              />
              <button
                type="button"
                onClick={() => setShowSharePwd(!showSharePwd)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSharePwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setRequestingProject(null); setSharePassword(''); setShowSharePwd(false); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmSync} disabled={!sharePassword.trim()} className="gap-1">
                <Download className="h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}

      {status.active ? (
            <Wifi className="h-5 w-5 text-emerald-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-muted-foreground" />
          )}
          <h1 className="text-lg font-semibold">LAN Sync</h1>
          <Badge variant={status.active ? 'success' : 'secondary'} className="text-[10px]">
            {status.active ? 'Active' : 'Off'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={status.active ? 'destructive' : 'default'}
            size="sm"
            onClick={toggleSync}
            disabled={loading}
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {status.active ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      {status.active ? (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              {successMsg}
            </motion.div>
          )}
          {syncErr && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-400"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="break-all">{syncErr}</span>
            </motion.div>
          )}

          <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
            <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">My Device:</span>
            {editingName ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (nameInput.trim()) {
                    await lan.setDeviceName(nameInput.trim());
                    localStorage.setItem('enveil_device_name', nameInput.trim());
                    setEditingName(false);
                    refreshStatus();
                  }
                }}
                className="flex items-center gap-1"
              >
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-7 text-xs w-48"
                  autoFocus
                />
                <button
                  type="submit"
                  className="flex h-6 w-6 items-center justify-center rounded text-emerald-500 hover:text-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <>
                <code className="text-foreground text-sm">{status.my_device_name}</code>
                <button
                  onClick={() => {
                    setNameInput(status.my_device_name);
                    setEditingName(true);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Port: <code className="text-foreground">{status.port}</code>
            </span>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Discovered Peers ({status.peers.length})
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshPeers}
                  disabled={refreshingPeers}
                  className="h-7 text-xs gap-1"
                >
                  {refreshingPeers ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>

            {status.peers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-xs text-muted-foreground">
                <Users className="h-10 w-10 opacity-30" />
                <p>No peers discovered on the network</p>
                <p className="text-[10px]">Make sure ENVEIL is open on other machines</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {status.peers.map((peer) => (
                    <div key={peer.device_name} className="rounded-lg border bg-background p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Laptop className="h-5 w-5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{peer.device_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {peer.ip}:{peer.port}
                            </p>
                          </div>
                        </div>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Available projects
                        </p>
                        {loadedPeers.has(peer.device_name) ? (
                          peerProjects[peer.device_name]?.length > 0 ? (
                            peerProjects[peer.device_name].map((p) => (
                              <div
                                  key={p.id}
                                  className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs font-mono"
                                >
                                  <span className="truncate flex items-center gap-1.5">
                                    {p.has_password && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                                    {p.name}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                                      {p.env_count} vars
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => syncProject(peer, p)}
                                      disabled={loading}
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                            ))
                        ) : peerErrors[peer.device_name] ? (
                          <p className="text-xs text-red-500 py-1 break-all">Error: {peerErrors[peer.device_name]}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground py-1">No projects available</p>
                        )
                        ) : (
                          <p className="text-xs text-muted-foreground py-1">Loading...</p>
                        )}
                      </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center text-muted-foreground">
          <WifiOff className="h-20 w-20 opacity-20" />
          <div>
            <p className="text-xl font-semibold">LAN Sync is Off</p>
            <p className="text-sm mt-2">Click <strong>Start</strong> in the header to discover team members</p>
          </div>
          <p className="text-xs">Both devices must be on the same local network</p>
        </div>
      )}
    </div>
  );
}
