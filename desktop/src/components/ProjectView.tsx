'use client';

import { useState } from 'react';
import { useVault } from './VaultProvider';
import { Key, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EnvTable from './EnvTable';

export default function ProjectView() {
  const { state, saveProject } = useVault();
  const selected = state.vault?.projects.find((p) => p.id === state.selectedProjectId);
  const [editingSharePwd, setEditingSharePwd] = useState(false);
  const [sharePwdInput, setSharePwdInput] = useState('');
  const [showSharePwd, setShowSharePwd] = useState(false);

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Key className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Select a project to view its variables</p>
        </div>
      </div>
    );
  }

  const hasSharePwd = !!selected.share_password;

  const setSharePassword = async () => {
    if (sharePwdInput && sharePwdInput.length < 4) return;
    const updated = {
      ...selected,
      share_password: sharePwdInput.trim() || null,
    };
    await saveProject(updated);
    setEditingSharePwd(false);
    setSharePwdInput('');
    setShowSharePwd(false);
  };

  const removeSharePassword = async () => {
    const updated = { ...selected, share_password: null };
    await saveProject(updated);
    setEditingSharePwd(false);
    setSharePwdInput('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-4 border-b bg-muted/30 px-6 py-3">
        <div className="flex items-center gap-2">
          {hasSharePwd ? (
            <Lock className="h-4 w-4 text-amber-500" />
          ) : (
            <Unlock className="h-4 w-4 text-muted-foreground/40" />
          )}
          <span className="text-xs font-medium text-muted-foreground">LAN Share</span>
        </div>
        {editingSharePwd ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                type={showSharePwd ? 'text' : 'password'}
                value={sharePwdInput}
                onChange={(e) => setSharePwdInput(e.target.value)}
                placeholder="Min 4 characters"
                className="h-8 w-48 pr-8 text-xs"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') setSharePassword(); }}
              />
              <button
                type="button"
                onClick={() => setShowSharePwd(!showSharePwd)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSharePwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button size="sm" className="h-8 text-xs px-3" onClick={setSharePassword} disabled={sharePwdInput.trim().length > 0 && sharePwdInput.trim().length < 4}>
              Save
            </Button>
            {hasSharePwd && (
              <Button variant="outline" size="sm" className="h-8 text-xs px-3 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={removeSharePassword}>
                Remove
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setEditingSharePwd(false); setSharePwdInput(''); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1">
            {hasSharePwd ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" />
                Shared with password
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/50">Not shared — visible only to you</span>
            )}
            <Button
              variant={hasSharePwd ? 'outline' : 'default'}
              size="sm"
              className="h-7 text-xs px-3 gap-1.5"
              onClick={() => { setEditingSharePwd(true); setSharePwdInput(selected.share_password || ''); }}
            >
              <Lock className="h-3 w-3" />
              {hasSharePwd ? 'Change password' : 'Enable sharing'}
            </Button>
          </div>
        )}
      </div>
      <EnvTable />
    </div>
  );
}
