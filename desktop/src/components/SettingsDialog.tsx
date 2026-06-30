'use client';

import { useEffect, useState } from 'react';
import { Settings, RefreshCw, Download, Upload, AlertTriangle, ExternalLink, RotateCcw, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useVault } from './VaultProvider';
import { useToast } from '@/hooks/use-toast';
import ChangePasswordDialog from './ChangePasswordDialog';
import ResetVaultDialog from './ResetVaultDialog';
import * as tauri from '@/lib/tauri';

export default function SettingsDialog() {
  const { state, autoLockTimeout, changeAutoLockTimeout, clipboardTimeout, changeClipboardTimeout, refreshVault, getPassword } = useVault();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFilePath, setRestoreFilePath] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreSuccess, setShowRestoreSuccess] = useState(false);
  const [restoreSuccessTitle, setRestoreSuccessTitle] = useState('');
  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseNotes?: string;
  } | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');

  useEffect(() => {
    checkForUpdates();
  }, []);

  useEffect(() => {
    if (!open) return;
    checkForUpdates();
  }, [open]);

  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateError(null);
    try {
      const { checkUpdate } = await import('@tauri-apps/api/updater');
      const { shouldUpdate, manifest } = await checkUpdate();
      const { invoke } = await import('@tauri-apps/api/tauri');
      const currentVersion: string = await invoke('get_app_version');
      if (shouldUpdate && manifest) {
        setUpdateInfo({ available: true, currentVersion, latestVersion: manifest.version, releaseNotes: manifest.body });
      } else {
        setUpdateInfo({ available: false, currentVersion, latestVersion: currentVersion });
      }
    } catch {
      // Fallback to GitHub API
      try {
        const { invoke } = await import('@tauri-apps/api/tauri');
        const currentVersion: string = await invoke('get_app_version');
        const res = await fetch('https://api.github.com/repos/kyawsoe-dev/enveil/releases/latest');
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
        const data = await res.json();
        const latestVersion = data.tag_name.replace(/^v/, '');
        if (latestVersion !== currentVersion) {
          setUpdateInfo({ available: true, currentVersion, latestVersion, releaseNotes: data.body });
        } else {
          setUpdateInfo({ available: false, currentVersion, latestVersion: currentVersion });
        }
      } catch (e) {
        setUpdateInfo(null);
        setUpdateError(String(e));
      }
    } finally {
      setChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    setUpdating(true);
    setDownloadProgress(0);
    setDownloadStatus('Starting download...');

    let unlisten: (() => void) | null = null;
    try {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<{ status: string; data?: { downloaded: number; contentLength?: number }; error?: string }>('tauri://update-status', (event) => {
        const { status, data, error } = event.payload;
        if (status === 'DOWNLOADING' && data) {
          const { downloaded, contentLength } = data;
          if (contentLength && contentLength > 0) {
            const pct = Math.round((downloaded / contentLength) * 100);
            setDownloadProgress(pct);
          }
          const mbDownloaded = (downloaded / 1024 / 1024).toFixed(1);
          const mbTotal = contentLength ? ` / ${(contentLength / 1024 / 1024).toFixed(1)} MB` : '';
          setDownloadStatus(`Downloading ${mbDownloaded}${mbTotal}`);
        } else if (status === 'INSTALLING') {
          setDownloadStatus('Installing update...');
          setDownloadProgress(100);
        } else if (status === 'ERROR') {
          throw new Error(error || 'Update failed');
        }
      });

      const { installUpdate } = await import('@tauri-apps/api/updater');
      await installUpdate();
    } catch (err) {
      toast({ title: 'Update failed', description: String(err), variant: 'destructive' });
      setUpdating(false);
      setShowUpgradeConfirm(false);
    } finally {
      if (unlisten) unlisten();
    }
  };

  const handleOpenRelease = async () => {
    try {
      const { open } = await import('@tauri-apps/api/shell');
      await open('https://github.com/kyawsoe-dev/enveil/releases/latest');
    } catch {
      // fallback
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { save } = await import('@tauri-apps/api/dialog');
      const path = await save({
        defaultPath: 'enveil-backup.vault',
        filters: [{ name: 'ENVEIL Backup', extensions: ['vault'] }],
      });
      if (!path) return;
      await tauri.exportVault(getPassword(), path as string);
      toast({ title: 'Vault exported successfully' });
    } catch (err) {
      toast({ title: 'Backup failed', description: String(err), variant: 'destructive' });
    } finally {
      setBackingUp(false);
    }
  };

  const handleSelectRestoreFile = async () => {
    try {
      const { open } = await import('@tauri-apps/api/dialog');
      const path = await open({
        filters: [{ name: 'ENVEIL Backup', extensions: ['vault'] }],
        multiple: false,
      });
      if (!path) return;
      setRestoreFilePath(path as string);
      setShowRestoreConfirm(true);
    } catch (err) {
      toast({ title: 'Failed to open file', description: String(err), variant: 'destructive' });
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreFilePath) return;
    setRestoring(true);
    try {
      await tauri.importVault(getPassword(), restoreFilePath, restoreMode);
      await refreshVault();
      setShowRestoreConfirm(false);
      setRestoreSuccessTitle(restoreMode === 'replace' ? 'Vault replaced successfully' : 'Vault merged successfully');
      setOpen(false);
      setTimeout(() => setShowRestoreSuccess(true), 300);
    } catch (err) {
      toast({ title: 'Restore failed', description: String(err), variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    changeAutoLockTimeout(e.target.value);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground relative"
        >
          <Settings className="h-4 w-4" />
          Settings
          {updateInfo?.available && (
            <Circle className="absolute right-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-green-500 fill-green-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Vault Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure vault security and behavior.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Auto-Lock Timeout
            </label>
            <p className="text-xs text-muted-foreground leading-normal">
              Automatically lock the vault and clear session secrets after a period of user inactivity.
            </p>
            <select
              value={autoLockTimeout}
              onChange={handleTimeoutChange}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
            >
              <option value="never">Never (Keep unlocked)</option>
              <option value="1">1 Minute</option>
              <option value="5">5 Minutes</option>
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="60">1 Hour</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Clipboard Auto-Clear
            </label>
            <p className="text-xs text-muted-foreground leading-normal">
              Automatically clear the clipboard after copying a variable value.
            </p>
            <select
              value={clipboardTimeout}
              onChange={(e) => changeClipboardTimeout(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
            >
              <option value={0}>Disabled</option>
              <option value={5}>5 Seconds</option>
              <option value={15}>15 Seconds</option>
              <option value={30}>30 Seconds</option>
              <option value={60}>1 Minute</option>
            </select>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium leading-none">Backup & Restore</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Export your vault as an encrypted backup file, or restore from a previous backup.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs"
                onClick={handleBackup}
                disabled={backingUp}
              >
                <Download className={`h-4 w-4 ${backingUp ? 'animate-pulse' : ''}`} />
                {backingUp ? 'Exporting...' : 'Backup Vault'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs"
                onClick={handleSelectRestoreFile}
              >
                <Upload className="h-4 w-4" />
                Restore Vault
              </Button>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium leading-none">Security & Maintenance</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Manage your master password or securely wipe the local vault.
            </p>
            <div className="flex flex-col gap-2">
              <ChangePasswordDialog />
              <ResetVaultDialog />
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs"
                  onClick={checkForUpdates}
                  disabled={checking}
                >
                  <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Checking...' : 'Check for Updates'}
                </Button>
                {updateInfo?.available && (
                  <Circle className="absolute -top-1 -right-1 h-3 w-3 text-green-500 fill-green-500" />
                )}
              </div>
              {checking && (
                <div className="flex items-center justify-center py-2">
                  <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground ml-2">Checking for updates...</span>
                </div>
              )}
              {!checking && updateInfo && updateInfo.available && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Circle className="h-3 w-3 text-green-500 fill-green-500" />
                    <span className="text-xs font-medium">Update available</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ENVEIL v{updateInfo.latestVersion} is available. You are using v{updateInfo.currentVersion}.
                  </p>
                  {updateInfo.releaseNotes && (
                    <p className="text-[10px] text-muted-foreground/70 line-clamp-2">{updateInfo.releaseNotes}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-[10px]" onClick={handleOpenRelease}>
                      <ExternalLink className="h-3 w-3" />
                      Open Release
                    </Button>
                    <Button variant="default" size="sm" className="gap-1 h-7 text-[10px]" onClick={() => setShowUpgradeConfirm(true)} disabled={updating}>
                      <Download className="h-3 w-3" />
                      {updating ? 'Installing...' : 'Download & Install'}
                    </Button>
                  </div>
                </div>
              )}
              {!checking && updateInfo && !updateInfo.available && (
                <p className="text-xs text-center text-muted-foreground">You're up to date</p>
              )}
              {!checking && !updateInfo && updateError && (
                <div className="space-y-1">
                  <p className="text-xs text-center text-muted-foreground">Could not check for updates</p>
                  <p className="text-[10px] text-center text-muted-foreground/60">{updateError}</p>
                </div>
              )}
              {!checking && !updateInfo && !updateError && (
                <p className="text-xs text-center text-muted-foreground">Could not check for updates</p>
              )}
          </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>

    <RestoreDialog
      open={showRestoreConfirm}
      onOpenChange={setShowRestoreConfirm}
      restoreMode={restoreMode}
      setRestoreMode={setRestoreMode}
      restoring={restoring}
      onConfirm={handleConfirmRestore}
    />

    <Dialog open={showRestoreSuccess} onOpenChange={setShowRestoreSuccess}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>Restore Successful</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">{restoreSuccessTitle}</p>
          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={() => setShowRestoreSuccess(false)}
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <UpgradeConfirmDialog
      open={showUpgradeConfirm || updating}
      onOpenChange={(v) => { if (!updating) setShowUpgradeConfirm(v); }}
      currentVersion={updateInfo?.currentVersion ?? ''}
      latestVersion={updateInfo?.latestVersion ?? ''}
      onConfirm={handleInstallUpdate}
      updating={updating}
      downloadProgress={downloadProgress}
      downloadStatus={downloadStatus}
    />
    </>
  );
}

function UpgradeConfirmDialog({
  open,
  onOpenChange,
  currentVersion,
  latestVersion,
  onConfirm,
  updating,
  downloadProgress,
  downloadStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion: string;
  latestVersion: string;
  onConfirm: () => Promise<void>;
  updating: boolean;
  downloadProgress: number;
  downloadStatus: string;
}) {
  return (
    <Dialog open={open} onOpenChange={updating ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-[380px]" onPointerDownOutside={updating ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {updating ? 'Downloading Update' : 'Upgrade ENVEIL'}
          </DialogTitle>
          <DialogDescription>
            {updating
              ? `Downloading and installing v${latestVersion} in the background.`
              : `Download and install v${latestVersion} to get the latest features and fixes.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current version</span>
              <span className="font-medium">v{currentVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New version</span>
              <span className="font-medium text-primary">v{latestVersion}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{downloadStatus || 'Waiting...'}</span>
              {updating && <span className="font-medium">{downloadProgress}%</span>}
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>

          {!updating && (
            <p className="text-xs text-muted-foreground">
              The application will download the update and restart automatically.
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onConfirm}
              disabled={updating}
            >
              {updating ? 'Downloading...' : 'Download & Install'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RestoreDialog({
  open,
  onOpenChange,
  restoreMode,
  setRestoreMode,
  restoring,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreMode: 'replace' | 'merge';
  setRestoreMode: (mode: 'replace' | 'merge') => void;
  restoring: boolean;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Restore Vault
          </DialogTitle>
          <DialogDescription>
            This will overwrite your current vault data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-sm font-medium">Restore Mode</label>
            <div className="flex gap-3 mt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  value="replace"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="accent-primary"
                />
                Replace
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  value="merge"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="accent-primary"
                />
                Merge
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {restoreMode === 'replace'
                ? 'Replace all projects with the backup.'
                : 'Add projects from the backup, skipping existing IDs.'}
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={restoring}
            >
              {restoring ? 'Restoring...' : 'Confirm Restore'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
