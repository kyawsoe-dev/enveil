import { describe, it, expect } from 'vitest';

function generateDuplicateName(originalName: string, existingNames: string[]): string {
  const prefix = originalName.replace(/\s*\(copy(?: \d+)?\)$/, '').trim();
  const esc = prefix.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
  const existing = existingNames
    .filter((n) => {
      const m = n.match(new RegExp(`^${esc}\\s+\\(copy(?: (\\d+))?\\)$`));
      return m !== null;
    })
    .map((n) => {
      const m = n.match(new RegExp(`^${esc}\\s+\\(copy(?: (\\d+))?\\)$`));
      return m?.[1] ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n >= 0);
  const nextNum = existing.length === 0 ? -1 : Math.max(...existing) + 1;
  const suffix = nextNum === -1 ? '(copy)' : `(copy ${nextNum})`;
  return `${prefix} ${suffix}`;
}

describe('generateDuplicateName', () => {
  it('first copy adds (copy)', () => {
    expect(generateDuplicateName('My Project', [])).toBe('My Project (copy)');
  });

  it('second copy appends (copy 1)', () => {
    expect(generateDuplicateName('My Project', ['My Project (copy)'])).toBe('My Project (copy 1)');
  });

  it('third copy appends (copy 2)', () => {
    expect(generateDuplicateName('My Project', ['My Project (copy)', 'My Project (copy 1)'])).toBe('My Project (copy 2)');
  });

  it('skips gaps in copy numbers', () => {
    const names = ['My Project (copy)', 'My Project (copy 3)'];
    expect(generateDuplicateName('My Project', names)).toBe('My Project (copy 4)');
  });

  it('does not count unrelated projects', () => {
    expect(generateDuplicateName('My Project', ['Other Project (copy)'])).toBe('My Project (copy)');
  });

  it('strips existing (copy) from name before generating', () => {
    expect(generateDuplicateName('My Project (copy)', ['My Project (copy)'])).toBe('My Project (copy 1)');
  });

  it('strips existing (copy N) from name before generating', () => {
    expect(generateDuplicateName('My Project (copy 2)', ['My Project (copy 2)'])).toBe('My Project (copy 3)');
  });

  it('handles special regex chars in project name', () => {
    const name = 'api.dev (v2.1)';
    expect(generateDuplicateName(name, [])).toBe('api.dev (v2.1) (copy)');
  });
});
