# MyCompany 视觉重做 + 交互增强 — 开发记录

> 记录 `client/web/pages/MyCompany.tsx` 与 `client/web/index.css` 在 2026-06-07 这一轮围绕"办公场景视觉质量 + 用户交互"做的集中整改。
> 涉及 2 个文件 + 2 个 i18n JSON，约 +430 / -30 行。
> 方向：视觉重做 + 4 项新交互 + 保留现有动画 / 数据策略。

## 改动总览

| 关注点 | 任务 | 文件 | 关键变化 |
|--------|------|------|----------|
| 视觉 | **V-1** 透视地面 | `index.css` `.my-company-scene` | 加双层重复线性渐变网格 + 底部光晕；场景有"地板"纵深感 |
| 视觉 | **V-2** 区域边界升级 | `index.css` `.my-company-zone` | 1px dashed → 1px solid + 双层 inset box-shadow |
| 视觉 | **V-3** 区域标签可点击 | `index.css` + `MyCompany.tsx` | `<span>` → `<button>`，加 hover/active 样式，filter 状态可见 |
| 视觉 | **V-4** Fox 比例重做 | `MyCompany.tsx` `<Fox>` SVG | 头大身短（ry 10→8）、尾巴弧度加大、所有形状加 1.4px `var(--ink)` 描边 |
| 视觉 | **V-5** Fox 眼睛有神 | `MyCompany.tsx` `<Fox>` SVG | 单层黑点 → 双层（外圈深 + 内圈白点） |
| 视觉 | **V-6** Fox 抬起反馈 | `index.css` `.fox-agent:hover` | 加 4px translateY + drop-shadow 加深 |
| 交互 | **I-1** hover 详情卡片 | `MyCompany.tsx` `<AgentHoverCard>` | 1s 延迟后显示，跟随光标；含名字/状态/角色/最近活跃/到期 |
| 交互 | **I-2** zone 点击过滤 | `MyCompany.tsx` zone label `onClick` | 4 个区域标签都是按钮，点 → 切换 zoneFilter；再点 → 恢复 |
| 交互 | **I-3** 状态切换右键菜单 | `MyCompany.tsx` `<ContextMenu>` + `onContextMenu` | 三项：发送消息/查看详情/切换状态（用 queryClient 乐观更新） |
| 交互 | **I-4** 顶部搜索/过滤栏 | `MyCompany.tsx` `<CompanyToolbar>` | 搜索框（200ms debounce）+ 状态下拉 + 区域下拉 + 清空按钮 |
| 保留 | 5s 轮询 | `useQuery` `refetchInterval: 5000` | 不变 |
| 保留 | 14s 休息活动切换 | `useEffect setInterval 14000` | 不变 |
| 保留 | 1.3s 区域切换动画 | `transition: left/top 1.2s` | 不变 |
| 保留 | 手写 SVG | 不抽 sprite | 不变 |
| i18n | **L-1** 21 个新 key | `i18n/en.json` + `i18n/zh.json` | `myCompany.zoneFilterHint` / `.noRole` / `.card.*` (4) / `.menu.*` (3) / `.toolbar.*` (7) / `.statusLabel.*` (5) |

---

## 详细改动

### 1. 视觉重做（CSS 为主，少量 SVG 微调）

#### 1.1 透视地面

```css
.my-company-scene {
  background:
    repeating-linear-gradient(90deg, ... 1px, transparent 1px 60px),  /* 垂直细线 */
    repeating-linear-gradient(0deg, ... 1px, transparent 1px 80px),   /* 水平细线 */
    radial-gradient(ellipse at 50% 110%, ..., transparent 60%),         /* 底光 */
    ...
    var(--bg-secondary);
}
.my-company-scene::before {
  /* 顶亮 + 底暗，模拟顶光 */
  background: linear-gradient(180deg,
    color-mix(in srgb, #ffffff 4%, transparent) 0%,
    transparent 30%, transparent 70%,
    color-mix(in srgb, #000000 6%, transparent) 100%);
}
```

**效果**：场景有"办公室地板"感，纵深从顶到底。配合 zone 的 inset shadow，区域像"地毯"贴在地面上。

#### 1.2 区域边界升级

旧：1px dashed，颜色淡，几乎看不到。
新：

```css
.my-company-zone {
  border: 1px solid color-mix(in srgb, var(--border-default) 60%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--bg-elevated) 40%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--bg-elevated) 30%, transparent);
}
```

**效果**：边界实线化 + 双层 inset 形成"凸起"感，区域像独立的"地毯"。

#### 1.3 Fox 比例重做

| 部位 | 旧 | 新 |
|------|----|----|
| 头椭圆 ry | 12 | 12.5（圆形感更强） |
| 身体 ry | 10 | 8（缩短 20%） |
| 脸型 path | 较方 | 略圆（q 值增大） |
| 眼睛 | 单层 r=1.3 黑 | 双层 r=1.5 黑 + r=0.5 白点 |
| 尾巴 | 弧度小 | `q12 -4 12 -16` 弧度加大、上翘 |
| 描边 | 无 | 全部加 `stroke="var(--ink, #1f1b16)"` 1.2-1.4px |

**效果**：狐狸有"卡通主角"感，不再像贴纸。

#### 1.4 Fox 抬起反馈

```css
@media (hover: hover) {
  .fox-agent:hover {
    transform: translate(-50%, calc(-100% - 4px));  /* 抬起 4px */
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.18));
  }
}
```

仅在有 hover 能力的设备生效，触摸设备不受 translateY 影响（避免抖动）。

---

### 2. 4 项新交互

#### 2.1 hover 详情卡片（I-1）

- 状态：`hovered` (string|null) + `hoverPos` ({x,y}|null) + `hoverShown` (bool, 1s 延迟)
- 逻辑：mouseenter → setHovered + setHoverPos → 1s 后 setHoverShown(true) → 渲染 `<AgentHoverCard>`
- 卡片内容：name / status（走 t('myCompany.statusWorking') 等）/ role / last active / expires
- 定位：`position: fixed; left/top = clientX/Y; transform: translate(12px, 12px)` 偏移
- 旧 `.fox-tooltip` 替代，不再每只狐狸一个 tooltip，全部共享一个跟随卡

#### 2.2 zone 点击过滤（I-2）

- 状态：`zoneFilter` (Zone|null)
- UI：4 个 zone label 改成 `<button class="my-company-zone-label--clickable">`
- 点击：相同 zone → 切回 null；不同 zone → 切到新 zone
- 视觉：active 状态用 `background: var(--accent-primary); color: #fff`
- 过滤：`filteredPlacements` 中 `if (zoneFilter && p.zone !== zoneFilter) return false`
- 提示：title="点击只看该区域"（i18n key: `myCompany.zoneFilterHint`）

#### 2.3 状态切换右键菜单（I-3）

- 状态：`contextMenu` ({x, y, agent}|null)
- 触发：`<button onContextMenu={e => { e.preventDefault(); setContextMenu(...) }}>`
- 浮层：`<ContextMenu pos agent onClose onAction>`，使用 `position: fixed` + z-index: 1001
- 三项 action：
  - `message` → `onAgentClick(id)` → 跳对话
  - `detail` → `navigate('/agents/${id}')` → 跳详情
  - `status` → 乐观更新 `queryClient.setQueryData` 切换 status（running↔idle）+ invalidate
- 关闭：全局 `click` / `scroll` (capture) 监听；菜单本身 `onClick={e => e.stopPropagation()}`

#### 2.4 顶部搜索/过滤栏（I-4）

- 组件：`<CompanyToolbar searchInput onSearchChange statusFilter onStatusChange zoneFilter onZoneFilterChange statusOptions zoneOptions onClear />`
- 搜索框：`<input type="search">` + `useEffect setTimeout 200ms` debounce
- 状态下拉：从当前 agents 提取出现过的 status（避免出现不存在的选项）
- 区域下拉：固定 4 个 zone
- 清空按钮：仅在有过滤时显示
- 过滤：`filteredPlacements` 中同时应用 search/status/zone

---

### 3. i18n 双语补全

新增 21 个 key，全部 en+zh 同步写入：

| 段 | key | en | zh |
|----|-----|----|----|
| `zoneFilterHint` | 1 | Click to filter to this zone | 点击只看该区域 |
| `noRole` | 1 | General | 通用 |
| `card.*` | 4 | Status / Role / Last active / Expires | 状态 / 角色 / 最近活跃 / 到期 |
| `menu.*` | 3 | Send message / View details / Toggle status | 发送消息 / 查看详情 / 切换状态 |
| `toolbar.*` | 7 | Search placeholder / Aria labels / All * / Clear filters | 对应中文 |
| `statusLabel.*` | 5 | Running / Idle / Stopped / Error / Onboarding | 运行中 / 空闲 / 已停止 / 异常 / 创建中 |

---

## 风险与控制

- **性能**：4 项交互全部挂 state，但 placements 仍由 `useMemo` 缓存；`filteredPlacements` 单独 memo；搜索 200ms debounce 避免每帧 setState
- **样式回归**：改 `.my-company-zone` 加 inset shadow，桌面 padding 仍是 0，未影响工位定位（positions 用 `transform: translate(-50%, -50%)`）
- **i18n 完整性**：新文案 100% 走 t()，新增 key 同时 en+zh
- **可访问性**：
  - 旧 `fox-tooltip` 没键盘路径；新 `AgentHoverCard` 通过 `onFocus` 也能触发
  - zone label 改 button 后可 Tab + Enter
  - 工具栏有 `aria-label`

---

## 校验

- ✅ TypeScript `tsc --noEmit` 0 错误
- ✅ `npm run build` 成功（MyCompany 包 33.29 kB / gzip 8.49 kB）
- ✅ JSON 合法（en.json +98 行 / zh.json +212 行都是新增 key，无意外重写）

## 用户可感知改善

1. **场景有纵深**：透视地面 + 区域凸起 + 顶光，告别"平面贴图"
2. **狐狸更立体**：头大身短 + 描边 + 神态眼 + 上翘尾巴
3. **hover 不再是空 tooltip**：1s 后浮出 5 项数据卡，含角色 + 最近活跃时间
4. **点区域就是过滤**：4 个标签都变按钮，active 态高亮
5. **右键快操作**：发消息/看详情/切状态三个常用动作
6. **顶部工具栏**：实时搜索 + 状态 + 区域三向过滤

## 后续建议（未实施）

- **M-1**：把 `fox-tooltip` 旧 CSS 删掉（已无引用，但 CSS 块仍在）
- **M-2**：详情卡片可加 `talking to X` / `last task` 等更多字段（数据需后端补 agent session 接口）
- **M-3**：右键菜单可加"复制名字" / "复制 ID" 等小工具
