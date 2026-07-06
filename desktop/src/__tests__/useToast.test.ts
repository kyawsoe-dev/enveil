import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '@/hooks/use-toast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('adds a toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Hello', description: 'world' });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Hello');
    expect(result.current.toasts[0].description).toBe('world');
  });

  it('generates unique IDs', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'A' });
    });
    act(() => {
      result.current.toast({ title: 'B' });
    });
    expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
  });

  it('auto-dismisses after 4 seconds', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Test' });
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('dismiss removes a toast by ID', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Test' });
    });
    const toastId = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(toastId);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('dismiss only removes matching toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'A' });
      result.current.toast({ title: 'B' });
    });
    const idA = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(idA);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('B');
  });

  it('supports variant property', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Error', variant: 'destructive' });
    });
    expect(result.current.toasts[0].variant).toBe('destructive');
  });
});
