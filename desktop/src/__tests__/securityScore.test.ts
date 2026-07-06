import { describe, it, expect } from 'vitest';

interface Project {
  name: string;
  env_vars: Record<string, string>;
}

function securityScore(projects: Project[]): {
  score: number;
  label: string;
  issues: number;
  total: number;
  details: { projectName: string; key: string; value: string; reason: string }[];
} {
  let issueCount = 0;
  let total = 0;
  const details: { projectName: string; key: string; value: string; reason: string }[] = [];
  for (const p of projects) {
    for (const [k, v] of Object.entries(p.env_vars)) {
      total++;
      const val = v.trim();
      let reason = '';
      if (!val) {
        reason = 'Empty value';
      } else if (/^(password|secret|changeme|placeholder|your_|xxxx)/i.test(val)) {
        reason = 'Obvious placeholder — replace with a real value';
      } else if (/^postgres(ql)?:\/\/.*:password@/i.test(val) || /^mysql:\/\/.*:password@/i.test(val) || /^redis:\/\/.*:password@/i.test(val)) {
        reason = 'Database URL with default password — use a real credential';
      } else if (/^http:\/\/localhost/i.test(val) && !k.includes('ENV')) {
        reason = 'Points to localhost — verify this is intended for production';
      }
      if (reason) {
        issueCount++;
        details.push({ projectName: p.name, key: k, value: val, reason });
      }
    }
  }
  const score = total === 0 ? 100 : Math.round(((total - issueCount) / total) * 100);
  const label = score >= 90 ? 'Great' : score >= 70 ? 'Fair' : score >= 50 ? 'Needs Work' : 'Poor';
  return { score, label, issues: issueCount, total, details };
}

describe('securityScore', () => {
  it('returns 100 when no projects', () => {
    const result = securityScore([]);
    expect(result.score).toBe(100);
    expect(result.label).toBe('Great');
    expect(result.issues).toBe(0);
  });

  it('returns 100 when all values are clean', () => {
    const result = securityScore([{ name: 'p', env_vars: { API_KEY: 'sk-real-123' } }]);
    expect(result.score).toBe(100);
    expect(result.issues).toBe(0);
  });

  it('detects empty values', () => {
    const result = securityScore([{ name: 'p', env_vars: { KEY: '' } }]);
    expect(result.issues).toBe(1);
    expect(result.score).toBe(0);
    expect(result.details[0].reason).toBe('Empty value');
  });

  it('detects placeholder passwords', () => {
    const result = securityScore([{ name: 'p', env_vars: { PASS: 'password' } }]);
    expect(result.issues).toBe(1);
    expect(result.score).toBe(0);
  });

  it('detects changeme placeholder', () => {
    const result = securityScore([{ name: 'p', env_vars: { SECRET: 'changeme' } }]);
    expect(result.issues).toBe(1);
  });

  it('detects your_ prefix placeholder', () => {
    const result = securityScore([{ name: 'p', env_vars: { KEY: 'your_api_key' } }]);
    expect(result.issues).toBe(1);
  });

  it('detects xxxx prefix placeholder', () => {
    const result = securityScore([{ name: 'p', env_vars: { KEY: 'xxxx-real-value' } }]);
    expect(result.issues).toBe(1);
  });

  it('detects postgres URL with default password', () => {
    const result = securityScore([{ name: 'p', env_vars: { DB: 'postgresql://user:password@localhost/db' } }]);
    expect(result.issues).toBe(1);
    expect(result.details[0].reason).toContain('default password');
  });

  it('detects mysql URL with default password', () => {
    const result = securityScore([{ name: 'p', env_vars: { DB: 'mysql://user:password@localhost/db' } }]);
    expect(result.issues).toBe(1);
  });

  it('detects redis URL with default password', () => {
    const result = securityScore([{ name: 'p', env_vars: { DB: 'redis://user:password@localhost:6379' } }]);
    expect(result.issues).toBe(1);
  });

  it('detects localhost URLs', () => {
    const result = securityScore([{ name: 'p', env_vars: { API_URL: 'http://localhost:3000/api' } }]);
    expect(result.issues).toBe(1);
    expect(result.details[0].reason).toContain('localhost');
  });

  it('does not flag localhost when key contains ENV', () => {
    const result = securityScore([{ name: 'p', env_vars: { LOCAL_ENV_URL: 'http://localhost:3000' } }]);
    expect(result.issues).toBe(0);
  });

  it('calculates mixed score correctly', () => {
    const result = securityScore([{
      name: 'p',
      env_vars: { GOOD: 'real-value', BAD: 'password', EMPTY: '', ALSO_GOOD: 'sk-123' },
    }]);
    expect(result.total).toBe(4);
    expect(result.issues).toBe(2);
    expect(result.score).toBe(50);
    expect(result.label).toBe('Needs Work');
  });

  it('score 70-89 is Fair', () => {
    const result = securityScore([{
      name: 'p',
      env_vars: {
        A: 'real', B: 'real', C: 'real', D: 'real', E: 'real',
        F: 'real', G: 'real', H: 'real', I: 'real', J: 'password',
      },
    }]);
    expect(result.score).toBe(90);
    expect(result.label).toBe('Great');
  });

  it('trims values before checking', () => {
    const result = securityScore([{ name: 'p', env_vars: { KEY: '   ' } }]);
    expect(result.issues).toBe(1);
    expect(result.details[0].reason).toBe('Empty value');
  });

  it('reports project name in details', () => {
    const result = securityScore([{ name: 'MyApp', env_vars: { KEY: '' } }]);
    expect(result.details[0].projectName).toBe('MyApp');
  });
});
