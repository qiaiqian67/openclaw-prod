# DeerClaw Client 开发记录

## 项目概述

为 DeerClaw 项目开发 Electron 桌面客户端，位于 `client/` 目录，独立于原 `frontend/` 工作，不影响原项目升级。

## 目录结构

```
client/
├── electron/                  # Electron 主进程
│   ├── main.ts              窗口管理、系统托盘、自动更新
│   ├── preload.ts           IPC 安全桥接
│   ├── main.js              esbuild 编译后的输出
│   └── preload.js
├── web/                      # 前端代码（从 frontend/ 复制）
│   ├── pages/Login.tsx      已添加服务器设置 UI
│   ├── hooks/useAutoUpdater.ts  自动更新 hook
│   ├── hooks/useServerConfig.ts 配置同步
│   ├── components/UpdateDialog.tsx 更新提示浮窗
│   ├── services/api.ts      改为动态服务器地址
│   ├── main.tsx             已改用 HashRouter
│   └── types/electron.d.ts  Electron API 类型
├── dist/                      # Vite 构建产物
├── release/                  # Electron 构建输出
│   └── win-unpacked/         # Windows 便携版
│       └── DeerClaw Client.exe
├── build/                    # 图标目录（待提供）
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## 已实现功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 客户端框架 | ✅ | 独立于原 frontend，不影响升级 |
| 服务器设置 | ✅ | 登录页右上角设置按钮，可配置 API/WebSocket/更新服务器地址 |
| 配置持久化 | ✅ | electron-store 优先，localStorage 兜底 |
| 自动更新 | ✅ | electron-updater，支持私有服务器 URL |
| 更新提示浮窗 | ✅ | 右下角浮窗：检查中/可下载/下载中/已就绪/错误 |
| 系统托盘 | ✅ | 托盘菜单：打开、检查更新、退出 |
| 版本检查 | ✅ | IPC 暴露给前端 |
| HashRouter | ✅ | 解决 Electron file:// 路由问题 |
| NSIS 安装界面品牌化 | ✅ | v5 完整重写：白底 + 草绿 #5BB85B + 熊猫插画 + 中英双语 7 个页面（4 装 + 3 卸）；详见「NSIS 安装界面定制」一节 |

## 服务器设置配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| API 服务器地址 | REST API | `http://localhost:8000` |
| WebSocket 地址 | 实时通信 | `ws://localhost:8000/ws` |
| 更新服务器地址 | 留空用 GitHub，填入则用私有服务器 | 留空 |

## 构建命令

```bash
cd client

# 安装依赖
npm install

# 开发模式
npm run electron:dev

# 构建可执行文件（输出到 release/）
npm run electron:build

# 仅构建前端
npm run build

# 仅编译 Electron 主进程
npm run build:electron
```

## 当前构建状态

- Windows exe 已构建：`release/win-unpacked/DeerClaw Client.exe`
- 构建目标：`portable`（便携版，无须安装）
- 代码签名：已禁用（Windows 上有符号链接问题）

## 已知问题

### winCodeSign 解压警告
electron-builder 在解压 winCodeSign 缓存时报符号链接错误（macOS 的 .dylib 文件在 Windows 上不支持），不影响构建结果。

### 图标文件
`build/icon.ico` 未提供，使用 Electron 默认图标。构建完成后去掉 `electron-builder.yml` 中 `win.icon` 的注释并放入图标文件即可。

## 私有更新服务器配置

在更新服务器上按如下结构放置文件：

```
https://your-update-server.com/deerclaw-updates/
├── win-unpacked/
│   ├── latest.yml           # 清单
│   └── DeerClaw Client-0.1.0.exe
```

`latest.yml` 示例：
```yaml
version: 0.1.0
files:
  - url: win-unpacked/DeerClaw Client-0.1.0.exe
    sha512: <sha512-hash>
path: win-unpacked/
```

## 待完成

1. 提供图标文件 `client/build/icon.ico`
2. 验证完整的登录流程
3. 验证自动更新功能（需先部署更新服务器）
4. 前端代码同步机制（当前是手动复制，频繁更新可考虑 Git subtree）

## 技术要点

- Electron 使用 contextIsolation + preload 模式，安全隔离
- 自动更新使用 `generic` provider，支持任意 HTTP 服务器地址
- React Router 使用 HashRouter，兼容 Electron 的 file:// 协议
- API 调用改为动态获取服务器地址，支持运行时切换后端

## NSIS 安装界面定制

NSIS 安装包（`release/DeerClaw Client Setup 0.1.0.exe`）已用 **Path B**（自定义 NSIS 页面）完整重做：白底 + 草绿 #5BB85B + 熊猫插画 + 中英双语。共 7 个营销页（4 装 + 3 卸）由 `nsDialogs` 完整手写，仅 License 页走 MUI2 内置。

### 7 个页面

| # | 阶段 | 实现方式 | 内容 |
|---|------|----------|------|
| 1 | 装·欢迎 | nsDialogs 自定义（`customWelcomePage`） | 标题 + 双段正文 + 3 chip + 左侧 sleeping panda |
| 2 | 装·License | MUI2 内置（`MUI_PAGE_LICENSE`） | EULA RTF + 中英文案 |
| 3 | 装·目录 | MUI2 默认（`MUI_PAGE_DIRECTORY`） | `MUI_BGCOLOR=FFFFFF` + 自定义 TEXT_TOP |
| 4 | 装·进度 | MUI2 默认（`MUI_PAGE_INSTFILES`） | `INSTFILESPAGE_PROGRESSBAR=colored` |
| 5 | 装·完成 | nsDialogs 自定义（`customFinishPage`） | 标题 + 正文 + 「启动 DeerClaw」勾选 + 左侧 crying panda |
| 6 | 卸·欢迎 | nsDialogs 自定义（`customUnWelcomePage`） | 标题 + 提示 + 左侧 finish panda |
| 7 | 卸·完成 | nsDialogs 自定义（`customUninstallPage`） | 标题 + 提示 + 左侧 finish panda |

> 注：`assistedInstaller.nsh` 没有 `customDirectoryPage` 钩子，目录页必须走 MUI2 默认（用 `MUI_BGCOLOR=FFFFFF` 上色白底 + `MUI_DIRECTORYPAGE_TEXT_TOP` 改文案）。

### 资源结构

```
client/build/
├── LICENSE.rtf            # EULA 协议(英文, NSIS RichEdit 渲染)
└── installer/
    ├── generate_assets.py # 位图生成脚本(PIL,从 references/v5/*.png 裁剪)
    ├── header.bmp         # 57×57 安装页头部图标(白底 + 熊猫脸)
    ├── sidebar.bmp        # 164×314 侧边栏位图(白底 + 标题 + 3 chip + 版权)
    ├── panda_welcome.bmp  # 装欢迎页插画(sleeping panda)
    ├── panda_directory.bmp
    ├── panda_install.bmp
    ├── panda_finish.bmp   # 装完成 + 卸欢迎 + 卸完成 共用
    ├── *_preview.png      # 调试用的 PNG 预览
    └── installer.nsh      # NSIS 钩子(5 个 PAGE 宏 + 4 个 PAGE 函数 + 17 个 LangString)
```

### 修改位图

位图由 `generate_assets.py` 脚本生成（v5 = 白底 + 草绿 + 熊猫）。色常量在脚本顶部：

- 背景白：`#FFFFFF` / `#F6F6F6`（卡片）
- 品牌草绿：`#5BB85B`（主）/ `#4A9C4A`（深）/ `#7BC87B`（亮）
- 文字：`#333333`（主）/ `#888888`（弱）/ `#B0B0B0`（极弱）
- 边线：`#E8E8EC`

改完色或布局后跑 `python generate_assets.py` 重新生成 BMP，并跑 `npm run electron:build` 验证。

### 钩子脚本 `installer.nsh`

通过 electron-builder 的 `nsis.include` 字段挂入。`customWelcomePage` / `customFinishPage` / `customUnWelcomePage` / `customUninstallPage` 四个钩子是 `assistedInstaller.nsh` 通过 `!ifmacrodef` 调用的；`licensePage` 钩子由 electron-builder 的 `computeLicensePage()` 自动生成（见 `app-builder-lib/out/targets/nsis/nsisLicense.js`），**不要自己再 !macro licensePage**，否则触发「macro already exists」。

关键约束（v5 踩过的坑）：

- **NSIS LangString 第二参数必须是 LCID 数字**（1033 / 2052），不是 `${LANG_ENGLISH}` 宏形式。
- **electron-builder 默认 16 种安装语言**，自定义 LangString 只覆盖中英时，限制 `installerLanguages: [en_US, zh_CN]`，否则会触发 NSIS warning 6040「LangString not set in language table of <X>」被 electron-builder 当成 fatal error。
- **`!define MUI_HEADERIMAGE` 重复定义**会触发「already defined」错误。electron-builder 已经通过命令行 -D 注入了 `MUI_HEADERIMAGE` / `MUI_HEADERIMAGE_BITMAP` / `MUI_WELCOMEFINISHPAGE_BITMAP` / `MUI_UNWELCOMEFINISHPAGE_BITMAP`。需要用 `!ifndef ... !endif` 守卫，或完全省略（让 electron-builder 处理图片，我们只处理文案）。
- **`!macro licensePage` 已由 electron-builder 自动生成**（内部 `!insertmacro MUI_PAGE_LICENSE "${license}"`），覆盖 License 文案的方式是：在文件顶部 `!define MUI_LICENSEPAGE_TEXT_TOP <LangString 名>`（**传 LangString 标识符，不是 `$(...)` 引用**，否则 NSIS 会冻结为字面量，中英切换失效）。
- **Win32 常量需 `!ifndef` 守卫**（`STM_SETIMAGE` / `IMAGE_BITMAP` / `LR_LOADFROMFILE` / `BCM_SETSHIELD`），electron-builder 25.x 在部分场景会预定义，重复 !define 触发错误。
- **`SetCtlColors` 三个参数**（HWND BG FG），不是 4 个。多写一个颜色会触发「usage error」。
- **卸载器没有 `uninstallerHeader` 字段**，electron-builder 25.x 不支持。仅 `uninstallerSidebar` 可设。

### 想继续定制

- 想换色 → 改 `generate_assets.py` 顶部 `BG_WHITE` / `GREEN` / `GREEN_DK` 等色常量
- 想改文案 → 改 `installer.nsh` 里的 17 个 LangString（10 对中英 + dcFinishRun）
- 想换插画 → 替换 `references/v5/<name>.png` 并调 `PANDA_CROPS` 裁剪框