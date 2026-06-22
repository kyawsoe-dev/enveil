import { invoke } from '@tauri-apps/api/tauri';
import type { DiffResult, Project, Vault } from './types';

export async function unlockVault(password: string): Promise<Vault> {
  return invoke<Vault>('unlock_vault', { password });
}

export async function initializeVault(password: string): Promise<void> {
  return invoke<void>('initialize_vault', { password });
}

export async function saveProject(password: string, project: Project): Promise<void> {
  return invoke<void>('save_project', { password, project });
}

export async function diffProjects(
  projectAId: string,
  projectBId: string,
): Promise<DiffResult> {
  return invoke<DiffResult>('diff_projects', {
    projectAId,
    projectBId,
  });
}

export async function runCommand(command: string, projectId: string): Promise<string> {
  return invoke<string>('run_command', { command, projectId });
}

export async function vaultExists(): Promise<boolean> {
  return invoke<boolean>('vault_exists');
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return invoke<void>('change_password', { oldPassword, newPassword });
}

export async function resetVault(): Promise<void> {
  return invoke<void>('reset_vault');
}

export async function deleteProject(password: string, projectId: string): Promise<void> {
  return invoke<void>('delete_project', { password, projectId });
}

export async function getVault(): Promise<Vault | null> {
  return invoke<Vault | null>('get_vault');
}

export async function generateTempEnv(projectId: string, symlinkPath?: string): Promise<string> {
  return invoke<string>('generate_temp_env', { projectId, symlinkPath: symlinkPath ?? null });
}

export async function regenerateTempEnv(projectId: string): Promise<void> {
  return invoke<void>('regenerate_temp_env', { projectId });
}

export async function deleteTempEnv(projectId: string): Promise<void> {
  return invoke<void>('delete_temp_env', { projectId });
}

export async function cleanupAllTempEnvs(): Promise<void> {
  return invoke<void>('cleanup_all_temp_envs');
}

export interface TempEnvStatus {
  temp_path: string;
  symlink_path: string | null;
}

export async function getTempEnvStatus(projectId: string): Promise<TempEnvStatus | null> {
  return invoke<TempEnvStatus | null>('get_temp_env_status', { projectId });
}
