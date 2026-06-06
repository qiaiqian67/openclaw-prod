import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window {
    electronAPI?: {
      store: { get: (key: string) => Promise<string>; set: (key: string, value: string) => Promise<void> };
      app: { getVersion: () => Promise<string> };
      updater: {
        check: () => Promise<any>;
        download: () => Promise<void>;
        install: () => Promise<void>;
        onChecking: (cb: () => void) => void;
        onAvailable: (cb: (info: any) => void) => void;
        onNotAvailable: (cb: () => void) => void;
        onProgress: (cb: (p: any) => void) => void;
        onDownloaded: (cb: (info: any) => void) => void;
        onError: (cb: (msg: string) => void) => void;
      };
    };
  }
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateInfo {
  version?: string;
  progress?: number;
  error?: string;
}

export function useAutoUpdater() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({});
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    if (!window.electronAPI?.updater) return;

    window.electronAPI.updater.onChecking(() => setStatus('checking'));
    window.electronAPI.updater.onAvailable((info) => {
      setStatus('available');
      setUpdateInfo({ version: info?.version });
    });
    window.electronAPI.updater.onNotAvailable(() => setStatus('idle'));
    window.electronAPI.updater.onProgress((p) => {
      setStatus('downloading');
      setUpdateInfo({ progress: p?.percent });
    });
    window.electronAPI.updater.onDownloaded((info) => {
      setStatus('downloaded');
      setUpdateInfo({ version: info?.version });
    });
    window.electronAPI.updater.onError((msg) => {
      setStatus('error');
      setUpdateInfo({ error: msg });
    });

    window.electronAPI.app.getVersion().then(setCurrentVersion);
  }, []);

  const checkUpdate = useCallback(async () => {
    if (!window.electronAPI?.updater) return;
    // Set custom update URL if configured
    const updateUrl = localStorage.getItem('updateUrl');
    if (updateUrl && window.electronAPI.updater.setUrl) {
      await window.electronAPI.updater.setUrl(updateUrl);
    }
    setStatus('checking');
    await window.electronAPI.updater.check();
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (!window.electronAPI?.updater) return;
    await window.electronAPI.updater.download();
  }, []);

  const installUpdate = useCallback(async () => {
    if (!window.electronAPI?.updater) return;
    await window.electronAPI.updater.install();
  }, []);

  // Hide the dialog without reloading the page. Used by the "忽略" /
  // "取消" / "×" affordances across all update states. The user can
  // re-trigger a check from the tray menu at any time.
  const dismiss = useCallback(() => {
    setStatus('idle');
    setUpdateInfo({});
  }, []);

  return {
    status,
    updateInfo,
    currentVersion,
    checkUpdate,
    downloadUpdate,
    installUpdate,
    dismiss,
  };
}