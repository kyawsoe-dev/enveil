import { describe, it, expect, beforeEach } from 'vitest';
import { getClipboardTimeout, setClipboardTimeout } from '@/hooks/use-clipboard-timeout';

describe('getClipboardTimeout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns 0 when nothing stored', () => {
    expect(getClipboardTimeout()).toBe(0);
  });

  it('returns stored value', () => {
    localStorage.setItem('enveil_clipboard_timeout', '30');
    expect(getClipboardTimeout()).toBe(30);
  });

  it('returns NaN for non-numeric stored value', () => {
    localStorage.setItem('enveil_clipboard_timeout', 'abc');
    expect(getClipboardTimeout()).toBeNaN();
  });
});

describe('setClipboardTimeout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores timeout value', () => {
    setClipboardTimeout(60);
    expect(localStorage.getItem('enveil_clipboard_timeout')).toBe('60');
  });

  it('overwrites previous value', () => {
    setClipboardTimeout(30);
    setClipboardTimeout(0);
    expect(localStorage.getItem('enveil_clipboard_timeout')).toBe('0');
  });
});
