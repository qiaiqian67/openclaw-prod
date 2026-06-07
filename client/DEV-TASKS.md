# 客户端前端开发任务跟踪

> 跟踪 `client/web` 目录下**已完成**的开发任务，作为团队评审与回归参考。
> 配套详细文档：见 `client/DEV-NOTES-XXX.md` 系列。
> 用户面向变更：见根目录 `RELEASE_NOTES.md`。

## 当前进展

### ✅ 已完成（2026-06-07）

| 任务 ID | 标题 | 范围 | 详细记录 | 状态 |
|--------|------|------|----------|------|
| **P0-1** | 抽 IconButton 组件（统一可访问性） | 5 文件 + 1 新组件 | `DEV-NOTES-I18N-HARDENING.md` §1 | ✅ |
| **P0-2** | 7 处空 catch 升级为 toast 反馈 | 3 文件 | `DEV-NOTES-I18N-HARDENING.md` §2 | ✅ |
| **P0-3** | 修 3 个真·裸中文硬编码 | 3 文件 | `DEV-NOTES-I18N-HARDENING.md` §3 | ✅ |
| **P1-1** | i18n 顶层结构对齐 + 补 3 个 key | 2 个 JSON | `DEV-NOTES-I18N-HARDENING.md` §4 | ✅ |
| **P1-2** | 补 2 个 zh 缺值（timezone 错位修复） | `i18n/zh.json` | `DEV-NOTES-I18N-HARDENING.md` §5 | ✅ |
| **P1-3** | 给 29 个 zh-only key 加英文 | `i18n/en.json` | `DEV-NOTES-I18N-HARDENING.md` §6 | ✅ |
| **P2-1** | 补 80 个 zh 缺值 key（中文用户体验） | `i18n/zh.json` | `DEV-NOTES-I18N-HARDENING.md` §7 | ✅ |
| **V-1** | MyCompany 视觉重做（场景纵深 + 狐狸比例） | `index.css` + `MyCompany.tsx` | `DEV-NOTES-MYCOMPANY-REDESIGN.md` §1 | ✅ |
| **V-2** | MyCompany 区域边界升级（凸起感） | `index.css` | `DEV-NOTES-MYCOMPANY-REDESIGN.md` §1.2 | ✅ |
| **I-1** | MyCompany hover 详情卡片（1s 延迟 + 5 字段） | `MyCompany.tsx` `<AgentHoverCard>` | `DEV-NOTES-MYCOMPANY-REDESIGN.md` §2.1 | ✅ |
| **I-2** | MyCompany zone 点击过滤（4 区域按钮化） | `MyCompany.tsx` | `DEV-NOTES-MYCOMPANY-REDESIGN.md` §2.2 | ✅ |
| **I-3** | MyCompany 状态切换右键菜单（3 项 action） | `MyCompany.tsx` `<ContextMenu>` | `DEV-NOTES-MYCOMPANY-REDESIGN.md` §2.3 | ✅ |
| **I-4** | MyCompany 顶部搜索/过滤栏（搜索 + 状态 + 区域） | `MyCompany.tsx` `<CompanyToolbar>` | `DEV-NOTES-MYCOMPANY-REDESIGN.md` §2.4 | ✅ |
| **L-1** | 21 个新 i18n key 双语补全 | `i18n/en.json` + `i18n/zh.json` | `DEV-NOTES-MYCOMPANY-REDESIGN.md` §3 | ✅ |
| **C-1** | 删 CompanyToolbar 整块（搜索/过滤） | `MyCompany.tsx` | `DEV-NOTES-MYCOMPANY-ANIMATIONS.md` §1 | ✅ |
| **A-1** | 入场动画：狐狸依次走进 | `MyCompany.tsx` + `index.css` | `DEV-NOTES-MYCOMPANY-ANIMATIONS.md` §2 | ✅ |
| **A-2~4** | 角色微动：眨眼 + 耳朵抽 + 呼吸 | `<Fox>` SVG + `index.css` | `DEV-NOTES-MYCOMPANY-ANIMATIONS.md` §3 | ✅ |
| **A-5~7** | 环境氛围：光斑 + 尘埃 + 窗外云 | `<AmbientLayer>` + `index.css` | `DEV-NOTES-MYCOMPANY-ANIMATIONS.md` §4 | ✅ |
| **A-8~10** | 状态相关动画：打字 + 失联 + 错误 | `MyCompany.tsx` + `index.css` | `DEV-NOTES-MYCOMPANY-ANIMATIONS.md` §5 | ✅ |
| **X-1** | reduced-motion 黑名单扩展 | `index.css` | `DEV-NOTES-MYCOMPANY-ANIMATIONS.md` §6 | ✅ |
| **CF-1** | 拆 .login-card 容器 + front/back face JSX | `Login.tsx` | `DEV-NOTES-LOGIN-CARDFLIP.md` §1 | ✅ |
| **CF-2** | 移 tenantSelection 浮层到 wrapper 外 | `Login.tsx` | `DEV-NOTES-LOGIN-CARDFLIP.md` §2 | ✅ |
| **CF-3** | 翻面 handler + isFlipping state + ref | `Login.tsx` | `DEV-NOTES-LOGIN-CARDFLIP.md` §3 | ✅ |
| **CF-4** | aria + inert + focus 转移（a11y） | `Login.tsx` | `DEV-NOTES-LOGIN-CARDFLIP.md` §4 | ✅ |
| **CF-5** | grid stack 3D 翻转 CSS + reduced-motion 80ms | `styles/atlas.css` | `DEV-NOTES-LOGIN-CARDFLIP.md` §5 | ✅ |
| **CF-6** | 2 个 i18n key（serverSettings*） | `i18n/en.json` + `i18n/zh.json` | `DEV-NOTES-LOGIN-CARDFLIP.md` §6 | ✅ |

**累计**：
- 修改文件 15 个（5 个组件 + 4 个页面 + 2 个 i18n JSON + 1 个 CSS + 1 个新增页面逻辑改 + **1 个 atlas.css** + 1 个新增页面逻辑改）+ 2 新组件文件
- 新增文件 5 个（`IconButton.tsx` + `DEV-NOTES-I18N-HARDENING.md` + `DEV-NOTES-MYCOMPANY-REDESIGN.md` + `DEV-TASKS.md` + **`DEV-NOTES-LOGIN-CARDFLIP.md`**）
- i18n 总新增 key：117（I18N 轮）+ 21（MyCompany 轮）+ 2（Login 轮）= **140 个 key**
- **TypeScript** `tsc --noEmit` 0 错误
- **JSON** 合法
- **zh 模式 0 英文回退**，**en 模式 0 fallback**

### 📋 后续建议（未实施）

| 任务 ID | 标题 | 范围 | 优先级 |
|--------|------|------|--------|
| **P2-2** | 扫 JSX 文本节点中**未走 t() 的硬编码英文** | 全 web 目录 | 中 |
| **P2-3** | 扫 alert/confirm/dialog 中**直接传英文 message** | 全 web 目录 | 中 |
| **M-1** | 删 MyCompany 旧 `.fox-tooltip` CSS 块 | `index.css` | 低 |
| **M-2** | hover 详情卡片补 talking-to / last-task 字段 | 后端 agent session 接口 | 低 |
| **M-3** | 右键菜单补"复制名字/ID" | `MyCompany.tsx` | 低 |
| **N-1** | 狐狸走路贝塞尔 path 动画 | `MyCompany.tsx` | 低 |
| **N-2** | 休息区活动季节性 | `MyCompany.tsx` | 低 |
| **N-3** | 工位屏幕打字机效果 | `MyCompany.tsx` | 低 |
| **清理-A** | 7 个 toolbar 死 i18n key 可从 en/zh.json 删除 | `i18n/*.json` | 低（删了 toolbar 后没引用） |
| **清理-B** | 15 个死代码 zh-only key 可从 zh.json 删除 | `i18n/zh.json` | 低（已决定暂不清理） |

## 任务模板

新增任务时按以下格式追加到"已完成"区块：

```markdown
| **P{X}-{Y}** | 一句话标题 | 涉及文件数 | 详细记录链接 | ✅ |
```

## 文件清单（I18N 轮 + MyCompany 轮 + Login 轮）

### 新增
- `client/web/components/ui/IconButton.tsx` — 通用图标按钮组件
- `client/DEV-NOTES-I18N-HARDENING.md` — I18N 集中整改详细记录
- `client/DEV-NOTES-MYCOMPANY-REDESIGN.md` — MyCompany 视觉重做 + 交互增强记录
- `client/DEV-NOTES-MYCOMPANY-ANIMATIONS.md` — MyCompany 删 toolbar + 富动画记录
- `client/DEV-NOTES-LOGIN-CARDFLIP.md` — 登录页齿轮 → 卡片翻转记录
- `client/DEV-TASKS.md` — 本文件

### 修改（I18N 轮）
- `client/web/components/ChannelConfig.tsx` — placeholder i18n
- `client/web/components/CustomAgentModal.tsx` — IconButton
- `client/web/components/MarkdownRenderer.tsx` — IconButton × 5
- `client/web/components/PostHireSettingsModal.tsx` — IconButton + catch toast
- `client/web/components/TalentMarketModal.tsx` — IconButton
- `client/web/components/TitleBar.tsx` — i18n + IconButton
- `client/web/i18n/en.json` — +83 key（I18N 60 + MyCompany 21 + Login 2）
- `client/web/i18n/zh.json` — +114 key（I18N 91 + MyCompany 21 + Login 2）
- `client/web/pages/EnterpriseSettings.tsx` — catch toast
- `client/web/pages/Layout.tsx` — catch toast
- `client/web/pages/agent-detail/AgentDetailPage.tsx` — IconButton + 5 catch toast + 1 i18n

### 修改（MyCompany 轮 2 - 删 toolbar + 富动画）
- `client/web/pages/MyCompany.tsx` — 删 CompanyToolbar / 改 `<Fox>` 拆眼耳 group / 加 AmbientLayer / 加 hasEntered + typing/offline/error class
- `client/web/index.css` — 加 8 个 keyframe（眨眼/耳朵/呼吸/typing/offline/error/speck/dust/cloud）+ reduced-motion 扩展

### 修改（Login 轮 - 齿轮 → 卡片翻转）
- `client/web/pages/Login.tsx` — 拆 .login-card 容器 + front/back face / 移 tenantSelection 浮层 / 齿轮 + 箭头 onClick / aria + inert / onTransitionEnd + focus 转移
- `client/web/styles/atlas.css` — `.atlas-login-form-wrapper` 加 perspective 1200px / 新增 .login-card 用 grid stack + preserve-3d + transition 600ms / reduced-motion 80ms 降级


