import { invoke } from '@tauri-apps/api/tauri';

export interface AIConfig {
  configured: boolean;
}

const AI_MODEL = 'enveil_ai_model';
const DAILY_LIMIT = 100;

function todayKey(): string {
  const d = new Date();
  return `enveil_ai_requests_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDailyRemaining(): number {
  if (typeof window === 'undefined') return DAILY_LIMIT;
  const raw = localStorage.getItem(todayKey());
  const count = raw ? Number(raw) : 0;
  return Math.max(0, DAILY_LIMIT - count);
}

function checkRateLimit(): void {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(todayKey());
  const count = raw ? Number(raw) : 0;
  if (count >= DAILY_LIMIT) {
    throw new Error(`Daily AI request limit reached (${DAILY_LIMIT}/${DAILY_LIMIT}). Try again tomorrow.`);
  }
}

function incrementRateLimit(): void {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(todayKey());
  const count = raw ? Number(raw) : 0;
  localStorage.setItem(todayKey(), String(count + 1));
}

async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  checkRateLimit();
  const result = await fn();
  incrementRateLimit();
  return result;
}

export async function getAiConfig(): Promise<AIConfig> {
  return invoke<AIConfig>('get_ai_config');
}

export function getAiModel(): string {
  if (typeof window === 'undefined') return 'openai/gpt-4o-mini';
  return localStorage.getItem(AI_MODEL) ?? 'openai/gpt-4o-mini';
}

export function setAiModel(model: string): void {
  localStorage.setItem(AI_MODEL, model);
}

export async function callAI(prompt: string): Promise<string> {
  const model = getAiModel();
  return withRateLimit(() => invoke<string>('call_ai', { prompt, model }));
}

export async function generateEnvTemplate(description: string): Promise<string> {
  const model = getAiModel();
  return withRateLimit(() => invoke<string>('generate_env_template', { description, model }));
}

export async function validateEnvVars(envVars: Record<string, string>): Promise<string> {
  const model = getAiModel();
  return withRateLimit(() => invoke<string>('validate_env_vars', { envVarsJson: JSON.stringify(envVars, null, 2), model }));
}

export async function generateEnvDocstrings(envVars: Record<string, string>): Promise<string> {
  const model = getAiModel();
  return withRateLimit(() => invoke<string>('generate_env_docstrings', { envVarsJson: JSON.stringify(envVars, null, 2), model }));
}

export interface DiffSummaryInput {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged_count: number;
}

export async function suggestProject(description: string): Promise<string> {
  const model = getAiModel();
  return withRateLimit(() => invoke<string>('suggest_project', { description, model }));
}

export async function suggestEnvVar(prompt: string, existingKeys: string[]): Promise<string> {
  const model = getAiModel();
  return withRateLimit(() => invoke<string>('suggest_env_var', { prompt, existingKeys: JSON.stringify(existingKeys), model }));
}

export async function explainDiff(diff: DiffSummaryInput): Promise<string> {
  const model = getAiModel();
  return withRateLimit(() => invoke<string>('explain_diff', { diffJson: JSON.stringify(diff, null, 2), model }));
}
