export interface ElectronAPI {
  store: {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string) => Promise<void>;
  };
  updater: {
    check: () => Promise<any>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    setUrl: (url: string) => Promise<void>;
    onChecking: (cb: () => void) => void;
    onAvailable: (cb: (info: any) => void) => void;
    onNotAvailable: (cb: () => void) => void;
    onProgress: (cb: (p: any) => void) => void;
    onDownloaded: (cb: (info: any) => void) => void;
    onError: (cb: (msg: string) => void) => void;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
  };
  windowControls: {
    minimize: () => Promise<void>;
    maximizeToggle: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizeChange: (cb: (isMaximized: boolean) => void) => () => void;
  };
  tray: {
    flash: () => Promise<void>;
    stopFlash: () => Promise<void>;
    onOpenSettings: (cb: () => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};