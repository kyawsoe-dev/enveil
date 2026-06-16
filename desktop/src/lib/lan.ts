import { invoke } from '@tauri-apps/api/tauri';
import type { Project } from './types';

export interface PeerInfo {
  device_name: string;
  ip: string;
  port: number;
  hostname: string;
}

export interface SyncState {
  active: boolean;
  peers: PeerInfo[];
  my_device_name: string;
  port: number;
}

export async function startLanSync(): Promise<void> {
  return invoke<void>('start_lan_sync');
}

export async function stopLanSync(): Promise<void> {
  return invoke<void>('stop_lan_sync');
}

export async function getPeers(): Promise<PeerInfo[]> {
  return invoke<PeerInfo[]>('get_peers');
}

export async function getSyncStatus(): Promise<SyncState> {
  return invoke<SyncState>('get_sync_status');
}

export async function syncProjectFromPeer(
  peerDeviceName: string,
  projectId: string,
  password: string,
): Promise<Project> {
  return invoke<Project>('sync_project_from_peer', {
    peerDeviceName,
    projectId,
    password,
  });
}

export async function setDeviceName(name: string): Promise<void> {
  return invoke<void>('set_device_name', { name });
}
