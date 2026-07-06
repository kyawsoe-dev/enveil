import { describe, it, expect } from 'vitest';

interface VaultState {
  isUnlocked: boolean;
  vault: null | { projects: { id: string; name: string }[] };
  selectedProjectId: string | null;
  activeView: string;
  diffResult: null | object;
  diffProjectIds: [string, string] | null;
  fileDiffResult: null | object;
  fileDiffProjectId: string | null;
  fileDiffFilePath: string | null;
  isLoading: boolean;
  error: string | null;
  pendingTerminalCommand: string | null;
  terminalClearKey: number;
}

type Action =
  | { type: 'UNLOCK_START' }
  | { type: 'UNLOCK_SUCCESS'; vault: VaultState['vault'] }
  | { type: 'LOCK' }
  | { type: 'SET_VAULT'; vault: VaultState['vault'] }
  | { type: 'SELECT_PROJECT'; id: string | null }
  | { type: 'SET_VIEW'; view: string }
  | { type: 'SET_DIFF'; a: string; b: string }
  | { type: 'SET_DIFF_RESULT'; result: object }
  | { type: 'SET_FILE_DIFF'; result: object; projectId: string; filePath: string }
  | { type: 'CLEAR_FILE_DIFF' }
  | { type: 'CLEAR_DIFF' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_TERMINAL_CMD'; command: string | null }
  | { type: 'CLEAR_TERMINAL' };

const initialState: VaultState = {
  isUnlocked: false,
  vault: null,
  selectedProjectId: null,
  activeView: 'dashboard',
  diffResult: null,
  diffProjectIds: null,
  fileDiffResult: null,
  fileDiffProjectId: null,
  fileDiffFilePath: null,
  isLoading: false,
  error: null,
  pendingTerminalCommand: null,
  terminalClearKey: 0,
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
        isLoading: false,
        error: null,
        selectedProjectId: null,
        pendingTerminalCommand: null,
        terminalClearKey: state.terminalClearKey + 1,
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
    case 'SET_FILE_DIFF':
      return { ...state, fileDiffResult: action.result, fileDiffProjectId: action.projectId, fileDiffFilePath: action.filePath };
    case 'CLEAR_FILE_DIFF':
      return { ...state, fileDiffResult: null, fileDiffProjectId: null, fileDiffFilePath: null };
    case 'CLEAR_DIFF':
      return { ...state, diffProjectIds: null, diffResult: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_TERMINAL_CMD':
      return { ...state, pendingTerminalCommand: action.command };
    case 'CLEAR_TERMINAL':
      return { ...state, terminalClearKey: state.terminalClearKey + 1, pendingTerminalCommand: null };
    default:
      return state;
  }
}

describe('vault reducer', () => {
  it('starts with initial state', () => {
    expect(reducer(initialState, { type: 'UNLOCK_START' })).toMatchObject({
      isLoading: true,
      error: null,
    });
  });

  it('UNLOCK_START sets isLoading true and clears error', () => {
    const state = reducer({ ...initialState, error: 'old error' }, { type: 'UNLOCK_START' });
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('UNLOCK_SUCCESS sets vault, clears loading/error, increments terminalClearKey', () => {
    const vault = { projects: [{ id: '1', name: 'Test' }] };
    const prev = { ...initialState, isLoading: true, terminalClearKey: 5 };
    const next = reducer(prev, { type: 'UNLOCK_SUCCESS', vault });
    expect(next.isUnlocked).toBe(true);
    expect(next.vault).toEqual(vault);
    expect(next.isLoading).toBe(false);
    expect(next.error).toBeNull();
    expect(next.selectedProjectId).toBeNull();
    expect(next.terminalClearKey).toBe(6);
  });

  it('LOCK resets to initial state', () => {
    const state = reducer({ ...initialState, isUnlocked: true, vault: { projects: [] } }, { type: 'LOCK' });
    expect(state).toEqual(initialState);
  });

  it('SET_VAULT updates vault', () => {
    const vault = { projects: [{ id: '2', name: 'B' }] };
    const next = reducer(initialState, { type: 'SET_VAULT', vault });
    expect(next.vault).toEqual(vault);
  });

  it('SELECT_PROJECT sets selectedProjectId', () => {
    const next = reducer(initialState, { type: 'SELECT_PROJECT', id: 'abc' });
    expect(next.selectedProjectId).toBe('abc');
  });

  it('SELECT_PROJECT with null deselects', () => {
    const prev = { ...initialState, selectedProjectId: 'abc' };
    const next = reducer(prev, { type: 'SELECT_PROJECT', id: null });
    expect(next.selectedProjectId).toBeNull();
  });

  it('SET_VIEW changes activeView', () => {
    const next = reducer(initialState, { type: 'SET_VIEW', view: 'settings' });
    expect(next.activeView).toBe('settings');
  });

  it('SET_DIFF sets diffProjectIds and clears diffResult', () => {
    const prev = { ...initialState, diffResult: { old: true } };
    const next = reducer(prev, { type: 'SET_DIFF', a: 'x', b: 'y' });
    expect(next.diffProjectIds).toEqual(['x', 'y']);
    expect(next.diffResult).toBeNull();
  });

  it('SET_DIFF_RESULT sets diffResult', () => {
    const result = { added: [], removed: [] };
    const next = reducer(initialState, { type: 'SET_DIFF_RESULT', result });
    expect(next.diffResult).toEqual(result);
  });

  it('SET_FILE_DIFF sets file diff fields', () => {
    const result = { added: [], removed: [] };
    const next = reducer(initialState, { type: 'SET_FILE_DIFF', result, projectId: 'p1', filePath: '/a/b.txt' });
    expect(next.fileDiffResult).toEqual(result);
    expect(next.fileDiffProjectId).toBe('p1');
    expect(next.fileDiffFilePath).toBe('/a/b.txt');
  });

  it('CLEAR_FILE_DIFF nulls file diff fields', () => {
    const prev = { ...initialState, fileDiffResult: { x: 1 }, fileDiffProjectId: 'p1', fileDiffFilePath: '/f' };
    const next = reducer(prev, { type: 'CLEAR_FILE_DIFF' });
    expect(next.fileDiffResult).toBeNull();
    expect(next.fileDiffProjectId).toBeNull();
    expect(next.fileDiffFilePath).toBeNull();
  });

  it('CLEAR_DIFF nulls diffProjectIds and diffResult', () => {
    const prev = { ...initialState, diffProjectIds: ['a', 'b'], diffResult: { x: 1 } };
    const next = reducer(prev, { type: 'CLEAR_DIFF' });
    expect(next.diffProjectIds).toBeNull();
    expect(next.diffResult).toBeNull();
  });

  it('SET_ERROR sets error and clears isLoading', () => {
    const prev = { ...initialState, isLoading: true };
    const next = reducer(prev, { type: 'SET_ERROR', error: 'bad' });
    expect(next.error).toBe('bad');
    expect(next.isLoading).toBe(false);
  });

  it('SET_LOADING sets isLoading', () => {
    const next = reducer(initialState, { type: 'SET_LOADING', isLoading: true });
    expect(next.isLoading).toBe(true);
  });

  it('SET_TERMINAL_CMD sets pendingTerminalCommand', () => {
    const next = reducer(initialState, { type: 'SET_TERMINAL_CMD', command: 'ls' });
    expect(next.pendingTerminalCommand).toBe('ls');
  });

  it('CLEAR_TERMINAL clears pendingTerminalCommand and increments terminalClearKey', () => {
    const prev = { ...initialState, pendingTerminalCommand: 'ls', terminalClearKey: 3 };
    const next = reducer(prev, { type: 'CLEAR_TERMINAL' });
    expect(next.pendingTerminalCommand).toBeNull();
    expect(next.terminalClearKey).toBe(4);
  });

  it('unknown action returns state unchanged', () => {
    const state = reducer(initialState, { type: 'UNKNOWN_ACTION' } as unknown as Action);
    expect(state).toBe(initialState);
  });
});
