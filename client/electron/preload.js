"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  store: {
    get: (key) => import_electron.ipcRenderer.invoke("store:get", key),
    set: (key, value) => import_electron.ipcRenderer.invoke("store:set", key, value)
  },
  updater: {
    check: () => import_electron.ipcRenderer.invoke("updater:check"),
    download: () => import_electron.ipcRenderer.invoke("updater:download"),
    install: () => import_electron.ipcRenderer.invoke("updater:install"),
    setUrl: (url) => import_electron.ipcRenderer.invoke("updater:setUrl", url),
    onChecking: (cb) => import_electron.ipcRenderer.on("updater:checking", cb),
    onAvailable: (cb) => import_electron.ipcRenderer.on("updater:available", (_, info) => cb(info)),
    onNotAvailable: (cb) => import_electron.ipcRenderer.on("updater:not-available", cb),
    onProgress: (cb) => import_electron.ipcRenderer.on("updater:progress", (_, p) => cb(p)),
    onDownloaded: (cb) => import_electron.ipcRenderer.on("updater:downloaded", (_, info) => cb(info)),
    onError: (cb) => import_electron.ipcRenderer.on("updater:error", (_, msg) => cb(msg))
  },
  shell: {
    openExternal: (url) => import_electron.ipcRenderer.invoke("shell:openExternal", url)
  },
  app: {
    getVersion: () => import_electron.ipcRenderer.invoke("app:getVersion")
  },
  windowControls: {
    minimize: () => import_electron.ipcRenderer.invoke("window:minimize"),
    maximizeToggle: () => import_electron.ipcRenderer.invoke("window:maximize-toggle"),
    close: () => import_electron.ipcRenderer.invoke("window:close"),
    isMaximized: () => import_electron.ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (cb) => {
      const handler = (_, value) => cb(value);
      import_electron.ipcRenderer.on("window:maximize-changed", handler);
      return () => import_electron.ipcRenderer.removeListener("window:maximize-changed", handler);
    }
  },
  tray: {
    flash: () => import_electron.ipcRenderer.invoke("tray:flash"),
    stopFlash: () => import_electron.ipcRenderer.invoke("tray:stopFlash"),
    onOpenSettings: (cb) => {
      const handler = () => cb();
      import_electron.ipcRenderer.on("tray:open-settings", handler);
      return () => import_electron.ipcRenderer.removeListener("tray:open-settings", handler);
    }
  }
});
