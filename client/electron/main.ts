import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import path from 'path';

const store = new Store({
  defaults: {
    serverUrl: 'http://localhost:8000/api',
    wsUrl: 'ws://localhost:8000/ws',
    updateUrl: '',
    // Placeholder until the in-app settings UI ships; both are opened via
    // shell.openExternal so they need to be valid https URLs.
    feedbackUrl: 'https://github.com/dataelement/DeerClaw/issues/new',
    settingsUrl: 'https://github.com/dataelement/DeerClaw/wiki',
  },
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

// Content Security Policy — 注入到所有响应的 header，避免 Electron 启动时那条
// "Insecure Content-Security-Policy" 警告。设计上：
//   - 显式不放 'unsafe-eval'（production 由 Vite 构建、无 eval 需求；dev 也是 loadFile dist 产物，不需要）
//   - script/style 留 'unsafe-inline'：index.html 头部那段 fetch 拦截脚本是 inline，
//     Vite 也会注入 <style> 和 <script type="module"> 标签
//   - connect-src 不限域名：后端由用户在 Login 页面配置（HTTP/HTTPS/WS/WSS 都可能）
//   - 资源允许 file:/data:/blob:：打包后字体图标、tray icon data URL 都需要
const CSP_HEADER = [
    "default-src 'self' file: data: blob:;",
    "script-src 'self' 'unsafe-inline';",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
    "img-src 'self' data: blob:;",
    "font-src 'self' data: https://fonts.gstatic.com;",
    "connect-src 'self' http: https: ws: wss:;",
    "frame-src 'none';",
    "object-src 'none';",
    "base-uri 'self';",
].join(' ');

function applyContentSecurityPolicy() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const headers = { ...details.responseHeaders };
        // 删掉任何已有的 CSP（包括 devtools 注入的或第三方响应带过来的），统一覆盖
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'content-security-policy') delete headers[key];
        }
        headers['Content-Security-Policy'] = [CSP_HEADER];
        callback({ responseHeaders: headers });
    });
}

// 16x16 蓝色实心圆 PNG（base64），用作托盘图标，避免空图像导致 Windows 托盘不显示
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
  'Q0lEQVR4nGNgGAWjYBSMghENGP///8/AwMDw//8fBgYGBob/X0CMRsgwKgaMxhgZGZj/' +
  '//8zMDD8//+fgYGBgYGB4T8DAwMDAwMDhmJgFAAAAABJRU5ErkJggg==';

// 同尺寸 alert 图标：蓝圆 + 右上角红点，用于未读消息闪烁
// 由 electron/generate-tray-icons.js 生成
const TRAY_ICON_ALERT_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
  'mUlEQVR4nGNgIAG8EBEJeyEi8h9E41Uol3KHUy7lTohcyp1qKA6BakTBuDSDNHyRS7nz' +
  'H4aTPGdiaMbqErmUO4uQNcIwDs2oroDajKGZKBdA/fwFlwG4XIFsewg+zeguAdEgPUQ5' +
  'Hw+upqoBRHkBDaN4gWAgomGQWk5sCYh05xOTkNDwIkL5ACMpIzkbu81YDMHITBh+phYA' +
  'ACsjdcXNnezoAAAAAElFTkSuQmCC';

let flashTimer: NodeJS.Timeout | null = null;
let flashPhase = false;

function startTrayFlash() {
  if (flashTimer) return;
  if (!tray) return;
  const defaultIcon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  const alertIcon = nativeImage.createFromDataURL(TRAY_ICON_ALERT_DATA_URL);
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
  // Always restore the default icon so the tray settles in the resting state.
  if (tray) tray.setImage(nativeImage.createFromDataURL(TRAY_ICON_DATA_URL));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep DevTools reachable via Ctrl+Shift+I but don't auto-open
      // it on launch (was previously opened unconditionally, which
      // leaked the devtools dock into shipping builds).
      devTools: true,
    },
    titleBarStyle: 'hidden',
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  // Ctrl+Shift+I (or Cmd+Shift+I on macOS) toggles DevTools. Scoped to the
  // window via before-input-event so it doesn't bleed into other apps.
  // Ctrl+Shift+J and F12 are also bound as fallbacks.
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const cmd = input.control || input.meta;
    if (!cmd || !input.shift) return;
    if (key === 'i' || key === 'j' || key === 'f12') {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  mainWindow.on('close', (e) => {
    if (process.platform !== 'darwin' && !isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Track maximize state and push to renderer so HTML title bar
  // can swap the icon (□ ↔ ❐) and update aria-pressed.
  const broadcastMaximizeState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('window:maximize-changed', mainWindow.isMaximized());
  };
  mainWindow.on('maximize', broadcastMaximizeState);
  mainWindow.on('unmaximize', broadcastMaximizeState);

  // Focusing the window means the user has acknowledged any pending tray
  // flash, so settle the icon back to its resting state.
  mainWindow.on('focus', stopTrayFlash);
}

function setupWindowControls() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize-toggle', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
  // The X button in the HTML title bar mirrors the OS close button.
  // Match the existing close handler: hide to tray unless the user is quitting.
  ipcMain.handle('window:close', () => {
    if (!mainWindow) return;
    if (process.platform === 'darwin' || isQuitting) {
      mainWindow.close();
    } else {
      mainWindow.hide();
    }
  });

  // Tray icon flash — toggles between default and alert icons until
  // stopTrayFlash() runs (called by the main window's 'focus' event or by
  // an explicit IPC from the renderer once the user has seen the messages).
  ipcMain.handle('tray:flash', () => { startTrayFlash(); });
  ipcMain.handle('tray:stopFlash', () => { stopTrayFlash(); });
}

function createTray() {
  // 内嵌 16x16 蓝色圆形 PNG（base64），避免空图像导致 Windows 托盘图标不可见
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开实时状态',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: '检查更新',
      // Don't trigger the OS notification — let the renderer's UpdateDialog
      // show the download prompt only when an update is actually available.
      click: () => { autoUpdater.checkForUpdates().catch(() => {}); },
    },
    {
      label: '我要反馈',
      click: () => {
        const url = store.get('feedbackUrl') as string;
        if (url) shell.openExternal(url).catch(() => {});
      },
    },
    {
      label: '打开设置',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        // Surface the menu click in the renderer so it can route to a
        // settings page once that feature ships. For now the renderer
        // treats this as a no-op (or a "coming soon" toast).
        mainWindow.webContents.send('tray:open-settings');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('DeerClaw 客户端');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater:not-available');
  });

  autoUpdater.on('download-progress', (p) => {
    mainWindow?.webContents.send('updater:progress', p);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:downloaded', info);
  });

  autoUpdater.on('error', (e) => {
    mainWindow?.webContents.send('updater:error', e.message);
  });

  ipcMain.handle('updater:check', async () => {
    try {
      return await autoUpdater.checkForUpdates();
    } catch { return null; }
  });

  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());

  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());

  ipcMain.handle('updater:setUrl', (_, url: string) => {
    if (url) {
      autoUpdater.setFeedURL({ provider: 'generic', url });
    }
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
}

// IPC handlers
ipcMain.handle('store:get', (_, key: string) => store.get(key));
ipcMain.handle('store:set', (_, key: string, value: string) => store.set(key, value));

ipcMain.handle('shell:openExternal', (_, url: string) => shell.openExternal(url));

app.whenReady().then(() => {
  applyContentSecurityPolicy();
  createWindow();
  createTray();
  setupWindowControls();
  setupAutoUpdater();

  if (!isDev) {
    // Defer the startup check so the renderer's useAutoUpdater hook has
    // time to subscribe to the IPC events. Without this delay the early
    // 'checking-for-update' / 'update-available' events fire before React
    // mounts and the UpdateDialog never appears.
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});