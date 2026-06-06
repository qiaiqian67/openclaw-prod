/** 从 electron store 同步服务器配置到 localStorage，供前端 api.ts 使用 */

import type { ElectronAPI } from '../types/electron';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const DEFAULT_SERVER_URL = 'http://localhost:8000/api';
const DEFAULT_WS_URL = 'ws://localhost:8000/ws';

/** 启动时调用：确保 serverUrl/wsUrl 已同步到 localStorage */
export async function syncServerConfig(): Promise<void> {
  if (!window.electronAPI?.store) return;

  // 已有值就不覆盖
  const stored = localStorage.getItem('serverUrl');
  if (!stored) {
    const url = await window.electronAPI.store.get('serverUrl');
    localStorage.setItem('serverUrl', url || DEFAULT_SERVER_URL);
  }
  const wsStored = localStorage.getItem('wsUrl');
  if (!wsStored) {
    const wsUrl = await window.electronAPI.store.get('wsUrl');
    localStorage.setItem('wsUrl', wsUrl || DEFAULT_WS_URL);
  }
}

export {};