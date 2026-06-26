'use client';

import { useState } from 'react';
import { Settings, RefreshCw, Download, Upload, AlertTriangle } from 'lucide-react';
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
  const { state, autoLockTimeout, changeAutoLockTimeout, clipboardTimeout, changeClipboardTimeout, refreshVault } = useVault();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFilePath, setRestoreFilePath] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateStatus(null);
    try {
      const { checkUpdate, installUpdate } = await import('@tauri-apps/api/updater');
      const { shouldUpdate, manifest } = await checkUpdate();
      if (shouldUpdate && manifest) {
        setUpdateStatus(`Update v${manifest.version} available`);
        const install = confirm(`Update v${manifest.version} is available. Download now?`);
        if (install) {
          await installUpdate();
        }
      } else {
        setUpdateStatus('You\'re up to date');
        setTimeout(() => setUpdateStatus(null), 3000);
      }
    } catch {
      setUpdateStatus('App is running in browser');
      setTimeout(() => setUpdateStatus(null), 3000);
    } finally {
      setChecking(false);
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
      await tauri.exportVault(state.password, path as string);
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
      await tauri.importVault(state.password, restoreFilePath, restoreMode);
      await refreshVault();
      setShowRestoreConfirm(false);
      setRestoreFilePath(null);
      setOpen(false);
      toast({ title: restoreMode === 'replace' ? 'Vault replaced successfully' : 'Vault merged successfully' });
      setShowRestoreConfirm(false);
      setRestoreFilePath(null);
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
              {updateStatus && (
                <p className="text-xs text-center text-muted-foreground">{updateStatus}</p>
              )}
          </div>
          </div>

        </div>

        <RestoreDialog
          open={showRestoreConfirm}
          onOpenChange={setShowRestoreConfirm}
          restoreMode={restoreMode}
          setRestoreMode={setRestoreMode}
          restoring={restoring}
          onConfirm={handleConfirmRestore}
        />
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
