'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { AppView, DiffResult, Project, Vault } from '@/lib/types';
import * as tauri from '@/lib/tauri';

interface VaultState {
  isUnlocked: boolean;
  vault: Vault | null;
  password: string;
  selectedProjectId: string | null;
  activeView: AppView;
  diffResult: DiffResult | null;
  diffProjectIds: [string, string] | null;
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: 'UNLOCK_START' }
  | { type: 'UNLOCK_SUCCESS'; vault: Vault; password: string }
  | { type: 'LOCK' }
  | { type: 'SET_VAULT'; vault: Vault }
  | { type: 'SELECT_PROJECT'; id: string | null }
  | { type: 'SET_VIEW'; view: AppView }
  | { type: 'SET_DIFF'; a: string; b: string }
  | { type: 'SET_DIFF_RESULT'; result: DiffResult }
  | { type: 'CLEAR_DIFF' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_LOADING'; isLoading: boolean };

const initialState: VaultState = {
  isUnlocked: false,
  vault: null,
  password: '',
  selectedProjectId: null,
  activeView: 'dashboard',
  diffResult: null,
  diffProjectIds: null,
  isLoading: false,
  error: null,
};

function reducer(state: VaultState, action: Action): VaultState {
  switch (action.type) {
    case 'UNLOCK_START':
      return { ...state, isLoading: true, error: null };
    case 'UNLOCK_SUCCESS':
      return {
        ...state,
        isUnlocked: true,
        vault: action.vault,
        password: action.password,
        isLoading: false,
        error: null,
        selectedProjectId: null,
      };
    case 'LOCK':
      return { ...initialState };
    case 'SET_VAULT':
      return { ...state, vault: action.vault };
    case 'SELECT_PROJECT':
      return { ...state, selectedProjectId: action.id };
    case 'SET_VIEW':
      return { ...state, activeView: action.view };
    case 'SET_DIFF':
      return { ...state, diffProjectIds: [action.a, action.b], diffResult: null };
    case 'SET_DIFF_RESULT':
      return { ...state, diffResult: action.result };
    case 'CLEAR_DIFF':
      return { ...state, diffProjectIds: null, diffResult: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    default:
      return state;
  }
}

interface VaultContextValue {
  state: VaultState;
  unlock: (password: string) => Promise<void>;
  createVault: (password: string) => Promise<void>;
  lock: () => void;
  resetVault: () => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  duplicateProject: (project: Project) => Promise<void>;
  selectProject: (id: string | null) => void;
  setView: (view: AppView) => void;
  runDiff: (a: string, b: string) => Promise<void>;
  autoLockTimeout: string;
  changeAutoLockTimeout: (timeout: string) => void;
  refreshVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const [autoLockTimeout, setAutoLockTimeout] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('enveil_auto_lock_timeout') || 'never';
    }
    return 'never';
  });

  const changeAutoLockTimeout = useCallback((timeout: string) => {
    setAutoLockTimeout(timeout);
    localStorage.setItem('enveil_auto_lock_timeout', timeout);
  }, []);

  const lock = useCallback(() => {
    tauri.cleanupAllTempEnvs().catch(() => {});
    dispatch({ type: 'LOCK' });
  }, []);

  useEffect(() => {
    if (!state.isUnlocked || autoLockTimeout === 'never') return;

    const timeoutMinutes = parseInt(autoLockTimeout, 10);
    if (isNaN(timeoutMinutes) || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lock();
      }, timeoutMs);
    };

    resetTimer();

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      clearTimeout(timer);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [state.isUnlocked, autoLockTimeout, lock]);

  const unlock = useCallback(async (password: string) => {
    dispatch({ type: 'UNLOCK_START' });
    try {
      const vault = await tauri.unlockVault(password);
      dispatch({ type: 'UNLOCK_SUCCESS', vault, password });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
      throw err;
    }
  }, []);

  const createVault = useCallback(async (password: string) => {
    dispatch({ type: 'UNLOCK_START' });
    try {
      await tauri.initializeVault(password);
      const vault = await tauri.unlockVault(password);
      dispatch({ type: 'UNLOCK_SUCCESS', vault, password });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
      throw err;
    }
  }, []);

  const resetVault = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      await tauri.resetVault();
      await tauri.cleanupAllTempEnvs();
      try { await import('@/lib/lan').then(m => m.stopLanSync()); } catch {}
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
      return;
    }
    // Clear all persisted local state
    localStorage.removeItem('enveil_device_name');
    localStorage.removeItem('enveil_auto_lock_timeout');
    dispatch({ type: 'LOCK' });
  }, []);

  const saveProject = useCallback(
    async (project: Project) => {
      if (!state.password) return;
      dispatch({ type: 'SET_LOADING', isLoading: true });
      try {
        await tauri.saveProject(state.password, project);
        if (state.vault) {
          const updated: Vault = {
            ...state.vault,
            projects: state.vault.projects.map((p) => (p.id === project.id ? project : p)),
          };
          if (!state.vault.projects.find((p) => p.id === project.id)) {
            updated.projects = [...updated.projects, project];
          }
          dispatch({ type: 'SET_VAULT', vault: updated });
        }
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: String(err) });
      } finally {
        dispatch({ type: 'SET_LOADING', isLoading: false });
      }
    },
    [state.password, state.vault],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!state.password) return;
      dispatch({ type: 'SET_LOADING', isLoading: true });
      try {
        await tauri.deleteProject(state.password, projectId);
        if (state.vault) {
          const updated: Vault = {
            ...state.vault,
            projects: state.vault.projects.filter((p) => p.id !== projectId),
          };
          dispatch({ type: 'SET_VAULT', vault: updated });
          if (state.selectedProjectId === projectId) {
            dispatch({ type: 'SELECT_PROJECT', id: null });
          }
        }
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: String(err) });
      } finally {
        dispatch({ type: 'SET_LOADING', isLoading: false });
      }
    },
    [state.password, state.vault, state.selectedProjectId],
  );

  const duplicateProject = useCallback(
    async (project: Project) => {
      const prefix = project.name.replace(/\s*\(copy(?: \d+)?\)$/, '').trim();
      const esc = prefix.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
      const existing = (state.vault?.projects ?? [])
        .filter((p) => p.id !== project.id)
        .map((p) => {
          const m = p.name.match(new RegExp(`^${esc}\\s+\\(copy(?: (\\d+))?\\)$`));
          return m ? (m[1] ? parseInt(m[1], 10) : 0) : -1;
        })
        .filter((n) => n >= 0);
      const nextNum = existing.length === 0 ? -1 : Math.max(...existing) + 1;
      const suffix = nextNum === -1 ? '(copy)' : `(copy ${nextNum})`;
      const copy: Project = {
        ...project,
        id: crypto.randomUUID(),
        name: `${prefix} ${suffix}`,
        share_password: null,
      };
      await saveProject(copy);
    },
    [saveProject, state.vault?.projects],
  );

  const selectProject = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_PROJECT', id });
  }, []);

  const setView = useCallback((view: AppView) => {
    dispatch({ type: 'SET_VIEW', view });
  }, []);

  const refreshVault = useCallback(async () => {
    try {
      const vault = await tauri.getVault();
      if (vault) {
        dispatch({ type: 'SET_VAULT', vault });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
    }
  }, []);

  const runDiff = useCallback(async (a: string, b: string) => {
    dispatch({ type: 'SET_DIFF', a, b });
    try {
      const result = await tauri.diffProjects(a, b);
      dispatch({ type: 'SET_DIFF_RESULT', result });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
    }
  }, []);

  const value = useMemo(
    () => ({
      state,
      unlock,
      createVault,
      lock,
      resetVault,
      saveProject,
      deleteProject,
      duplicateProject,
      selectProject,
      setView,
      runDiff,
      autoLockTimeout,
      changeAutoLockTimeout,
      refreshVault,
    }),
    [
      state,
      unlock,
      createVault,
      lock,
      resetVault,
      saveProject,
      deleteProject,
      duplicateProject,
      selectProject,
      setView,
      runDiff,
      autoLockTimeout,
      changeAutoLockTimeout,
      refreshVault,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
}
