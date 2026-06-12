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
