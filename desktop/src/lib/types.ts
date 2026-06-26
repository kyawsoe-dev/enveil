export interface Vault {
  version: number;
  projects: Project[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  env_vars: Record<string, string>;
  share_password?: string | null;
  run_cmd?: string | null;
  history?: EnvSnapshot[];
}

export interface EnvSnapshot {
  timestamp: number;
  label: string;
  env_vars: Record<string, string>;
}

export interface DiffResult {
  project_a_name: string;
  project_b_name: string;
  only_in_a: Record<string, string>;
  only_in_b: Record<string, string>;
  changed: Record<string, [string, string]>;
}

export type AppView = 'dashboard' | 'project' | 'diff' | 'terminal' | 'lan';
