'use client';

import { useCallback, useRef } from 'react';

const STORAGE_KEY = 'enveil_clipboard_timeout';

async function writeClipboard(text: string) {
  try {
    const { writeText } = await import('@tauri-apps/api/clipboard');
    await writeText(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}

export function useClipboardTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyWithTimeout = useCallback(async (text: string) => {
    const timeoutSec = parseInt(
      typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY) ?? '0'
        : '0',
      10,
    );

    await writeClipboard(text);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (timeoutSec > 0) {
      timerRef.current = setTimeout(() => {
        writeClipboard(' ');
      }, timeoutSec * 1000);
    }
  }, []);

  const cancelAutoClear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { copyWithTimeout, cancelAutoClear };
}

export function getClipboardTimeout(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
}

export function setClipboardTimeout(seconds: number) {
  localStorage.setItem(STORAGE_KEY, String(seconds));
}
