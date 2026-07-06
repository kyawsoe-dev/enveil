import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDailyRemaining, getAiModel, setAiModel } from '@/lib/ai';

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('AI rate limiting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getDailyRemaining returns 100 when no requests made', () => {
    expect(getDailyRemaining()).toBe(100);
  });

  it('getDailyRemaining decrements after localStorage increment', () => {
    const key = todayKey();
    localStorage.setItem(key, '3');
    expect(getDailyRemaining()).toBe(97);
  });

  it('getDailyRemaining returns 0 when limit reached', () => {
    const key = todayKey();
    localStorage.setItem(key, '100');
    expect(getDailyRemaining()).toBe(0);
  });

  it('getDailyRemaining returns 0 when over limit', () => {
    const key = todayKey();
    localStorage.setItem(key, '150');
    expect(getDailyRemaining()).toBe(0);
  });
});

describe('AI model get/set', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getAiModel returns default model', () => {
    expect(getAiModel()).toBe('openai/gpt-4o-mini');
  });

  it('getAiModel returns stored model', () => {
    localStorage.setItem('enveil_ai_model', 'anthropic/claude-3');
    expect(getAiModel()).toBe('anthropic/claude-3');
  });

  it('setAiModel stores model', () => {
    setAiModel('openai/gpt-4o');
    expect(localStorage.getItem('enveil_ai_model')).toBe('openai/gpt-4o');
  });

  it('setAiModel overwrites previous model', () => {
    setAiModel('openai/gpt-4o');
    setAiModel('anthropic/claude-3');
    expect(localStorage.getItem('enveil_ai_model')).toBe('anthropic/claude-3');
  });
});

function todayKey(): string {
  const d = new Date();
  return `enveil_ai_requests_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
