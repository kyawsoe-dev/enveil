'use client';

import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldAlert, Plus, Unlock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVault } from './VaultProvider';
import { AppBrand } from './AppBrand';
import { APP_VERSION } from '@/lib/brand';
import * as tauri from '@/lib/tauri';

type Mode = 'unlock' | 'create';

export default function MasterAuth() {
  const { unlock, createVault, state } = useVault();
  const [mode, setMode] = useState<Mode>('unlock');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tauri.vaultExists().then(setHasVault);
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!password.trim()) return;

      if (mode === 'create') {
        if (password.length < 8) {
          setLocalError('Password must be at least 8 characters');
          return;
        }
        if (password !== confirmPassword) {
          setLocalError('Passwords do not match');
          return;
        }
        if (hasVault === true && !confirmOverride) {
          setLocalError('A vault already exists. Creating a new one will permanently erase it. Toggle the override warning below to confirm.');
          return;
        }
      }

      setIsSubmitting(true);
      setLocalError('');

      try {
        if (mode === 'create') {
          await createVault(password);
        } else {
          await unlock(password);
        }
      } catch (err) {
        const msg = String(err);
        if (msg.toLowerCase().includes('not initialized')) {
          setMode('create');
          setLocalError('No vault found. Set a master password to create one.');
        } else {
          setLocalError(msg);
          setPassword('');
          setConfirmPassword('');
          inputRef.current?.focus();
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [mode, password, confirmPassword, unlock, createVault, hasVault, confirmOverride],
  );

  const switchMode = () => {
    setMode(mode === 'unlock' ? 'create' : 'unlock');
    setLocalError('');
    setPassword('');
    setConfirmPassword('');
    setConfirmOverride(false);
  };

  const isCreate = mode === 'create';

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-[400px] rounded-xl border bg-card p-8 shadow-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-5 text-center">
          <AppBrand
            variant="full"
            context="auth"
            logoClassName="h-36 w-36 sm:h-40 sm:w-40"
            showText={false}
          />
          <div className="space-y-1">
            <h1 className="text-base font-medium text-foreground">
              {isCreate ? 'Create your vault' : 'Welcome back'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isCreate
                ? 'Set a master password to encrypt your secrets'
                : 'Enter your master password to unlock'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              placeholder="Master password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 pr-10 font-mono text-sm"
              autoFocus
              disabled={isSubmitting}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {isCreate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
            >
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 font-mono text-sm"
                disabled={isSubmitting}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
              />
            </motion.div>
          )}

          {isCreate && hasVault === true && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  A vault already exists. Creating a new one will permanently erase the existing vault and all its data.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmOverride}
                  onChange={(e) => setConfirmOverride(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-xs text-muted-foreground">I understand, erase existing vault</span>
              </label>
            </motion.div>
          )}

          {(localError || state.error) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive dark:text-destructive-foreground"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>{localError || state.error}</span>
            </motion.div>
          )}

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={isSubmitting || !password.trim() || (isCreate && password !== confirmPassword) || (isCreate && hasVault === true && !confirmOverride)}
          >
            {isSubmitting ? (
              'Processing...'
            ) : isCreate ? (
              <>
                <Plus className="h-4 w-4" />
                Create Vault
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4" />
                Unlock Vault
              </>
            )}
          </Button>
        </form>

        {(isCreate || hasVault === false) && (
          <div className="mt-5 text-center">
            <button
              onClick={switchMode}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
            >
              {isCreate
                ? 'Already have a vault? Unlock instead'
                : 'No vault yet? Create one'}
            </button>
          </div>
        )}
        <p className="mt-5 text-center text-[10px] text-muted-foreground/40">
          v{APP_VERSION}
        </p>
      </motion.div>
    </div>
  );
}
