import { invoke } from '@tauri-apps/api/tauri';
import type { DiffResult, EnvSnapshot, Project, Vault } from './types';

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

export async function generateTempEnv(projectId: string, symlinkPath: string | undefined, password: string): Promise<string> {
  return invoke<string>('generate_temp_env', { projectId, symlinkPath: symlinkPath ?? null, password });
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

export async function openFolder(path: string): Promise<void> {
  return invoke<void>('open_folder', { path });
}

export async function openInTerminal(path: string): Promise<void> {
  return invoke<void>('open_in_terminal', { path });
}

export async function generateEnvExample(projectId: string, outputPath?: string): Promise<string> {
  return invoke<string>('generate_env_example', { projectId, outputPath: outputPath ?? null });
}

export async function diffProjectWithFile(
  projectId: string,
  filePath: string,
): Promise<DiffResult> {
  return invoke<DiffResult>('diff_project_with_file', { projectId, filePath });
}

export async function runCommandStream(command: string, projectId: string): Promise<void> {
  return invoke<void>('run_command_stream', { command, projectId });
}

export async function stopCommand(): Promise<void> {
  return invoke<void>('stop_command');
}

export async function killProcessOnPort(port: number): Promise<void> {
  return invoke<void>('kill_process_on_port', { port });
}

export async function getProjectHistory(projectId: string): Promise<EnvSnapshot[]> {
  return invoke<EnvSnapshot[]>('get_project_history', { projectId });
}

export async function restoreSnapshot(
  projectId: string,
  snapshotIndex: number,
  password: string,
): Promise<void> {
  return invoke<void>('restore_snapshot', { projectId, snapshotIndex, password });
}

export async function exportVault(password: string, outputPath: string): Promise<void> {
  return invoke<void>('export_vault', { password, outputPath });
}

export async function importVault(password: string, inputPath: string, mode: 'replace' | 'merge'): Promise<void> {
  return invoke<void>('import_vault', { password, inputPath, mode });
}
