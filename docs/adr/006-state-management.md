# ADR-006: React Context + useReducer for State Management

**Status:** Accepted  
**Date:** 2026  
**Deciders:** Kyaw Soe

## Context

ENVEIL's frontend needs to manage complex state: vault lock/unlock, project selection, diff results, terminal output, AI chat, and view routing. This state must be shared across many components without prop drilling.

## Decision

Use **React Context** (`VaultProvider`) with **useReducer** for state management instead of Redux, Zustand, or Jotai.

### State Shape

```typescript
interface VaultState {
  isUnlocked: boolean;
  vault: Vault | null;
  selectedProjectId: string | null;
  activeView: AppView;           // 'dashboard' | 'project' | 'diff' | 'terminal' | 'lan'
  diffResult: DiffResult | null;
  fileDiffResult: DiffResult | null;
  isLoading: boolean;
  error: string | null;
  pendingTerminalCommand: string | null;
  terminalClearKey: number;       // forces TerminalRunner re-mount
}
```

### 15 Action Types

`UNLOCK_START`, `UNLOCK_SUCCESS`, `LOCK`, `SET_VAULT`, `SELECT_PROJECT`, `SET_VIEW`, `SET_DIFF`, `SET_DIFF_RESULT`, `SET_FILE_DIFF`, `CLEAR_FILE_DIFF`, `CLEAR_DIFF`, `SET_ERROR`, `SET_LOADING`, `SET_TERMINAL_CMD`, `CLEAR_TERMINAL`

### Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Redux Toolkit** | Mature, DevTools, middleware | Overkill for this app size, boilerplate |
| **Zustand** | Minimal API, no providers | Less structured, no reducer pattern |
| **Jotai** | Atomic state, fine-grained | harder to trace state flow for debugging |
| **React Context + useReducer** | Built-in, no deps, structured | No DevTools, performance can degrade with high-frequency updates |
| **URL state (Next.js router)** | Shareable state | Doesn't work for vault lock/unlock state |

## Consequences

- **Positive:** Zero additional dependencies, reducer pattern makes state transitions predictable and testable, single provider wraps entire app
- **Negative:** No Redux DevTools for time-travel debugging, context re-renders all consumers on any state change (mitigated by splitting contexts)
- **Neutral:** `passwordRef` (useRef) stores master password outside React state — avoids re-renders on every keystroke, cleared on lock

## References

- `desktop/src/components/VaultProvider.tsx` — reducer, context, 15 actions
- `desktop/src/components/Sidebar.tsx` — consumes context for navigation
- `desktop/src/components/Dashboard.tsx` — consumes context for analytics
- `desktop/src/__tests__/reducer.test.ts` — 18 reducer unit tests
