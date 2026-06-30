'use client';

import { useState } from 'react';
import { Settings, RefreshCw, Download, Upload, AlertTriangle, ExternalLink, RotateCcw } from 'lucide-react';
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

  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateInfo(null);
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
      setUpdateInfo(null);
    } finally {
      setChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    setUpdating(true);
    try {
      const { installUpdate } = await import('@tauri-apps/api/updater');
      await installUpdate();
    } catch (err) {
      toast({ title: 'Update failed', description: String(err), variant: 'destructive' });
      setUpdating(false);
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
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
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
              {updateInfo && updateInfo.available && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-primary" />
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
                    <Button variant="default" size="sm" className="gap-1 h-7 text-[10px]" onClick={handleInstallUpdate} disabled={updating}>
                      <Download className="h-3 w-3" />
                      {updating ? 'Installing...' : 'Download & Install'}
                    </Button>
                  </div>
                </div>
              )}
              {updateInfo && !updateInfo.available && (
                <p className="text-xs text-center text-muted-foreground">You're up to date</p>
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
    </>
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
