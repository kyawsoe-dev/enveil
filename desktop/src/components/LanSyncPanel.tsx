'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVault } from './VaultProvider';
import * as lan from '@/lib/lan';
import type { PeerInfo, ProjectSummary } from '@/lib/lan';

export default function LanSyncPanel() {
  const { state, refreshVault } = useVault();
  const [syncState, setSyncState] = useState<lan.SyncState | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [peerProjects, setPeerProjects] = useState<Record<string, ProjectSummary[]>>({});

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
    refreshStatus();
  }, [refreshStatus]);

  const toggleSync = async () => {
    setLoading(true);
    setSyncErr(null);
    try {
      if (status.active) {
        if (pollInterval) clearInterval(pollInterval);
        setPollInterval(null);
        await lan.stopLanSync();
      } else {
        await lan.startLanSync();
        const interval = setInterval(refreshStatus, 3000);
        setPollInterval(interval);
      }
      await refreshStatus();
    } catch (err) {
      setSyncErr(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const peersKey = JSON.stringify(status.peers.map((p) => p.device_name).sort());
  useEffect(() => {
    if (!status.active) {
      setPeerProjects({});
      return;
    }
    const names: string[] = JSON.parse(peersKey);
    names.forEach((name) => {
      lan.getPeerProjects(name).then((projects) => {
        setPeerProjects((prev) => ({ ...prev, [name]: projects }));
      }).catch(() => {
        setPeerProjects((prev) => ({ ...prev, [name]: [] }));
      });
    });
  }, [status.active, peersKey]);

  const syncProject = async (peer: PeerInfo, projectId: string) => {
    if (!state.password) return;
    setLoading(true);
    setSyncErr(null);
    setSuccessMsg(null);
    try {
      await lan.syncProjectFromPeer(peer.device_name, projectId, state.password, '');
      await refreshVault();
      setSuccessMsg(`Project synced from ${peer.device_name}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setSyncErr(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status.active ? (
            <Wifi className="h-4 w-4 text-emerald-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">LAN Sync</span>
          <Badge variant={status.active ? 'success' : 'secondary'} className="text-[10px]">
            {status.active ? 'Active' : 'Off'}
          </Badge>
        </div>
        <Button
          variant={status.active ? 'destructive' : 'default'}
          size="sm"
          onClick={toggleSync}
          disabled={loading}
          className="h-7 text-xs gap-1"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {status.active ? 'Stop' : 'Start'}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Device name:</span>
        {editingName ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (nameInput.trim()) {
                await lan.setDeviceName(nameInput.trim());
                setEditingName(false);
                refreshStatus();
              }
            }}
            className="flex items-center gap-1"
          >
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="h-6 rounded border border-input bg-background px-1.5 text-xs font-mono text-foreground outline-none focus:border-ring"
              autoFocus
            />
            <button
              type="submit"
              className="flex h-5 w-5 items-center justify-center rounded text-emerald-500 hover:text-emerald-400"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <>
            <code className="text-foreground">{status.my_device_name}</code>
            <button
              onClick={() => {
                setNameInput(status.my_device_name);
                setEditingName(true);
              }}
              className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              title="Rename device"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
      {status.active && (
        <div className="text-xs text-muted-foreground">
          Listening on port <code className="text-foreground">{status.port}</code>
        </div>
      )}

      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {syncErr && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="break-all">{syncErr}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {status.active && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Discovered Peers ({status.peers.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshStatus}
              className="h-6 w-6 p-0"
              title="Refresh peers"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          {status.peers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-xs text-muted-foreground">
              <Users className="h-8 w-8 opacity-30" />
              <p>No peers discovered on the network</p>
              <p className="text-[10px]">Make sure ENVEIL is open on other machines</p>
            </div>
          ) : (
            <div className="space-y-2">
              {status.peers.map((peer) => (
                <div
                  key={peer.device_name}
                  className="rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Laptop className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{peer.device_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {peer.ip}:{peer.port}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-emerald-500">Online</span>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Available projects
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {peerProjects[peer.device_name]?.length > 0 ? (
                        peerProjects[peer.device_name].map((p) => (
                          <Button
                            key={p.id}
                            variant="outline"
                            size="sm"
                            onClick={() => syncProject(peer, p.id)}
                            disabled={loading}
                            className="h-7 w-full justify-between text-xs font-mono"
                          >
                            <span>{p.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {p.env_count} vars
                            </span>
                            <Download className="h-3 w-3 shrink-0" />
                          </Button>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground py-1">
                          No projects available
                        </p>
                      )}
                    </div>
                    </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!status.active && (
        <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          <p>Start LAN sync to discover team members on your network</p>
          <p className="mt-1 text-[10px]">
            Both devices must be on the same network
          </p>
        </div>
      )}
    </div>
  );
}
