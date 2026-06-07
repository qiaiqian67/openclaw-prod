# 登录页齿轮 → 卡片翻转 — 开发记录

> 记录 `client/web/pages/Login.tsx` + `client/web/styles/atlas.css` + `client/web/i18n/{en,zh}.json` 在 2026-06-07 这一轮围绕"齿轮点击 → 整张登录卡片水平翻面"的改造。
> 方向：用户希望点齿轮触发**卡片翻转**效果，而非之前 inline 展开服务器设置块。
> 涉及 3 个文件 + 1 个 DEV-NOTES，约 +180 / -70 行。

## 改动总览

| 关注点 | 任务 | 文件 | 关键变化 |
|--------|------|------|----------|
| JSX | **CF-1** 拆卡片结构 | `Login.tsx` | 新增 `.login-card` 容器 + `.login-card-face--front` / `--back` 两面，正面装现有登录内容，背面装服务器设置 |
| JSX | **CF-2** 移 tenantSelection 浮层 | `Login.tsx` | 多租户选择浮层从 `.atlas-login-form-wrapper` 内部移到外部同层，避免被卡片 3D transform 误作 containing block 跟着翻 |
| 状态 | **CF-3** 翻面 handler + 状态 | `Login.tsx` | `isFlipping` state + `frontFaceRef` / `backFaceRef` + `handleCardTransitionEnd` / `openServerSettings` / `closeServerSettings` 三个函数 |
| 可访问性 | **CF-4** aria + inert + focus 转移 | `Login.tsx` | 齿轮加 `aria-expanded` / `aria-controls` / `aria-label`；返回箭头同样；两 face 加 `aria-hidden` + React 19 `inert`；翻转结束 focus 目标面第一个 input |
| CSS | **CF-5** grid stack 3D 翻转 | `atlas.css` | `.atlas-login-form-wrapper` 加 `perspective: 1200px`；`.login-card` 用 `display: grid; grid-template-areas: "stack"` 让两 face 重叠；`[data-flipped]` → `rotateY(180deg)`；`reduced-motion` → 80ms 瞬切 |
| i18n | **CF-6** 2 个新 key | `i18n/{en,zh}.json` | `auth.serverSettingsTitle` / `auth.serverSettingsSubtitle`（zh.json 已有 `auth.backToLogin`） |

---

## Context

`Login.tsx` 右上角的小齿轮（`IconSettings`，原 line 501-511）原本点击后只是 inline 展开一个服务器设置块（line 528-581），挤在登录表单与错误提示之间，把登录表单往下推。视觉上像"插件"，没有"切换"语义。

用户希望：**点击齿轮 → 整张登录卡片沿水平轴翻面**，翻到背面看服务器设置；背面提供"← 返回"箭头，点击再翻回登录表单。沿用现有 atlas 主题（paper/night，hairline 描边），保留所有现有 state（不重置用户已输入的 serverUrl/wsUrl/updateUrl）。

**关键决策**（与用户确认）：
- 翻转轴向：水平 `rotateY 180°`
- 背面按钮：换成 `IconArrowLeft` "← 返回"（不保留齿轮）
- 服务器字段保留在 React 顶层 state（不重置）

---

## 详细改动

### 1. JSX 拆卡片结构（CF-1）

**新结构**（`.atlas-login-form-wrapper` 内部）：

```
.atlas-login-form-wrapper  (atlas.css, perspective: 1200px, 不动 transform)
  └─ .login-card  (data-flipped / data-flipping / onTransitionEnd)
       ├─ .login-card-face--front   (ref, aria-hidden, inert)
       │     ├─ form-header (齿轮)
       │     ├─ {error}
       │     ├─ {successMessage}
       │     ├─ SSO 区
       │     ├─ OAuth 区
       │     ├─ form (登录/注册/验证)
       │     └─ {!showVerification && login-switch}
       └─ .login-card-face--back    (ref, aria-hidden, inert)
             ├─ form-header (← 返回箭头)
             ├─ API URL input
             ├─ WebSocket URL input
             ├─ Update URL input
             └─ 保存按钮
```

**检查邀请邮箱 loading 状态**（`checkingEmail === true`）保留在 `.login-card` 内部但在 face 之外（loading 时不翻转，仅居中显示 spinner）。

### 2. tenantSelection 浮层移出 wrapper（CF-2）

**原位置**：`<div className="atlas-login-form-wrapper">…<多租户浮层>…</div>`

**新位置**：`<div className="atlas-login-form-wrapper">…</div>` + `<多租户浮层>`（同层、wrapper 之外、`.atlas-screen-form` 之内）

**为什么必须移出**：`tenantSelection` 是 `position: fixed` 浮层。一旦 `.login-card` 带 `transform: rotateY(180deg)`，fixed 定位的后代会以最近的 transform 祖先作为 containing block，**整个浮层会跟着卡片 3D 翻转扭曲**（半透明 + 翻转 180° 后用户看到一个镜像的 modal）。

移到 wrapper 之外后，浮层的 fixed 定位解析到 viewport，不被 3D 影响。

### 3. 状态与 handler（CF-3）

```ts
const frontFaceRef = useRef<HTMLDivElement>(null);
const backFaceRef = useRef<HTMLDivElement>(null);
const [isFlipping, setIsFlipping] = useState(false);

const handleCardTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;       // 只关心 .login-card 自身
    if (e.propertyName !== 'transform') return;
    setIsFlipping(false);
    // 翻面后焦点送过去 —— 屏幕阅读器 / 键盘用户都能跟上
    const target = showServerSettings ? backFaceRef.current : frontFaceRef.current;
    const firstInput = target?.querySelector<HTMLElement>('input, button, [tabindex]');
    firstInput?.focus();
};

const openServerSettings = () => {
    setError('');                                    // 清掉正面的反馈
    setSuccessMessage('');
    setIsFlipping(true);
    setShowServerSettings(true);
};

const closeServerSettings = () => {
    setIsFlipping(true);
    setShowServerSettings(false);
};
```

**为什么 `e.target !== e.currentTarget`**：CSS transition 在子元素上也会触发（如果子元素也有 transform 过渡）。这里只关心 `.login-card` 自身的 transform 事件，过滤子元素冒泡上来的同名事件。

**为什么 `e.propertyName !== 'transform'`**：浏览器在 transform 过渡结束时可能同时触发其他属性的 transitionend 事件（虽然这里只有 transform，过滤更稳）。

### 4. 可访问性（CF-4）

| 元素 | 新增属性 | 原因 |
|------|----------|------|
| 齿轮按钮 | `aria-expanded={showServerSettings}` | 告诉屏幕阅读器面板当前是否展开 |
| 齿轮按钮 | `aria-controls="login-server-settings"` | 关联到背面的 id |
| 齿轮按钮 | `aria-label={t('auth.serverSettingsTitle', 'Server Settings')}` | 原代码只有 `title`，缺 aria 标签 |
| 返回按钮 | `aria-expanded={!showServerSettings}` | 镜像齿轮 |
| 返回按钮 | `aria-label={t('auth.backToLogin', 'Back to login')}` | 镜像齿轮 |
| front face | `aria-hidden={showServerSettings \|\| undefined}` | 翻到背面时屏幕阅读器跳过正面 |
| back face | `aria-hidden={!showServerSettings \|\| undefined}` | 翻回正面时屏幕阅读器跳过背面 |
| front/back face | `inert={... \|\| undefined}` | React 19 支持：阻止 Tab 进入 + 屏蔽辅助技术（比 aria-hidden 更强） |
| `.login-card` | `onTransitionEnd` 后 `.focus()` | 翻面后焦点自动跳到目标面第一个 input |

`inert` 是关键 — `aria-hidden` 只能阻止屏幕阅读器朗读，但 Tab 仍能进入；`inert` 同时阻止 pointer / focus / AT。

### 5. CSS grid stack 3D 翻转（CF-5）

**为什么用 grid stack 而不是 position: absolute**：

最初方案用 `.login-card-face { position: absolute; inset: 0; min-height: 480px; overflow-y: auto }`，用户反馈"不能出现滚动条，不能破坏原布局" — 强制 `min-height: 480px` 会让卡片比原 form 还高；`overflow-y: auto` 在内容超 480px 时出现滚动条；face 用 absolute 强撑 480px 而不跟内容走。

修正方案：**grid stack**。

```css
.atlas-login-form-wrapper {
    perspective: 1200px;             /* 仅提供视点，本身不动 */
    perspective-origin: center;
}

.login-card {
    display: grid;
    grid-template-areas: "stack";
    transform-style: preserve-3d;
    transition: transform 600ms cubic-bezier(0.4, 0, 0.2, 1);
    /* 不设 min-height / overflow / height */
}
.login-card > * {
    grid-area: stack;                /* 所有子项共享同一 grid cell */
}
.login-card[data-flipped="true"] {
    transform: rotateY(180deg);
}
.login-card[data-flipping="true"] .login-card-face {
    pointer-events: none;            /* 翻转中锁住指针，防点穿 */
}
.login-card-face {
    display: flex;
    flex-direction: column;
    gap: 16px;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transform: rotateY(0);
    /* 不设 position: absolute / overflow / min-height */
}
.login-card-face--back {
    transform: rotateY(180deg);      /* 初始就翻过去 */
}

@media (prefers-reduced-motion: reduce) {
    .login-card {
        transition: transform 80ms linear;  /* 视觉上瞬切，状态机保留 */
    }
}
```

**grid stack 行为**：
- 两 face 共享同一 grid cell，自然重叠
- grid 行高 = `max(两 face 内容自然高度)`（grid 子项默认 stretch 到 max）
- `.login-card` 高度自适应：**翻面时高度不变**（取两 face max），不抖动
- 不设 overflow → 任何场景下都不出滚动条
- 不设 min-height → 不破坏原布局

**perspective 不能与 transform 同元素**：`.atlas-login-form-wrapper` 提供 perspective（1200px），自身不动；`.login-card` 才动 transform。否则 3D 折叠成平面翻转。

**reduced-motion 不切到 display: none**：保留 `data-flipped` 状态 + transform，把 transition 压到 80ms。状态机（aria-hidden / inert）也保留，a11y 不丢。

### 6. i18n（CF-6）

| key | zh | en |
|---|---|---|
| `auth.backToLogin` | 返回登录 | Back to login（已有） |
| `auth.serverSettingsTitle` | 服务器设置 | Server Settings |
| `auth.serverSettingsSubtitle` | 配置后端 API、WebSocket 与更新服务器地址。 | Configure backend API, WebSocket and update server URLs. |

背面标题 + 副标题都走 `t('auth.serverSettingsTitle', isZh ? '...' : '...')` + 硬编码 fallback，zh 模式下 0 英文回退。

---

## 风险与控制

- **grid 子项 3D 上下文**：grid 容器默认 2D context，子项的 transform-style 默认 flat。在 `.login-card` 上设 `transform-style: preserve-3d`，子项 rotateY 保留 3D 效果，backface-visibility 正常工作
- **多租户浮层被翻面扭曲**：CF-2 移出 wrapper 解决
- **error / successMessage 跨面**：齿轮 onClick 翻面前清空
- **iOS Safari 兼容性**：grid 子项 + 3D transform 在老 Safari 有 bug，DeerClaw 客户端是 Electron 桌面端（Chromium 内核），不受影响
- **verification 模式翻面 UX**：不特殊处理。verification 模式点齿轮是允许的（用户可能就是要改服务器地址后重新验证），返回时 verification 状态保留
- **i18n 一致性**：新文案 100% 走 t() + 硬编码 fallback

---

## 校验

- ✅ TypeScript `tsc --noEmit` 0 错误
- ✅ `npm run build` 成功（Login 包 22.38 → 23.73 kB / gzip 7.36 kB，+1.35 kB）
- ✅ JSON 合法
- ✅ Vite dev server 跑过，编译输出 Login.tsx 含 `login-card / --front / --back` + 所有 a11y 属性
- ⚠️ **视觉回归**：没 GUI 浏览器直接看 3D 翻转效果，但代码层一切就绪；用户跑 `npm run electron:dev` 看齿轮点击翻面

---

## 用户可感知改善

1. **齿轮触发卡片翻转**：600ms 水平 `rotateY 180°`，最稳的"翻牌"语义
2. **服务器设置变成独立面**：不再挤占登录表单空间，面板内容可独立滚动（虽然实际不需要）
3. **背面"← 返回"箭头**：点击翻回登录表单，输入的 email/password 字段值保留
4. **焦点自动跟随**：翻面后焦点跳到目标面第一个 input，键盘 / 屏幕阅读器用户能跟上
5. **Tab 不会穿过到非活跃面**：`inert` 阻止 Tab / click / focus 进入被翻走的面
6. **不破坏原布局**：grid stack 高度自适应，翻面时高度不变，不抖动
7. **不出现滚动条**：face 不设 `overflow-y: auto`，不设 `min-height`
8. **reduced-motion 友好**：80ms 瞬切，保留 3D 状态机

---

## 后续建议（未实施）

- **CF-A1**：翻面时加一道光带扫过（CSS animation + mask-image）增加"翻牌"质感
- **CF-A2**：保存成功后，背面 input 加一个 check 图标短暂亮起
- **CF-A3**：齿轮在 idle 状态加 30s 周期缓慢旋转动画，暗示"可点"
- **CF-A4**：背面"配置后端"标题可加一个副标题让用户知道这是给客户端自托管用：zh = "桌面客户端连接后端的设置项，不影响 Web 端"
- **CF-B1**：Onboarding 页面（`/onboarding`）的 step 转换加 fade/slide 转场，UniverseMap 出现加旋转入场
- **CF-B2**：`App.tsx` 的 `ProtectedRoute` 增加 `personal_assistant_agent_id` 状态检查 — 未完成的用户强制跳 `/onboarding`，绕过 `/plaza`
