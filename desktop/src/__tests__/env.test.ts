import { describe, it, expect } from 'vitest';
import { parseEnvContent } from '@/lib/env';

describe('parseEnvContent', () => {
  it('parses simple KEY=VALUE pairs', () => {
    expect(parseEnvContent('A=1\nB=2')).toEqual({ A: '1', B: '2' });
  });

  it('strips surrounding whitespace', () => {
    expect(parseEnvContent('  A = 1  \n  B = 2  ')).toEqual({ A: '1', B: '2' });
  });

  it('skips empty lines', () => {
    expect(parseEnvContent('A=1\n\n\nB=2')).toEqual({ A: '1', B: '2' });
  });

  it('skips comment lines starting with #', () => {
    expect(parseEnvContent('# comment\nA=1\n# another\nB=2')).toEqual({ A: '1', B: '2' });
  });

  it('handles inline comments', () => {
    expect(parseEnvContent('A=1 # inline comment')).toEqual({ A: '1 # inline comment' });
  });

  it('skips lines without =', () => {
    expect(parseEnvContent('A=1\nBADCNOEQUAL\nC=3')).toEqual({ A: '1', C: '3' });
  });

  it('handles values containing =', () => {
    expect(parseEnvContent('A=base64==data')).toEqual({ A: 'base64==data' });
  });

  it('handles quoted values', () => {
    expect(parseEnvContent('A="hello world"')).toEqual({ A: '"hello world"' });
  });

  it('returns empty object for empty string', () => {
    expect(parseEnvContent('')).toEqual({});
  });

  it('returns empty object for comments only', () => {
    expect(parseEnvContent('# just\n# comments')).toEqual({});
  });

  it('handles a single key=value', () => {
    expect(parseEnvContent('KEY=value')).toEqual({ KEY: 'value' });
  });
});
