# 主题系统扩展 — 开发记录

> 记录 `client/web/` 在 2026-06-09 这一轮围绕"主题切换系统"做的两件事：
> 1. **新增 Apple 主题**（源自 `client/design/apple.md`，5 套主题循环的最后一环）
> 2. **升级 MiniMax 主题**（在已有基础上注入"品牌色谱"视觉密度，从无印良品黑白升到 vibrant gradient）
>
> 涉及 3 个文件 + 2 个 i18n JSON，约 +260 / -10 行。
> 方向：零结构改动、纯 CSS 增量 + 一处循环常量扩展 + 一处 icon import + 1 条 i18n key × 2 语言。
> 设计规范源：`client/design/{apple,claude,minimax}.md`（3 份第三方产品设计分析，作为颜色/排版/组件的真实参照系）。

---

## 设计规范源（`client/design/`）

| 文件 | 对应主题 | 已实现 |
|---|---|---|
| `apple.md` | Apple — Photography-first、纯白画布、Action Blue #0066cc、博物馆级留白 | ✅ 本轮新增 |
| `claude.md` | Claude — Cream 画布 + Coral #cc785c、slab-serif 标题 | ✅ 之前已实现 |
| `minimax.md` | MiniMax — 纯白画布 + 黑 pill + 多色品牌色谱（coral→magenta→purple→blue） | ✅ 之前已实现，本轮升级 |

约定：**新增主题必须先有 `client/design/*.md` 设计规范**（不仅是 token 表，还要含 `colors`/`typography`/`components` 三段），实现时按规范原文取色，禁止拍脑袋。

---

## 改动总览

| 关注点 | 任务 | 文件 | 关键变化 |
|--------|------|------|---------|
| 主题 | **T-1** Apple 主题 CSS | `index.css` `[data-theme="apple"]` 块 | 17 个 token 全部从 `apple.md` 提取（`canvas`/`primary`/`hairline`/`ink` 等），加 `.btn-primary/.btn-secondary` 主题覆盖 |
| 主题 | **T-2** 5 套循环常量 | `Layout.tsx` `THEME_CYCLE` | `['dark','light','claude','minimax']` → `['dark','light','claude','minimax','apple']`；`themeIconKey` 加 `camera`、`themeLabelKey` 加 `common.appleMode` |
| 主题 | **T-3** 主题图标 | `Layout.tsx` `SidebarIcons` + imports | 加 `IconCamera`（呼应 Apple photography-first 语汇）；`camera` 加进 `SidebarIcons` 表 |
| i18n | **L-1** 1 个新 key | `i18n/en.json` + `i18n/zh.json` | `common.appleMode = "Apple Mode"` / `"Apple 模式"` |
| 升级 | **M-1** MiniMax 品牌色谱 token | `index.css` `[data-theme="minimax"]` 块 | 5 个品牌色 + 2 个渐变（`--brand-spectrum` 100deg 四段、`--brand-spectrum-soft` 软底）；`--info-card-accent` 改成 `#ff5530→#1456f0` |
| 升级 | **M-2** MiniMax 10 处视觉锚点 | `index.css` 新增 minimax 作用域覆盖块 | sidebar 顶 3px 色谱条、active 左 3px 色谱条+洋红图标、btn-primary 底 2px 色谱条+双光晕、avatar 色谱、status-dot 光环、badge-info 色谱、divider 色谱线、notification-bar 紫渐变、sidebar-logo 渐变字、section-title 渐变字 |
| 工具 | **U-1** 主题预览小样 | `theme-preview.html` | 之前已建，3 套设计规范的 token 取色对照表（4 套主题并排预览） |

---

## 详细改动

### 1. Apple 主题（新增 1 套）

#### 1.1 CSS 变量块（`index.css:435-489`）

完整照搬 `client/design/apple.md` 的 `colors` 节，不臆造：

```css
[data-theme="apple"] {
  --bg-primary: #ffffff;            /* canvas 纯白 */
  --bg-secondary: #f5f5f7;          /* canvas-parchment */
  --bg-tertiary: #fafafc;           /* surface-pearl */
  --bg-elevated: #ffffff;
  --bg-hover: #f5f5f7;
  --bg-active: #ececee;
  --border-default: #e0e0e0;        /* hairline */
  --border-subtle: #f0f0f0;         /* divider-soft */
  --border-strong: #c7c7cc;
  --text-primary: #1d1d1f;          /* ink 暖黑 */
  --text-secondary: #333333;        /* ink-muted-80 */
  --text-tertiary: #7a7a7a;         /* ink-muted-48 */
  --text-inverse: #ffffff;
  --accent-primary: #0066cc;        /* primary Action Blue */
  --accent-hover: #0071e3;          /* primary-focus */
  --accent-subtle: rgba(0, 102, 204, 0.08);
  --accent-text: #0066cc;
  --success: #1ba673; --success-subtle: rgba(27, 166, 115, 0.10);
  --warning: #d4a017; --warning-subtle: rgba(212, 160, 23, 0.10);
  --error:   #d45656; --error-subtle:   rgba(212, 86, 86, 0.10);
  --info:    #0066cc; --info-subtle:    rgba(0, 102, 204, 0.08);
  --info-card-accent: #0066cc; --info-card-accent-end: #2997ff;
  --status-running: #1ba673; --status-idle: #7a7a7a;
  --status-stopped: #c7c7cc; --status-error: #d45656;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 12px 28px rgba(0, 0, 0, 0.12);
  --notification-bar-text: #ffffff;
  --notification-bar-close-hover: rgba(0, 0, 0, 0.10);
}
[data-theme="apple"] .btn-primary { color: #ffffff; }
[data-theme="apple"] .btn-secondary { background: var(--bg-elevated); border: 1px solid var(--border-default); color: var(--text-secondary); }
```

> 选色依据：apple.md `colors.primary: "#0066cc"` + `primary-focus: "#0071e3"` + `ink: "#1d1d1f"` + `canvas-parchment: "#f5f5f7"` 等共 17 个 token 全部直引，不外推。

#### 1.2 循环切换逻辑（`Layout.tsx:627-660`）

```tsx
// 之前
const THEME_CYCLE = ['dark', 'light', 'claude', 'minimax'] as const;
// 之后
const THEME_CYCLE = ['dark', 'light', 'claude', 'minimax', 'apple'] as const;

const themeIconKey: Record<ThemeName, keyof typeof SidebarIcons> = {
  dark: 'sun', light: 'flame', claude: 'bolt',
  minimax: 'camera',   // ← 新：minimax 之后是 apple
  apple: 'moon',       // ← 新：apple 之后是 dark
};
const themeLabelKey: Record<ThemeName, string> = {
  dark: 'common.lightMode',  light: 'common.claudeMode',
  claude: 'common.minimaxMode',
  minimax: 'common.appleMode',   // ← 新
  apple: 'common.darkMode',
};
```

图标选择 `IconCamera`：apple.md 自述 "A photography-first interface that turns marketing into a museum gallery"，用 camera 呼应比通用 moon/sun 更贴品牌。

#### 1.3 i18n（`en.json:1749` / `zh.json:1908`）

```json
// en
"appleMode": "Apple Mode",
// zh
"appleMode": "Apple 模式",
```

---

### 2. MiniMax 品牌色谱升级

#### 2.1 新增 token（`index.css:425-435`）

在原 `[data-theme="minimax"]` 块末尾追加 5 品牌色 + 2 渐变：

```css
--brand-coral: #ff5530;
--brand-magenta: #ea5ec1;
--brand-purple: #a855f7;
--brand-blue: #1456f0;
--brand-cyan: #3daeff;
--brand-spectrum: linear-gradient(100deg, #ff5530 0%, #ea5ec1 35%, #a855f7 65%, #1456f0 100%);
--brand-spectrum-soft: linear-gradient(135deg, rgba(255, 85, 48, 0.10), rgba(234, 94, 193, 0.10), rgba(168, 85, 247, 0.10), rgba(20, 86, 240, 0.10));
```

> 色源：minimax.md `colors.brand-coral: "#ff5530"` + `brand-magenta: "#ea5ec1"` + `brand-purple: "#a855f7"` + `brand-blue: "#1456f0"` + `brand-cyan: "#3daeff"`。
> 渐变角度选 100deg（不 90）— 稍微斜向下流，比正横条更有"流光"质感。

#### 2.2 10 处组件锚点（`index.css:441-562` 全部 `[data-theme="minimax"]` 作用域）

| # | 选择器 | 升级 | 体现"图标/色块/色条" |
|---|---|---|---|
| 1 | `.sidebar-top` | `background-image: var(--brand-spectrum), var(--bg-secondary); background-size: 100% 3px, 100% 100%;` | **色条**（3px 顶条） |
| 2 | `.sidebar-item.active` | `background: linear-gradient(90deg, rgba(234,94,193,.12) 0%, rgba(20,86,240,.06) 60%, transparent)` + `font-weight: 600` | **色块** |
| 2b | `.sidebar-item.active::before` | 左 3px 宽 `var(--brand-spectrum)`、圆角 0 2px 2px 0 | **色条** |
| 2c | `.sidebar-item.active .sidebar-item-icon` | `color: #ea5ec1`（magenta） | **图标** |
| 3 | `.btn-primary::after` | 底部 2px `var(--brand-spectrum)`、圆角 0 0 6px 6px、opacity 0.9 | **色条** |
| 3b | `.btn-primary:hover` | 双色光晕 `0 6px 20px -4px rgba(234,94,193,.38), 0 2px 8px rgba(20,86,240,.28)` | **色块** |
| 4 | `.workspace-switcher-avatar, .workspace-switcher-avatar.tone-1` | 默认头像换 `var(--brand-spectrum)` + 蓝色光晕 | **色块** |
| 5 | `.status-dot.running` | `box-shadow: 0 0 0 2px rgba(27,166,115,.22), 0 0 8px rgba(27,166,115,.45)` | **色块**（光晕环） |
| 6 | `.badge-info` | `background: var(--brand-spectrum); color: #fff;` | **色块** |
| 7 | `.sidebar-divider` | 1px 细线换 `var(--brand-spectrum)`，opacity 0.42 | **色条** |
| 8 | `.notification-bar` | `linear-gradient(90deg, #0a0a0a 0%, #1a0a22 50%, #0a0a0a 100%)` | **色块**（深紫光带） |
| 9 | `.sidebar-logo` | `background: var(--brand-spectrum); -webkit-background-clip: text; -webkit-text-fill-color: transparent;` | **色块**（渐变字） |
| 10 | `.sidebar-section-title` | 同上（`opacity: 0.75` 弱化） | **色块**（渐变小标） |

> 10 处不是随机分布：覆盖了"色条（条状）"、"色块（面状）"、"图标（点状）"三类视觉密度，分布到 chrome 的顶部 / 侧边 / 中部 / 底部 / 文字 5 个层次，确保用户视线每滑过一个区域都能看到一个品牌信号，但不互相抢戏。

#### 2.3 设计克制原则

- **spectrum 用在条/边/角，不刷大面积** — 全屏铺渐变会显得廉价；只用在 2-3px 边、徽章、avatar 圆角
- **dark base 保留** — `.btn-primary` 主体仍是 `--accent-primary: #0a0a0a`（minimax 招牌黑 pill），只在 `::after` 2px 边和 hover 光晕上注入品牌色，保持"黑底 + 单高光"基调
- **tint 控制在 12%** — active 背景的 `rgba(234,94,193,.12)` 12% 透明度，足够引导视线但不让背景喧宾夺主
- **tone-2~6 不动** — 用户的 workspace avatar tone-2 至 tone-6 是个人化色，仅覆盖 `tone-1`（默认 / 无 logo 状态），尊重现有用户偏好

---

## 不动的边界（重要约束）

按用户硬性要求"不能改变我项目布局.主键、结构等，仅增加风格切换"：

| 项 | 状态 | 说明 |
|---|---|---|
| 路由 / 页面 / 组件结构 | ✅ 不动 | 5 套主题都是纯 CSS 切换 |
| 任何 props / state / 上下文 / store | ✅ 不动 | 主题值只走 `data-theme` attribute + localStorage |
| 现有 4 套主题 | ✅ 兼容 | `[data-theme="dark|light|claude|minimax"]` 块全部原样保留，仅在 minimax 块末尾追加 7 个 token、minimax 块后追加 10 条覆盖 |
| 现有 `--info-card-accent`/`--info-card-accent-end` 含义 | ✅ 不变 | minimax 主题内改成 `#ff5530/#1456f0`（仍是双色），但其他主题保留原值 |
| i18n key 命名规范 | ✅ 沿用 | `common.{themeName}Mode` 4 → 5 |
| 主题切换 UI（侧边栏按钮） | ✅ 不动 | 复用 `cycleTheme` + `themeIconKey` + `themeLabelKey` 三个 map |
| Layout、App、Login 等 React 组件 | ✅ 不动 | 唯一变更是 `Layout.tsx` 的 THEME_CYCLE 加 1 项 + 2 个 map 字典加 1 项 + 1 个 icon import + 1 个 icon key |

---

## 验证

### 编译验证

```bash
cd E:/MyWork/AIwork/DeerClaw/client
npm run build              # vite build: 10.35s, 0 错误, CSS 185.39 kB
npm run electron:build     # 完整 electron 打包: 0 错误, 73 MB × 2
```

### CSS bundle 检查（`dist/assets/index-*.css`）

```
[+] Brand spectrum gradient: linear-gradient(100deg, #ff5530 0%, #ea5ec1 35%, #a855f7 65%, #1456f0 100%)
[+] 5 brand colors all present: #ff5530 / #ea5ec1 / #a855f7 / #1456f0 / #3daeff
[+] 11 minimax-scoped override rules: sidebar-top, sidebar-item.active (+icon child),
    btn-primary, workspace-switcher-avatar(+tone-1), status-dot.running,
    badge-info, sidebar-divider, notification-bar, sidebar-logo, sidebar-section-title
[+] [data-theme=apple] block compiled (185391 bytes CSS total)
```

### 打包后 asar 验证（`release/win-unpacked/resources/app.asar`）

直接用 `@electron/asar` 提取 `dist/assets/index-*.css` 后再 grep：
- ✅ 5 套主题 token 全部在包内（dark/light/claude/minimax/apple 各自的 `--bg-primary` 等）
- ✅ 18 处 `[data-theme=minimax]` 作用域引用
- ✅ 12 个品牌色谱覆盖项全在包内
- ✅ Apple 主题 CSS block 完整在包内

### 产物

| 文件 | 大小 | 路径 |
|---|---|---|
| NSIS 安装包 | 73 MB | `client/release/DeerClaw Client Setup 0.1.0.exe` |
| 便携版 | 73 MB | `client/release/DeerClaw Client 0.1.0.exe` |
| 自动更新 blockmap | 80 KB | `client/release/DeerClaw Client Setup 0.1.0.exe.blockmap` |

---

## 经验教训

1. **minifier 会改写 CSS**：`::after` → `:after`（单冒号），`rgba(234,94,193,0.38)` → `#ea5ec161`（8 位 hex）。写打包验证脚本时正则要兼容两种形式，否则会有 90% 假阴性。
2. **`[data-theme=X]` 作用域是核心武器**：所有"主题内"视觉差异都应锁在 `[data-theme=X]` 选择器内，绝不污染其他主题。10 处 minimax 升级全部按此规则，0 误伤。
3. **`background-clip: text` 做渐变字**比手写 SVG 简单一个数量级；`-webkit-text-fill-color: transparent` + `background: var(--brand-spectrum)` + `background-clip: text` 三行搞定。
4. **spectrum 渐变角度选 100deg 而非 90deg**：正横条显得呆板，100deg 微微下倾有"流动"感，视觉上更"活"。
5. **品牌色谱在 chrome 上的用量是 5% 而非 50%**：刷满会显廉价；只在边、角、徽章、avatar 出现才是"高级感"。

---

## 后续 TODO（未做，但已识别）

- [ ] **【待开始】** Claude 主题 vs MiniMax 主题 — 应用密度对比
  - 描述：MiniMax 升级后比 Claude（仍是纯 token 替换）视觉密度高很多；下次可参考本轮"10 处锚点 + 品牌 token"思路给 Claude 主题也做"warm editorial signature"加料（如：slab-serif 标题临时降级到 Inter，serif 仅在 hero 出现）
  - 涉及文件：`client/web/index.css` `[data-theme="claude"]` 块 + 新增作用域覆盖

- [ ] **【待开始】** Apple 主题验证（实测视觉）
  - 描述：本轮 Apple 主题是按 apple.md 17 个 token 1:1 落地，但"museum-grade whitespace"和"Action Blue 单强调色纪律"需要在真实页面验证是否还显得"普通白页"——尤其是占大面积的侧边栏和主内容区，可能需要后续加少量特异性锚点（如 sidebar 顶 1px Action Blue 细线、btn 圆形 9999px 圆角等）
  - 涉及文件：跑 `client/release/DeerClaw Client Setup 0.1.0.exe` 实际看 5 套主题切换效果
  - 备注：headless 环境无法显示 GUI，需用户在桌面手动验证
