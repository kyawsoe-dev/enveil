'use client';

import { useState } from 'react';
import { Settings, Shield } from 'lucide-react';
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
import ChangePasswordDialog from './ChangePasswordDialog';
import ResetVaultDialog from './ResetVaultDialog';

export default function SettingsDialog() {
  const { autoLockTimeout, changeAutoLockTimeout } = useVault();
  const [open, setOpen] = useState(false);

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

          <div className="flex items-start gap-2.5 rounded-lg border border-accent bg-accent/20 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
            <Shield className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <span>
              Inactivity is tracked by user interaction events like mouse movements, keystrokes, and scrolling. Once locked, the master password is required to decrypt variables again.
            </span>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium leading-none">Security & Maintenance</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Manage your master password or securely wipe the local vault.
            </p>
            <div className="flex flex-col gap-2">
              <ChangePasswordDialog />
              <ResetVaultDialog />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
