'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useVault } from './VaultProvider';

export default function ResetVaultDialog() {
  const { resetVault } = useVault();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (confirm !== 'RESET') {
      setError('Type RESET to confirm');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetVault();
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConfirm(''); setError(''); }}}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
          Reset Vault
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Vault</DialogTitle>
          <DialogDescription className="sr-only">
            Permanently delete the entire vault and all projects.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive dark:text-destructive-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              This will permanently delete the entire vault and all projects inside it.
              You will be redirected to create a new master password. This action cannot be undone.
            </span>
          </div>

          <label className="block text-xs font-medium text-muted-foreground">
            Type <span className="font-mono font-bold text-foreground">RESET</span> to confirm
          </label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type RESET"
            className="h-9 font-mono text-sm"
            autoFocus
          />

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive dark:text-destructive-foreground">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleReset}
            variant="destructive"
            className="w-full gap-2"
            disabled={loading || confirm !== 'RESET'}
          >
            <Trash2 className="h-4 w-4" />
            {loading ? 'Resetting...' : 'Delete Everything'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
