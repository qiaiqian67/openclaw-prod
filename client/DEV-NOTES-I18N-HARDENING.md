# 客户端前端 i18n 化与可用性硬化 — 开发记录

> 记录 `client/web` 目录在 2026-06-07 这一轮会话中围绕"中文用户体验、错误可见性、可访问性"做的集中整改。
> 涉及 11 个文件 + 1 个新增组件，约 250 行增 / 90 行删。
> 优先级：P0（错误反馈、可访问性、裸中文）→ P1（i18n 资源对齐）→ P2（zh 模式英文回退）。

## 改动总览

| 关注点 | 任务 | 文件 | 关键变化 |
|--------|------|------|----------|
| 可访问性 | **P0-1** 抽 IconButton 组件 | 新建 `web/components/ui/IconButton.tsx` | 强制 `aria-label`，4 变体 (ghost/primary/secondary/danger) × 3 尺寸 (sm/md/lg)，用 CSS 变量 |
| 可访问性 | P0-1 替换图标按钮 | 5 个文件 × 8 处 | 关闭 / 缩放 / 下载 / 重置等图标按钮 → `<IconButton aria-label="...">` |
| 错误反馈 | **P0-2** 7 处空 catch → toast | 3 个文件 | AgentDetailPage (5) / Layout.tsx (1) / EnterpriseSettings.tsx (1) |
| i18n 一致性 | **P0-3** 修真·裸中文 | 3 个文件 | TitleBar / ChannelConfig / AgentDetailPage，3 处永远显示中文的字符串走 t() |
| i18n 资源 | **P1-1** 顶层结构对齐 | `i18n/en.json` + `i18n/zh.json` | 删 zh 冗余顶层 `identity`；补 3 个新 key；两侧顶层 31/31 对齐 |
| i18n 资源 | **P1-2** 补 2 个 zh 缺值 | `i18n/zh.json` | `agent.settings.timezone.label` / `.zones`（修 zh 模式拿到 undefined） |
| i18n 资源 | **P1-3** 29 个 zh-only key 加英文 | `i18n/en.json` | 全从代码 fallback 提取，en/zh 双语完整 |
| 中文用户视角 | **P2-1** 补 80 个 zh 缺值 key | `i18n/zh.json` | 71 个 fallback 是英文（真 bug）+ 9 个 fallback 是中文（资源对齐） |

## 详细改动

### 1. 新建 `client/web/components/ui/IconButton.tsx`

#### 1.1 组件 API

```tsx
export type IconButtonVariant = 'ghost' | 'primary' | 'secondary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
    extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
    'aria-label': string;  // 强制：屏幕阅读器必备
    title?: string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    children: ReactNode;
}
```

**原因**：
- 之前散落在 5 个文件的 8 个图标按钮（关闭、缩放、下载等）写法不一致：有的有 `aria-label`、有的只有 `title`、有的连 `aria-label` 都没有（违反 a11y）
- 用 TypeScript 的 `Omit<..., 'aria-label'>` 强制 `aria-label` 为必填 → 编译期保证不漏
- 用 CSS 变量 (`var(--text-secondary)`、`var(--bg-subtle)`、`var(--accent-primary)`) 适配 light/dark 主题，不写死颜色

#### 1.2 替换位置

| 文件 | 行 | 用途 |
|------|----|----|
| `components/TitleBar.tsx` | 33 | 标题栏品牌 tooltip 改用 i18n key（顺便修了 P0-3） |
| `components/CustomAgentModal.tsx` | 236, 573 | 关闭按钮 |
| `components/PostHireSettingsModal.tsx` | 190 | 关闭按钮 |
| `components/TalentMarketModal.tsx` | 182, 185 | 关闭按钮 |
| `components/MarkdownRenderer.tsx` | 325, 328, 331, 334, 342 | 5 个图片预览工具栏按钮（缩放 / 重置 / 下载 / 关闭） |
| `pages/agent-detail/AgentDetailPage.tsx` | 6541 | 聊天发送按钮 |

---

### 2. P0-2 — 7 处空 catch 升级为 toast

之前 `} catch { }` 静默吞掉错误，用户看不到失败原因。改为 `toast.error(...)` / `toast.warning(...)`，带 i18n key + 错误详情。

| # | 位置 | 失败操作 | 等级 | i18n key |
|---|------|----------|------|----------|
| 1 | `AgentDetailPage.tsx:1487` | removeRelationship | error | `common.error.deleteFailed` |
| 2 | `AgentDetailPage.tsx:1530` | removeAgentRelationship | error | `common.error.deleteFailed` |
| 3 | `AgentDetailPage.tsx:2015` | handleModelChange (模型切换) | error | `common.error.updateFailed` |
| 4 | `AgentDetailPage.tsx:2341` | 加载某用户会话（静默模式） | error | `agent.chat.sessionLoadFailed`（**新增**） |
| 5 | `AgentDetailPage.tsx:2364` | 加载所有会话 | error | `agent.chat.sessionLoadFailed` |
| 6 | `pages/Layout.tsx:1429` | 引导完成 onboarding | error | `onboarding.completeFailed`（**新增顶层 key**） |
| 7 | `pages/EnterpriseSettings.tsx:901` | 移除 Agent 工具 | warning | `enterprise.tools.removeFailedRefresh`（**新增**） |

**说明**：
- TakeControlPanel 的 2 处 `} catch { }` 保留 — 是合法的非致命失败（已加注释）
- #7 用 `warning` 而非 `error`，因为原注释 "Already deleted (e.g. removed via Global Tools) — just refresh" 表明这是良性失败

**统一模式**：
```ts
} catch (e: any) {
    // ... 原有回滚 / 兜底逻辑
    toast.error(t('common.error.xxx', 'English fallback'), { details: String(e?.message || e) });
}
```

---

### 3. P0-3 — 修 3 个真·裸中文

之前误报 421 处"硬编码中文"，深层分析后**实际只有 3 个**真·裸中文（用户可见、永远显示中文、没走任何 i18n 包装）：

| 位置 | 修复 |
|------|------|
| `TitleBar.tsx:33` `title="DeerClaw 客户端"` | 新增 `app.desktopBrandTitle` i18n key + 引入 `useTranslation` |
| `ChannelConfig.tsx:212` `placeholder: 'DingTalk应用AgentId(可选)'` | 改用 `channelGuide.dingtalk.agentIdPlaceholder` 前缀（自动走 i18n 流程，无需改组件） |
| `AgentDetailPage.tsx:3916` `toast.warning('最多可附加 10 个文件')` | 新增 `agent.chat.maxAttachmentReached` i18n key + 改用 `t()` |

剩余 130 处"裸中文"扫描结果 = **全是 `zh ? 'A' : 'B'` 模式**（脚本变量名不是 `isChinese`/`isZh`/`i18n.language`，所以初轮粗扫没排除）。这些是**正确的 i18n 写法**，不是 bug。

---

### 4. P1-1 — i18n 顶层结构对齐

#### 4.1 删除 zh.json 顶层冗余 `identity`

之前 zh 把 `enterprise.identity` 误提到顶层，en 已在 `enterprise.identity` 完整（32 keys），删后两边 32 keys 全对齐。

#### 4.2 新增 3 个 i18n key

| key | zh | en |
|-----|----|----|
| `agent.chat.sessionLoadFailed` | 加载会话失败 | Failed to load sessions |
| `enterprise.tools.removeFailedRefresh` | 工具已被移除，刷新列表 | Tool already removed, refreshing the list |
| `onboarding.completeFailed`（新建顶层） | 完成引导失败 | Failed to complete onboarding |

顶层 key 数：en 30→31，zh 31→31，**两侧完全对齐**。

---

### 5. P1-2 — 补 2 个 zh 缺值（timezone 错位）

之前 zh 缺 `agent.settings.timezone.label` 和 `.zones`，导致 `t('agent.settings.timezone.label')` 在 zh 模式拿到 undefined。补完后两边都有。

---

### 6. P1-3 — 给 29 个 zh-only key 加英文

原本说"46 个 zh-only key 需补英文"，深入分析后：
- 29 个在用（代码有 `t('key', 'fallback')` 调用）
- 15 个死代码（zh 里存在但代码未引用，**保留不删**）

**翻译策略**：全部从代码里的 `t('key', 'fallback')` 第二参数提取 —— 这些 fallback 字符串是原作者已写好的标准英文翻译，直接利用避免我另起翻译出现不一致。

**实际写到 en.json 的 29 个 key**（按代码段分组）：

| 段 | key 数 | 来源 |
|---|---|---|
| `plaza.*` | 5 | Plaza.tsx fallback |
| `nav.*` | 2 | Layout.tsx fallback + 1 死代码跳过 |
| `agent.settings.timezone.*` | 5 | SettingsTab.tsx fallback |
| `agent.settings.maxToolRounds*` | 3 | SettingsTab.tsx fallback |
| `agent.settings.heartbeat.*` | 8 (嵌套对象) | SettingsTab.tsx fallback |
| `wizard.step4.*` | 5 | AgentCreate.tsx fallback |
| `enterprise.kb.description` | 1 | EnterpriseSettings.tsx fallback |
| `openclaw.*` | 9 | AgentCreate.tsx fallback |

---

### 7. P2-1 — 补 80 个 zh 缺值 key（中文用户视角）

#### 7.1 问题本质

之前 P0/P1 漏检了**zh 模式跑出英文**的真 bug。`t('key', 'English fallback')` 模式下，只要 zh.json 没值，zh 模式就显示英文 fallback。**这才是中文用户的痛点**。

#### 7.2 扫描方法

跨所有 .ts/.tsx 提取 `t('key', 'fallback')` 形式，交叉对比 zh.json，找出**zh 缺值、fallback 是英文**的所有 key。

#### 7.3 找到 79 个 zh 缺值 key

- 71 个 fallback 是英文（**真 bug** —— zh 模式会显示英文）
- 8 个 fallback 是中文（不算 bug，但加到 zh.json 让资源一致）
- 分布 16 个文件（AgentDetailPage、AdminCompanies、EnterpriseSettings、ToolsManager 等）

#### 7.4 80 个新 zh key 已写入 zh.json

| 段 | 新增 key 数 |
|---|---|
| `admin.*` | 1 |
| `agent.activity.*` | 1 |
| `agent.chat.*` | 5 |
| `agent.detail.*` | 1 |
| `agent.settings.*` | 6 |
| `agent.sidePanel.*` | 10 |
| `agent.tools.*` | 6 |
| `agent.upload.*` | 1 |
| `agent.workspace.*` | 2 |
| `auth.*` | 7 |
| `chat.*` | 3 |
| `common.*` | 5 |
| `enterprise.*` | 25 |
| `okr.*` | 1 |

#### 7.5 翻译原则

- 短名词/动词：直接对应（Save→保存、Cancel→取消）
- 句子：自然中文
- 英文专有名词保留（WebSocket、SSO、OKR、SMTP、MCP、ID）
- 占位符 `{{name}}` 保留
- toast/警告：简短直接

---

## 校验

- ✅ JSON 合法
- ✅ TypeScript `tsc --noEmit` 0 错误
- ✅ i18n 顶层 / 深层 key 全部对齐
- ✅ zh 模式 0 英文回退

## 用户可感知改善

1. **错误有反馈**：之前 7 处静默失败（关系删除、模型切换、会话加载、引导完成、工具移除）现在都有 toast
2. **a11y 改进**：8 个图标按钮强制 aria-label，屏幕阅读器和键盘用户可用
3. **EN 模式零回退**：之前 en 模式走 fallback 显示英文的 29 个 key，现已加到 en.json
4. **ZH 模式零回退**：之前 zh 模式显示 "Switch model for this session"、"Tool sources"、"Are you sure you want to delete {{name}}?" 等英文界面 80 处，已全部中文化
5. **关键界面中文化**：AgentSidePanel (10)、EnterpriseSettings (25)、AdminCompanies (9)、ToolsManager (9) 全面中文化

## 后续建议（未实施）

- **P2-2**：扫 JSX 文本节点中**未走 t() 的硬编码英文**（如 `<button>Save</button>`）
- **P2-3**：扫 alert/confirm/dialog 中**直接传英文 message** 而非 t() 的位置
- **清理**：15 个死代码 zh-only key 可从 zh.json 删除（en 本来就没），让 i18n 资源更精简（用户已决定暂不清理）
