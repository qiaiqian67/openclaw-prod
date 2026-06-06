import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('store:set', key, value),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    setUrl: (url: string) => ipcRenderer.invoke('updater:setUrl', url),
    onChecking: (cb: () => void) => ipcRenderer.on('updater:checking', cb),
    onAvailable: (cb: (info: any) => void) => ipcRenderer.on('updater:available', (_, info) => cb(info)),
    onNotAvailable: (cb: () => void) => ipcRenderer.on('updater:not-available', cb),
    onProgress: (cb: (p: any) => void) => ipcRenderer.on('updater:progress', (_, p) => cb(p)),
    onDownloaded: (cb: (info: any) => void) => ipcRenderer.on('updater:downloaded', (_, info) => cb(info)),
    onError: (cb: (msg: string) => void) => ipcRenderer.on('updater:error', (_, msg) => cb(msg)),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximizeToggle: () => ipcRenderer.invoke('window:maximize-toggle') as Promise<boolean>,
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
    onMaximizeChange: (cb: (isMaximized: boolean) => void) => {
      const handler = (_: unknown, value: boolean) => cb(value);
      ipcRenderer.on('window:maximize-changed', handler);
      return () => ipcRenderer.removeListener('window:maximize-changed', handler);
    },
  },
  tray: {
    flash: () => ipcRenderer.invoke('tray:flash'),
    stopFlash: () => ipcRenderer.invoke('tray:stopFlash'),
    onOpenSettings: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('tray:open-settings', handler);
      return () => ipcRenderer.removeListener('tray:open-settings', handler);
    },
  },
});