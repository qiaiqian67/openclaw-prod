# 我的公司 (My Company) 动画页面 — 开发记录

> 记录 `client/web/pages/MyCompany.tsx` 及配套样式在 2026-06-06 这一轮会话的调整。

## 改动总览

| 关注点 | 文件 | 关键变化 |
|--------|------|----------|
| 工作区两排更松、智能体坐姿 | `web/pages/MyCompany.tsx` + `web/index.css` | ZONE_LAYOUT.work 拉高到 28-64%；`.fox-agent--work.fox-agent--sitting` 加 `translateY(10px)` |
| 休息区水平边界放宽 | `web/pages/MyCompany.tsx` + `web/index.css` | xStart 8, xEnd 92；CSS `top: 68%; height: 18%` |
| 待岗区水平边界放宽 | `web/pages/MyCompany.tsx` + `web/index.css` | xStart 8, xEnd 92；CSS `height: 12%` |
| 休息区活动切换节奏 | `web/pages/MyCompany.tsx` | `setInterval` 间隔 7000ms → 14000ms |

## 详细改动

### 1. `client/web/pages/MyCompany.tsx`

#### 1.1 ZONE_LAYOUT（约 110-123 行）

```ts
// 调整前
work:   { xStart: 14, xEnd: 86, yStart: 30, yEnd: 50, maxCols: 4, maxRows: 2 },
rest:   { xStart: 14, xEnd: 86, yStart: 66, yEnd: 81, maxCols: 6, maxRows: 2 },
standby:{ xStart: 10, xEnd: 90, yStart: 92, yEnd: 92, maxCols: 8, maxRows: 1 },

// 调整后
work:   { xStart: 16, xEnd: 84, yStart: 28, yEnd: 64, maxCols: 4, maxRows: 2 },
rest:   { xStart: 8,  xEnd: 92, yStart: 72, yEnd: 86, maxCols: 6, maxRows: 2 },
standby:{ xStart: 8,  xEnd: 92, yStart: 94, yEnd: 94, maxCols: 8, maxRows: 1 },
```

**原因**：
- 工作区 yEnd 从 50 拉到 64（高度 20% → 36%），两排工位之间不挤
- 工作区 xStart/xEnd 14/86 → 16/84，给右边 4 列工位留余量防止越界
- 休息区、待岗区水平边界从 14/86 / 10/90 放宽到 8/92，避免智能体在边缘踱步时贴墙

#### 1.2 restTick 间隔（约 425-429 行）

```ts
// 调整前
useEffect(() => {
    const id = window.setInterval(() => setRestTick((t) => t + 1), 7000);
    return () => window.clearInterval(id);
}, []);

// 调整后
useEffect(() => {
    const id = window.setInterval(() => setRestTick((t) => t + 1), 14000);
    return () => window.clearInterval(id);
}, []);
```

**原因**：用户反馈「智能体的动作切换太快」，7s 太频繁，改为 14s。

### 2. `client/web/index.css`

#### 2.1 三个 zone 区域尺寸（约 8303-8343 行）

```css
/* Work Area — 中间 */
.my-company-zone--work {
  top: 24%;   /* 不变 */
  height: 40%;  /* 32% → 40% */
}

/* Rest Area — 下方 */
.my-company-zone--rest {
  top: 68%;   /* 60% → 68% */
  height: 18%;  /* 24% → 18% */
}

/* Standby — 底边 */
.my-company-zone--standby {
  height: 12%;  /* 13% → 12% */
}
```

#### 2.2 工作区智能体坐姿（约 8422-8430 行，新增）

```css
.fox-agent {
  /* ...既有... */
  transform: translate(-50%, -100%);
}
/* 新增：work 区智能体下移 10px，让脚落在椅子座垫上 */
.fox-agent--work.fox-agent--sitting {
  transform: translate(-50%, calc(-100% + 10px));
}
```

## 验证

1. `cd client && npm run build` — 通过，无 TS / Vite 报错
2. `npm run electron:dev` — 启动后侧边栏「我的公司」可点击
3. 视觉确认：
   - 工作区 2 排 × 4 列工位，间距均匀，两排之间不挤
   - 智能体进入工作区后视觉上坐在椅子上
   - 休息区智能体在 8-92% 范围内，水平不再贴边
   - 待岗区智能体在 8-92% 范围踱步
   - 14 秒切换一次动作（观察 1-2 次确认节奏合适）

## 后续可考虑

- 工位 1-4 距离过近时若智能体 SVG 头部超出显示范围，可考虑给 `.fox-agent--work` 加 `z-index` 调整
- 当前工作区空工位电脑屏幕固定纯黑，occupied 时点亮。如需"屏幕内容随智能体不同而不同"需后端配合
- 6 个活动（coffee / treadmill / phone / book / music / stretch）目前随机 hash 分配；若需要"按性格分配"需在 Agent 模型加偏好字段
