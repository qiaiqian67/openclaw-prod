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