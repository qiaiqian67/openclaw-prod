"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_electron_updater = require("electron-updater");
var import_electron_store = __toESM(require("electron-store"));
var import_path = __toESM(require("path"));
var store = new import_electron_store.default({
  defaults: {
    serverUrl: "http://localhost:8000/api",
    wsUrl: "ws://localhost:8000/ws",
    updateUrl: ""
  }
});
var mainWindow = null;
var tray = null;
var isQuitting = false;
var isDev = !import_electron.app.isPackaged;
var TRAY_ICON_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQ0lEQVR4nGNgGAWjYBSMghENGP///8/AwMDw//8fBgYGBob/X0CMRsgwKgaMxhgZGZj///8zMDD8//+fgYGBgYGB4T8DAwMDAwMDhmJgFAAAAABJRU5ErkJggg==";
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: "hidden",
    show: false
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  const indexPath = import_path.default.join(__dirname, "../dist/index.html");
  mainWindow.loadFile(indexPath);
  mainWindow.webContents.openDevTools();
  mainWindow.on("close", (e) => {
    if (process.platform !== "darwin" && !isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  const broadcastMaximizeState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("window:maximize-changed", mainWindow.isMaximized());
  };
  mainWindow.on("maximize", broadcastMaximizeState);
  mainWindow.on("unmaximize", broadcastMaximizeState);
}
function setupWindowControls() {
  import_electron.ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  import_electron.ipcMain.handle("window:maximize-toggle", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  import_electron.ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);
  import_electron.ipcMain.handle("window:close", () => {
    if (!mainWindow) return;
    if (process.platform === "darwin" || isQuitting) {
      mainWindow.close();
    } else {
      mainWindow.hide();
    }
  });
}
function createTray() {
  const icon = import_electron.nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new import_electron.Tray(icon);
  const contextMenu = import_electron.Menu.buildFromTemplate([
    { label: "\u6253\u5F00\u5BA2\u6237\u7AEF", click: () => mainWindow?.show() },
    { label: "\u68C0\u67E5\u66F4\u65B0", click: () => import_electron_updater.autoUpdater.checkForUpdatesAndNotify() },
    { type: "separator" },
    {
      label: "\u9000\u51FA",
      click: () => {
        isQuitting = true;
        import_electron.app.quit();
      }
    }
  ]);
  tray.setToolTip("DeerClaw \u5BA2\u6237\u7AEF");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => mainWindow?.show());
}
function setupAutoUpdater() {
  import_electron_updater.autoUpdater.autoDownload = false;
  import_electron_updater.autoUpdater.autoInstallOnAppQuit = true;
  import_electron_updater.autoUpdater.on("checking-for-update", () => {
    mainWindow?.webContents.send("updater:checking");
  });
  import_electron_updater.autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("updater:available", info);
  });
  import_electron_updater.autoUpdater.on("update-not-available", () => {
    mainWindow?.webContents.send("updater:not-available");
  });
  import_electron_updater.autoUpdater.on("download-progress", (p) => {
    mainWindow?.webContents.send("updater:progress", p);
  });
  import_electron_updater.autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("updater:downloaded", info);
  });
  import_electron_updater.autoUpdater.on("error", (e) => {
    mainWindow?.webContents.send("updater:error", e.message);
  });
  import_electron.ipcMain.handle("updater:check", async () => {
    try {
      return await import_electron_updater.autoUpdater.checkForUpdates();
    } catch {
      return null;
    }
  });
  import_electron.ipcMain.handle("updater:download", () => import_electron_updater.autoUpdater.downloadUpdate());
  import_electron.ipcMain.handle("updater:install", () => import_electron_updater.autoUpdater.quitAndInstall());
  import_electron.ipcMain.handle("updater:setUrl", (_, url) => {
    if (url) {
      import_electron_updater.autoUpdater.setFeedURL({ provider: "generic", url });
    }
  });
  import_electron.ipcMain.handle("app:getVersion", () => import_electron.app.getVersion());
}
import_electron.ipcMain.handle("store:get", (_, key) => store.get(key));
import_electron.ipcMain.handle("store:set", (_, key, value) => store.set(key, value));
import_electron.ipcMain.handle("shell:openExternal", (_, url) => import_electron.shell.openExternal(url));
import_electron.app.whenReady().then(() => {
  createWindow();
  createTray();
  setupWindowControls();
  setupAutoUpdater();
  if (!isDev) {
    import_electron_updater.autoUpdater.checkForUpdatesAndNotify();
  }
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
