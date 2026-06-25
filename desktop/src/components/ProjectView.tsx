'use client';

import { useState, useEffect } from 'react';
import { useVault } from './VaultProvider';
import { Key, Lock, Unlock, Eye, EyeOff, FileText, Trash2, RefreshCw, ExternalLink, Loader2, ChevronDown, FolderOpen, GitCompare, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EnvTable from './EnvTable';
import * as tauri from '@/lib/tauri';

export default function ProjectView() {
  const { state, saveProject, runFileDiff } = useVault();
  const selected = state.vault?.projects.find((p) => p.id === state.selectedProjectId);
  const [editingSharePwd, setEditingSharePwd] = useState(false);
  const [sharePwdInput, setSharePwdInput] = useState('');
  const [showSharePwd, setShowSharePwd] = useState(false);
  const [tempEnvPath, setTempEnvPath] = useState<string | null>(null);
  const [symlinkPath, setSymlinkPath] = useState<string | null>(null);
  const [loadingTempEnv, setLoadingTempEnv] = useState(false);
  const [envSuffix, setEnvSuffix] = useState('');
  const [generatingExample, setGeneratingExample] = useState(false);

  const handleOpenFolder = async () => {
    if (!symlinkPath) return;
    const parent = symlinkPath.replace(/[\\/]+$/, '').split(/[\\/]/).slice(0, -1).join('/');
    if (!parent) return;
    try {
      await tauri.openFolder(parent);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  const handleOpenInTerminal = async () => {
    if (!symlinkPath) return;
    const parent = symlinkPath.replace(/[\\/]+$/, '').split(/[\\/]/).slice(0, -1).join('/');
    if (!parent) return;
    try {
      await tauri.openInTerminal(parent);
    } catch (err) {
      console.error('Failed to open terminal:', err);
    }
  };

  useEffect(() => {
    setTempEnvPath(null);
    setSymlinkPath(null);
    setEnvSuffix('');
    if (!selected) return;
    tauri.getTempEnvStatus(selected.id).then((status) => {
      if (status) {
        setTempEnvPath(status.temp_path);
        setSymlinkPath(status.symlink_path);
      } else {
        const saved = localStorage.getItem(`enveil_symlink_${selected.id}`);
        if (saved) setSymlinkPath(saved);
      }
    }).catch(() => {});
  }, [selected?.id]);

  const envVarsKey = JSON.stringify(selected?.env_vars ?? {});
  useEffect(() => {
    if (!selected || !tempEnvPath) return;
    const timer = setTimeout(() => {
      tauri.regenerateTempEnv(selected.id).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [envVarsKey, selected?.id, tempEnvPath]);

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

  const handleGenerateTempEnv = async (suffix?: string) => {
    if (!selected) return;
    setLoadingTempEnv(true);
    try {
      const s = suffix ?? envSuffix;
      if (symlinkPath && !suffix) {
        await tauri.generateTempEnv(selected.id, symlinkPath);
        const status = await tauri.getTempEnvStatus(selected.id);
        if (status) setTempEnvPath(status.temp_path);
        return;
      }
      const { open } = await import('@tauri-apps/api/dialog');
      const selectedDir = await open({
        title: 'Select your project folder for the .env symlink',
        directory: true,
        multiple: false,
      });
      if (!selectedDir) { setLoadingTempEnv(false); return; }
      const dirPath = String(selectedDir);
      const baseName = s ? `.env.${s}` : '.env';
      const envPath = dirPath.endsWith('/') ? `${dirPath}${baseName}` : `${dirPath}/${baseName}`;
      const path = await tauri.generateTempEnv(selected.id, envPath);
      localStorage.setItem(`enveil_symlink_${selected.id}`, envPath);
      setTempEnvPath(path);
      setSymlinkPath(envPath);
    } catch (err) {
      console.error('Failed to generate temp .env:', err);
    } finally {
      setLoadingTempEnv(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selected) return;
    setLoadingTempEnv(true);
    try {
      await tauri.regenerateTempEnv(selected.id);
    } catch (err) {
      console.error('Failed to regenerate:', err);
    } finally {
      setLoadingTempEnv(false);
    }
  };

  const handleDeleteTempEnv = async () => {
    if (!selected) return;
    try {
      await tauri.deleteTempEnv(selected.id);
      localStorage.removeItem(`enveil_symlink_${selected.id}`);
      setTempEnvPath(null);
      setSymlinkPath(null);
    } catch (err) {
      console.error('Failed to delete temp .env:', err);
    }
  };

  const handleGenerateExample = async () => {
    if (!selected) return;
    setGeneratingExample(true);
    try {
      const content = await tauri.generateEnvExample(selected.id);
      const { save } = await import('@tauri-apps/api/dialog');
      const path = await save({
        defaultPath: `.env.example`,
        filters: [{ name: 'Env Example', extensions: ['example'] }],
      });
      if (path) {
        await tauri.generateEnvExample(selected.id, path);
      }
    } catch (err) {
      console.error('Failed to generate .env.example:', err);
    } finally {
      setGeneratingExample(false);
    }
  };

  const handleDiffWithFile = async () => {
    if (!selected) return;
    try {
      const { open } = await import('@tauri-apps/api/dialog');
      const file = await open({
        title: 'Select .env file to diff',
        multiple: false,
        filters: [{ name: 'Env Files', extensions: ['env', 'example'] }],
      });
      if (!file) return;
      const filePath = String(file);
      await runFileDiff(selected.id, filePath);
    } catch (err) {
      console.error('Failed to diff with file:', err);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-4 border-b bg-muted/30 px-6 py-2">
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

      <div className="flex items-center gap-4 border-b bg-muted/30 px-6 py-2">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="group relative">
          <span className="text-xs font-medium text-muted-foreground cursor-default rounded-sm py-0.5 transition-colors hover:bg-muted">
            Generate Temporary .env
          </span>
          <div className="pointer-events-none invisible group-hover:visible absolute bottom-0 left-0 z-50 mb-0.5 w-72 translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
            ENVEIL writes your project's env vars to a temporary file (secure, 600 permissions) and creates a symlink in your project folder. The temp file is auto-updated when you edit vars, and deleted on vault lock.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1">
          {tempEnvPath ? (
            <>
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  Linked
                </span>
                {symlinkPath && (
                  <code className="inline-flex items-center text-[10px] text-muted-foreground truncate max-w-[240px] cursor-default rounded-sm px-1 py-0.5 transition-colors hover:bg-muted" title={symlinkPath}>
                    {symlinkPath.split('/').slice(-2).join('/')}
                  </code>
                )}
              </div>
              <div className="group relative">
                <button
                  onClick={handleRegenerate}
                  disabled={loadingTempEnv}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  {loadingTempEnv ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerate
                </button>
                <div className="pointer-events-none invisible group-hover:visible absolute bottom-0 left-1/2 z-50 mb-0.5 w-56 -translate-x-1/2 translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  Re-writes the temp .env file with the latest vault data.
                </div>
              </div>
              {symlinkPath && (
                <>
                  <div className="group relative">
                    <button
                      onClick={handleOpenFolder}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Finder
                    </button>
                    <div className="pointer-events-none invisible group-hover:visible absolute bottom-0 left-1/2 z-50 mb-0.5 w-44 -translate-x-1/2 translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                      Open project folder in Finder
                    </div>
                  </div>
                  <div className="group relative">
                    <button
                      onClick={handleOpenInTerminal}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      Terminal
                    </button>
                    <div className="pointer-events-none invisible group-hover:visible absolute bottom-0 left-1/2 z-50 mb-0.5 w-44 -translate-x-1/2 translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                      Open project folder in Terminal
                    </div>
                  </div>
                </>
              )}
              <div className="group relative">
                <button
                  onClick={handleDeleteTempEnv}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" />
                  Unlink
                </button>
                <div className="pointer-events-none invisible group-hover:visible absolute bottom-0 left-1/2 z-50 mb-0.5 w-44 -translate-x-1/2 translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  Remove the temp file and symlink
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-1">
                <div className="relative">
                    <select
                    value={envSuffix}
                    onChange={(e) => setEnvSuffix(e.target.value)}
                    disabled={Object.keys(selected?.env_vars ?? {}).length === 0}
                    className="h-7 w-36 appearance-none rounded border border-border bg-background px-2 pr-7 text-[10px] font-medium text-foreground transition-all duration-150 hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <option value="">.env</option>
                    <option value="development">.env.development</option>
                    <option value="staging">.env.staging</option>
                    <option value="production">.env.production</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                </div>
                <Input
                  value={envSuffix}
                  onChange={(e) => setEnvSuffix(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase())}
                  placeholder="custom"
                  className="h-7 w-36 text-xs"
                  disabled={Object.keys(selected?.env_vars ?? {}).length === 0}
                />
                <span className="text-[10px] text-muted-foreground/60 font-mono">
                  .env{envSuffix ? `.${envSuffix}` : ''}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="group relative">
                  <Button variant="outline" size="sm" className="h-7 text-xs px-3 gap-1.5" onClick={() => handleGenerateTempEnv()} disabled={loadingTempEnv || Object.keys(selected?.env_vars ?? {}).length === 0}>
                    {loadingTempEnv ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                    Generate &amp; Link
                  </Button>
                  <div className="pointer-events-none invisible group-hover:visible absolute bottom-0 left-1/2 z-50 mb-0.5 w-56 -translate-x-1/2 translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    Generates a secure temp .env file with a symlink in your chosen project folder.
                  </div>
                </div>
                <div className="w-px h-6 bg-border mx-1" />
                <div className="group relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 gap-1.5"
                    onClick={() => handleGenerateExample()}
                    disabled={generatingExample || Object.keys(selected?.env_vars ?? {}).length === 0}
                  >
                    {generatingExample ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    Generate .env.example
                  </Button>
                  <div className="pointer-events-none invisible group-hover:visible absolute bottom-0 left-1/2 z-50 mb-0.5 w-56 -translate-x-1/2 translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    Generate .env.example (key=key) then save.
                  </div>
                </div>
                <div className="w-px h-6 bg-border mx-1" />
                <div className="group relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3 gap-1.5"
                    onClick={handleDiffWithFile}
                    disabled={Object.keys(selected?.env_vars ?? {}).length === 0}
                  >
                    <GitCompare className="h-3 w-3" />
                    Compare with .env File
                  </Button>
                  <div className="pointer-events-none invisible group-hover:visible absolute bottom-0 left-1/2 z-50 mb-0.5 w-56 -translate-x-1/2 translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    Compare vault variables against a .env file on your machine.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <EnvTable />
    </div>
  );
}
