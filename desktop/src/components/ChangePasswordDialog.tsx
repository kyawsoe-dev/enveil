'use client';

import { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
import * as tauri from '@/lib/tauri';

export default function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setError('');
    setSuccess(false);
    if (!oldPw.trim() || !newPw.trim()) { setError('All fields required'); return; }
    if (newPw.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }
    if (oldPw === newPw) { setError('New password must be different from the current password'); return; }

    setLoading(true);
    try {
      await tauri.changePassword(oldPw, newPw);
      setSuccess(true);
      setTimeout(() => { setOpen(false); setSuccess(false); setOldPw(''); setNewPw(''); setConfirmPw(''); }, 1200);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setError(''); setSuccess(false); setOldPw(''); setNewPw(''); setConfirmPw(''); }}}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
          <KeyRound className="h-4 w-4" />
          Change Password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Master Password</DialogTitle>
          <DialogDescription className="sr-only">
            Enter your current password and choose a new master password for the vault.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Current Password</label>
            <Input
              type={show ? 'text' : 'password'}
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              className="h-9 pr-9 font-mono text-sm"
              autoFocus
            />
          </div>
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">New Password</label>
            <Input
              type={show ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="h-9 pr-9 font-mono text-sm"
            />
          </div>
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirm New Password</label>
            <Input
              type={show ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="h-9 pr-9 font-mono text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {show ? 'Hide' : 'Show'} passwords
          </button>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive dark:text-destructive-foreground">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Password changed successfully</span>
            </div>
          )}

          <Button onClick={handleSave} className="w-full" disabled={loading || success}>
            {loading ? 'Changing...' : 'Change Password'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
