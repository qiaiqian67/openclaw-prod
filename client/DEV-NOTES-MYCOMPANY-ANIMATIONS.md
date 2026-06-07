# MyCompany 删搜索过滤 + 4 类动画 — 开发记录

> 记录 `client/web/pages/MyCompany.tsx` 与 `client/web/index.css` 在 2026-06-07 围绕"删工具栏 + 富化动画"做的改造。
> 方向：用户要求删搜索/过滤 → 4 类动画填充（角色微动 / 环境氛围 / 状态相关 / 入场）。
> 涉及 2 个文件，CSS + 大约 +260 / -90 行。

## 改动总览

| 关注点 | 任务 | 文件 | 关键变化 |
|--------|------|------|----------|
| 清理 | **C-1** 删 CompanyToolbar 整块 | `MyCompany.tsx` | 删组件定义 + 8 个 state/effect（searchInput/searchQuery/statusFilter/debounce/options） |
| 清理 | **C-2** 简化 filteredPlacements | `MyCompany.tsx` | 移除 search/status 过滤条件，只剩 zone 过滤 |
| 入场 | **A-1** 入场动画 | `MyCompany.tsx` + `index.css` | `hasEntered` state，初始 left: -15% / 60ms 后切真实 slot，stagger 60ms/只 |
| 角色 | **A-2** 眨眼 | `<Fox>` + `index.css` | 眼睛 group 单独包裹，scaleY 0.1/5s 周期，agentId hash 给随机相位 |
| 角色 | **A-3** 耳朵抽 | `<Fox>` + `index.css` | 耳朵 group 单独包裹，rotate 8°/8s 周期，相位错开 |
| 角色 | **A-4** 呼吸 | `<Fox>` + `index.css` | body 缩放 1.018/3.5s 周期，与走路 bob 叠加 |
| 环境 | **A-5** 光斑 | `<AmbientLayer>` + `index.css` | 4 个彩色径向渐变圆点，集中在 work 区，5.5s 脉冲 |
| 环境 | **A-6** 尘埃 | `<AmbientLayer>` + `index.css` | 6 个白点，18-24s 上升+水平漂移，模拟空气感 |
| 环境 | **A-7** 窗外云 | `<AmbientLayer>` + `index.css` | 2 朵云在 office 区域上方飘过，22-30s 周期 |
| 状态 | **A-8** 打字震动 | `fox-agent--typing` | work+running 时 body X 抖动 0.18s steps，模拟击键 |
| 状态 | **A-9** 失联抖动 | `fox-agent--offline` | work+running+offline 时周期性整体抖动 + 灰度 0.6 |
| 状态 | **A-10** 错误脉冲 | `fox-agent--error` | error 时灰色 + 红色 drop-shadow 脉冲 1.6s |
| A11y | **X-1** reduced motion | `index.css` | 把 8 个新动画 keyframe 加入 `prefers-reduced-motion: reduce` 黑名单 |

---

## 详细改动

### 1. 清理：删 CompanyToolbar

**删了什么**：
- `<CompanyToolbar>` 函数组件（66 行 JSX）
- `searchInput` / `searchQuery` / `statusFilter` 三个 state
- 200ms debounce `useEffect`
- `statusOptions` / `zoneOptions` 两个 useMemo
- JSX 中 `<CompanyToolbar ... />` 调用

**留了什么**：
- `zoneFilter` + 4 个 zone label 的 onClick（zone 点击过滤）
- `filteredPlacements`（简化后只剩 zone 条件）

**对比**：

```diff
- const filteredPlacements = useMemo(() => {
-   return placements.filter((p) => {
-     if (zoneFilter && p.zone !== zoneFilter) return false;
-     if (searchQuery && !(p.agent.name || '').toLowerCase().includes(searchQuery)) return false;
-     if (statusFilter && p.agent.status !== statusFilter) return false;
-     return true;
-   });
- }, [placements, zoneFilter, searchQuery, statusFilter]);
+ const filteredPlacements = useMemo(() => {
+   if (!zoneFilter) return placements;
+   return placements.filter((p) => p.zone === zoneFilter);
+ }, [placements, zoneFilter]);
```

### 2. 入场动画（A-1）

**思路**：复用现有 `transition: left/top 1.2s`，加 `hasEntered` state 控制初始/最终位置。

```tsx
const [hasEntered, setHasEntered] = useState(false);
useEffect(() => {
  const id = window.setTimeout(() => setHasEntered(true), 60);
  return () => clearTimeout(id);
}, []);

// render:
const displaySlot = hasEntered
  ? p.slot
  : { left: -15, top: 80 + (idx % 4) * 4 };
const enterDelay = hasEntered ? 0 : idx * 60;

<button style={{
  left: `${displaySlot.left}%`,
  top: `${displaySlot.top}%`,
  transitionDelay: `${enterDelay}ms`,
}}>
```

**为什么用 transition-delay 而不是 framer-motion**：
- 项目无 framer-motion 依赖，引入只为一个动画太重
- transition 已经有 1.2s 缓动，加 delay 就能 stagger
- 60ms/只 错开 8 只狐狸 480ms，足够"依次走进"的感觉

**可能的边界问题**：
- 5s 轮询触发 agents 更新时，**新加入的 agent** 也会从屏幕外进入（因为 hasEntered=true，但新 agent 第一次出现时 slot 是真实位置）—— 这其实是想要的
- 5s 轮询时**已存在的 agent** 移动不会被 stagger 影响（enterDelay=0）—— 也对的

### 3. 角色微动（A-2 / A-3 / A-4）

#### 3.1 Fox SVG 结构改造

把眼睛和耳朵从 head group 拆出来单独包：

```diff
  <g className={headClass}>
-   <path d="M10 18 l4 -8 l4 6 z" .../>  {/* ear */}
-   <path d="M12 18 l3 -5 l3 4 z" .../>  {/* inner ear */}
-   <path d="M34 18 l-4 -8 l-4 6 z" .../>
-   <path d="M32 18 l-3 -5 l-3 4 z" .../>
+   <g className="fox-ears" style={{ animationDelay: earDelay }}>
+     <path .../>
+     <path .../>
+     <path .../>
+     <path .../>
+   </g>
    <path d="M22 13 ..." .../>  {/* face */}
    <ellipse ... />
-   <circle cx="17" cy="22" r="1.5" .../>  {/* eye */}
-   <circle cx="17" cy="21.5" r="0.5" .../>
-   <circle cx="27" cy="22" r="1.5" .../>
-   <circle cx="27" cy="21.5" r="0.5" .../>
+   <g className="fox-eyes" style={{ animationDelay: blinkDelay }}>
+     <circle .../>
+     <circle .../>
+     <circle .../>
+     <circle .../>
+   </g>
    <ellipse cx="22" cy="27" .../>  {/* nose */}
  </g>
```

#### 3.2 哈希随机相位

每只狐狸的眨眼 / 耳朵抽 / 呼吸应该**错开时间**，否则全屏统一眨眼很诡异。

```tsx
const h = (() => {
  let n = 0;
  for (let i = 0; i < agentId.length; i++) n = (n * 31 + agentId.charCodeAt(i)) >>> 0;
  return n;
})();
const blinkDelay = `${(h % 5000) / 1000}s`;
const earDelay = `${((h >> 5) % 7000) / 1000}s`;
const breatheDelay = `${((h >> 10) % 3000) / 1000}s`;
```

哈希来自 agentId，**稳定 + 均匀分布**。重渲染相位不变。

#### 3.3 三个动画关键参数

| 动画 | 周期 | 占用时间 | 视觉效果 |
|------|------|----------|----------|
| 眨眼 | 5s | ~5% (0.2s 闭眼) | 1s 看一次，谁也不齐 |
| 耳朵抽 | 8s | ~3% (0.25s 抽) | 很轻，偶尔动一下 |
| 呼吸 | 3.5s | 100% | 1.018x 缩放，叠加走路 bob 上 |

#### 3.4 与现有走路的兼容

```css
.fox-body { animation: fox-breathe 3.5s ease-in-out infinite; }
.fox-body--walk {
  animation:
    fox-body-bob 0.5s ease-in-out infinite,
    fox-breathe 3.5s ease-in-out infinite;
}
```

走路时 bob（Y 方向 0.5s）和 breathe（scale 3.5s）独立时间轴，不冲突。

### 4. 环境氛围（A-5 / A-6 / A-7）

#### 4.1 AmbientLayer 组件

```tsx
function AmbientLayer() {
  return (
    <div className="ambient-layer" aria-hidden>
      <span className="ambient-speck ambient-speck--1" />
      ...
      <span className="ambient-dust ambient-dust--1" />
      ...
      <div className="ambient-clouds">
        <span className="ambient-cloud ambient-cloud--1" />
        <span className="ambient-cloud ambient-cloud--2" />
      </div>
    </div>
  );
}
```

放在 `my-company-scene` 内、`<Agents>` 之前，`z-index: 0`，狐狸 `z-index: 1`，层级关系正确。

#### 4.2 关键参数

**光斑（4 个）**：
- 位置：work 区上中下三段
- 颜色：4 种 kind 对应色（蓝/绿/橙/暖）
- 周期：5.5s 脉冲
- 模糊：8px 半径 + opacity 0.25-0.55
- 错相位：0 / 1.2 / 2.4 / 3.6s

**尘埃（6 个）**：
- 颜色：白 80% + box-shadow 4px
- 上升 400px + 水平 ±20px 漂移
- 周期：16-24s
- 错相位：0-10s
- 透明度：0% 渐入 → 60% → 渐出

**窗外云（2 朵）**：
- 位置：office 区右上方 30% × 24% 范围
- 形态：白色椭圆 + 2px blur
- 飘过：translateX -60 → +180px，22-30s

### 5. 状态相关（A-8 / A-9 / A-10）

#### 5.1 触发条件

在 agent 渲染时根据状态加 class：

```tsx
const agentClass = [
  'fox-agent',
  `fox-agent--${p.zone}`,
  `fox-agent--${p.pose}`,
  p.zone === 'work' && p.agent.status === 'running' ? 'fox-agent--typing' : '',
  p.zone === 'work' && p.agent.status === 'running' && isOffline(p.agent) ? 'fox-agent--offline' : '',
  p.agent.status === 'error' ? 'fox-agent--error' : '',
].filter(Boolean).join(' ');
```

注意 `fox-agent--typing` 和 `fox-agent--offline` 都要求 `work + running`，offline 是 typing 的子集，**两个 class 同时挂**时 offline 的动画会覆盖 typing（CSS 后写后赢）。

#### 5.2 三个动画

| 动画 | 周期 | 效果 |
|------|------|------|
| typing | 0.18s steps(2) | body 整体 X 抖 ±0.3px + 缩放 1.005 |
| offline | 4s（92% 静止 + 8% 抖） | rotate ±2° + 灰度 0.6 + 透明度 0.7 |
| error | 1.6s ease | 灰度 0.5 + 红色 drop-shadow 0→6px 脉冲 |

offline 和 error 的"大部分时间静止"是关键 —— 全屏持续抖动会让人晕。

### 6. A11y（A-1）

`prefers-reduced-motion: reduce` 用户**不跑任何新动画**：

```css
@media (prefers-reduced-motion: reduce) {
  .fox-eyes, .fox-ears, .fox-body,
  .fox-agent--typing .fox-svg,
  .fox-agent--offline .fox-svg,
  .fox-agent--error .fox-svg,
  .ambient-speck, .ambient-dust, .ambient-cloud { 
    animation: none !important; 
  }
}
```

保留 `.fox-agent` 的位置 transition（让 zone 切换还能动画）。

---

## 风险与控制

- **CPU 占用**：4 个光斑 + 6 个尘埃 + 2 朵云 = 12 个常驻 CSS animation，10-20 帧/秒，对现代 GPU 无压力
- **首次渲染闪烁**：入场动画 60ms 后才触发，避免 React 18 双调用 useEffect 时跳过
- **reducer-motion**：8 个新动画全部加入黑名单
- **i18n**：无新增 i18n key（删的 CompanyToolbar 用了 7 个 key，那些 key 还在 JSON 里，dead code 留给后续清理）

## 校验

- ✅ TypeScript `tsc --noEmit` 0 错误
- ✅ `npm run build` 成功（MyCompany 包 32.83 kB / gzip 8.24 kB，比上轮 -0.5 kB）
- ✅ vite preview 服务于新 build，http://127.0.0.1:5180/

## 用户可感知改善

1. **页面打开更生动**：8 只狐狸依次从屏幕外走进自己的位置（~0.5s）
2. **狐狸不再"机器人"**：随机眨眼 + 耳朵抽 + 呼吸，节奏错开不统一
3. **场景有空气感**：光斑脉冲 + 尘埃上升 + 窗外云飘
4. **状态一眼分辨**：工作中的打键盘抖动、失联的灰度抖动、错误的红光脉冲
5. **界面更干净**：顶部少了一条 toolbar，焦点回到"看狐狸"这件事本身

## 后续建议（未实施）

- **N-1**：狐狸走路时可以加更复杂的 path 动画（贝塞尔曲线）
- **N-2**：休息区活动可以加季节性（春喝咖啡 / 冬喝热茶）
- **N-3**：工位屏幕内容可以加打字机效果（每行代码逐字显示）
- **清理**：7 个 toolbar 相关的 i18n key 可从 en/zh.json 删除（dead code）
