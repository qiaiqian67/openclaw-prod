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
var import_fs = __toESM(require("fs"));
var store = new import_electron_store.default({
  defaults: {
    serverUrl: "http://localhost:8000/api",
    wsUrl: "ws://localhost:8000/ws",
    updateUrl: "",
    // Placeholder until the in-app settings UI ships; both are opened via
    // shell.openExternal so they need to be valid https URLs.
    feedbackUrl: "https://github.com/dataelement/DeerClaw/issues/new",
    settingsUrl: "https://github.com/dataelement/DeerClaw/wiki"
  }
});
var mainWindow = null;
var tray = null;
var isQuitting = false;
var isDev = !import_electron.app.isPackaged;
import_electron.app.disableHardwareAcceleration();
var CSP_HEADER = [
  "default-src 'self' file: data: blob:;",
  "script-src 'self' 'unsafe-inline';",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
  "img-src 'self' data: blob:;",
  "font-src 'self' data: https://fonts.gstatic.com;",
  "connect-src 'self' http: https: ws: wss:;",
  "frame-src 'none';",
  "object-src 'none';",
  "base-uri 'self';"
].join(" ");
function applyContentSecurityPolicy() {
  import_electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "content-security-policy") delete headers[key];
    }
    headers["Content-Security-Policy"] = [CSP_HEADER];
    callback({ responseHeaders: headers });
  });
}
var trayIconDir = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "build") : import_path.default.join(__dirname, "..", "build");
var defaultIcon = null;
var alertIcon = null;
function loadTrayIcons() {
  const defaultPath = import_path.default.join(trayIconDir, "tray-default.png");
  const alertPath = import_path.default.join(trayIconDir, "tray-alert.png");
  if (!import_fs.default.existsSync(defaultPath)) {
    console.warn(`[tray] missing ${defaultPath} \u2014 run electron/prebuild-tray-icons.js`);
  }
  defaultIcon = import_electron.nativeImage.createFromPath(defaultPath);
  alertIcon = import_electron.nativeImage.createFromPath(alertPath);
  if (defaultIcon.isEmpty()) {
    console.warn(`[tray] tray-default.png loaded as empty image`);
  }
}
function getConfiguredFeed() {
  const updateUrl = store.get("updateUrl");
  if (!updateUrl) return null;
  return { provider: "generic", url: updateUrl };
}
var flashTimer = null;
var flashPhase = false;
function startTrayFlash() {
  if (flashTimer) return;
  if (!tray || !defaultIcon || !alertIcon) return;
  flashPhase = false;
  flashTimer = setInterval(() => {
    flashPhase = !flashPhase;
    tray?.setImage(flashPhase ? alertIcon : defaultIcon);
  }, 600);
}
function stopTrayFlash() {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
  flashPhase = false;
  if (tray && defaultIcon) tray.setImage(defaultIcon);
}
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep DevTools reachable via Ctrl+Shift+I but don't auto-open
      // it on launch (was previously opened unconditionally, which
      // leaked the devtools dock into shipping builds).
      devTools: true
    },
    titleBarStyle: "hidden",
    show: false
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  const indexPath = import_path.default.join(__dirname, "../dist/index.html");
  mainWindow.loadFile(indexPath);
  mainWindow.webContents.on("before-input-event", (_e, input) => {
    if (input.type !== "keyDown") return;
    const key = input.key.toLowerCase();
    const cmd = input.control || input.meta;
    if (!cmd || !input.shift) return;
    if (key === "i" || key === "j" || key === "f12") {
      mainWindow?.webContents.toggleDevTools();
    }
  });
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
  mainWindow.on("focus", stopTrayFlash);
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
  import_electron.ipcMain.handle("tray:flash", () => {
    startTrayFlash();
  });
  import_electron.ipcMain.handle("tray:stopFlash", () => {
    stopTrayFlash();
  });
}
function createTray() {
  loadTrayIcons();
  tray = new import_electron.Tray(defaultIcon);
  const contextMenu = import_electron.Menu.buildFromTemplate([
    {
      label: "\u6253\u5F00\u5B9E\u65F6\u72B6\u6001",
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: "\u68C0\u67E5\u66F4\u65B0",
      // Don't trigger the OS notification — let the renderer's UpdateDialog
      // show the download prompt only when an update is actually available.
      // Skip the call entirely if no updateUrl is configured: with no feed
      // set, autoUpdater falls back to the build-time provider (GitHub) and
      // 404s on a missing repo. The user can configure the server from the
      // login screen and try again.
      click: () => {
        const feed = getConfiguredFeed();
        if (!feed) {
          mainWindow?.webContents.send("updater:error", "\u672A\u914D\u7F6E\u66F4\u65B0\u670D\u52A1\u5668\u5730\u5740");
          return;
        }
        import_electron_updater.autoUpdater.setFeedURL(feed);
        import_electron_updater.autoUpdater.checkForUpdates().catch(() => {
        });
      }
    },
    {
      label: "\u6211\u8981\u53CD\u9988",
      click: () => {
        const url = store.get("feedbackUrl");
        if (url) import_electron.shell.openExternal(url).catch(() => {
        });
      }
    },
    {
      label: "\u6253\u5F00\u8BBE\u7F6E",
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send("tray:open-settings");
      }
    },
    { type: "separator" },
    {
      label: "\u9000\u51FA",
      click: () => {
        isQuitting = true;
        import_electron.app.quit();
      }
    }
  ]);
  tray.setToolTip("PeerOP \u5BA2\u6237\u7AEF");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
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
    const feed = getConfiguredFeed();
    if (!feed) {
      mainWindow?.webContents.send("updater:error", "\u672A\u914D\u7F6E\u66F4\u65B0\u670D\u52A1\u5668\u5730\u5740");
      return null;
    }
    import_electron_updater.autoUpdater.setFeedURL(feed);
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
  applyContentSecurityPolicy();
  createWindow();
  createTray();
  setupWindowControls();
  setupAutoUpdater();
  if (!isDev) {
    const feed = getConfiguredFeed();
    if (feed) {
      setTimeout(() => {
        import_electron_updater.autoUpdater.setFeedURL(feed);
        import_electron_updater.autoUpdater.checkForUpdates().catch(() => {
        });
      }, 3e3);
    }
  }
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
