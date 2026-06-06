# DeerClaw Client

桌面客户端，复用前端代码，连接自托管后端服务。

## 开发

```bash
cd client
npm install

# 开发模式（先 build 前端，再跑 electron）
npm run electron:dev

# 构建可执行文件
npm run electron:build
```

## 功能

- 服务器地址配置（登录页右上角设置按钮）
- 自动更新（electron-updater + GitHub Releases）
- 系统托盘
- 版本检查

## 构建配置

`electron-builder.yml` 控制构建产物：
- Windows: `nsis` 安装包
- macOS: `dmg`
- Linux: `AppImage`

## 自动更新

1. 在 GitHub Releases 发布新版本 tag
2. `electron-updater` 自动检查更新
3. 用户点击"下载"→"安装"完成升级

## 注意事项

- 原项目 `frontend/` 不受影响，独立维护
- 前端代码通过复制同步，如有冲突手动合并