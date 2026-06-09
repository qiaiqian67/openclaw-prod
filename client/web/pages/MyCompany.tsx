import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores';
import { agentApi } from '../services/api';
import type { Agent } from '../types';

/* ─────────────────────────────────────────────────────────
 *  Types
 * ──────────────────────────────────────────────────────── */
type Zone = 'office' | 'work' | 'rest' | 'standby';
type Pose = 'walking' | 'sitting' | 'standing' | 'pacing';

interface Slot {
    left: number; // percentage 0-100
    top: number;  // percentage 0-100
    rotate?: number;
}

interface AgentPlacement {
    agent: Agent;
    zone: Zone;
    pose: Pose;
    slot: Slot;
    moving: boolean;
    tooltipVisible: boolean;
    restActivity: RestActivity | null;
    workSlotIndex: number; // 在 2×4 工位中的索引（-1 表示不在工作区）
}

/* ─────────────────────────────────────────────────────────
 *  Zone / Pose mapping
 * ──────────────────────────────────────────────────────── */
const OPENCLAW_OFFLINE_MS = 60 * 60 * 1000;

/**
 * 休息区活动：每位休息中的员工会从这些动作里随机切换。
 * 仅做视觉表现，不影响业务状态。
 */
const REST_ACTIVITIES = ['coffee', 'treadmill', 'phone', 'book', 'music', 'stretch'] as const;
type RestActivity = typeof REST_ACTIVITIES[number];

function isOkrAgent(agent: Agent): boolean {
    return /okr/i.test(agent.name || '') || /okr/i.test(agent.role_description || '');
}

function isOffline(agent: Agent): boolean {
    if (agent.agent_type !== 'openclaw') return false;
    if (!agent.openclaw_last_seen) return false;
    const last = new Date(agent.openclaw_last_seen).getTime();
    return Date.now() - last > OPENCLAW_OFFLINE_MS;
}

/**
 * 后端 chat WebSocket 处理消息时只更新 last_active_at，不动 agent.status
 * （status 是 lifecycle 字段：creating/running/idle/stopped/error）。
 * 所以"正在对话"或"刚对话过"的 agent 需要靠 last_active_at 判定为 work。
 */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
function isRecentlyActive(agent: Agent): boolean {
    if (!agent.last_active_at) return false;
    const t = new Date(agent.last_active_at).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t < ACTIVE_WINDOW_MS;
}

/* ─────────────────────────────────────────────────────────
 *  Screen theme — 工位屏幕根据 agent 角色 + 状态显示差异化内容
 *  - kind 决定屏幕内容（开发代码 / 翻译双语 / OKR 进度 / 文档 / 通用）
 *  - state 决定屏幕状态效果（正常 / 错误 / 待机 / 离线 / 加载中）
 * ──────────────────────────────────────────────────────── */
type ScreenKind = 'code' | 'translation' | 'okr' | 'writing' | 'data' | 'support' | 'generic';
type ScreenState = 'normal' | 'error' | 'idle' | 'offline' | 'creating';

interface ScreenTheme {
    kind: ScreenKind;
    state: ScreenState;
    accent: string;
    bg: string;
    text: string;
    textDim: string;
}

const SCREEN_PALETTES: Record<ScreenKind, { accent: string; bg: string; text: string; textDim: string }> = {
    code:        { accent: '#5ab0ff', bg: '#16315a', text: '#cfe6ff', textDim: '#7fb0e8' },
    translation: { accent: '#9ad6a0', bg: '#1a3d24', text: '#d8f0d8', textDim: '#85b890' },
    okr:         { accent: '#ffb86c', bg: '#3d2410', text: '#ffd9b0', textDim: '#c89060' },
    writing:     { accent: '#f3c969', bg: '#33260d', text: '#f3c969', textDim: '#a89055' },
    data:        { accent: '#7ee0c5', bg: '#0d3530', text: '#b8f0e0', textDim: '#6cb0a0' },
    support:     { accent: '#f0a8d0', bg: '#33182a', text: '#f8d0e6', textDim: '#b0859a' },
    generic:     { accent: '#5ab0ff', bg: '#1a3d6e', text: '#cfe6ff', textDim: '#9ad0ff' },
};

function inferScreenTheme(agent: Agent): ScreenTheme {
    const role = (agent.role_description || '').toLowerCase();
    const name = (agent.name || '').toLowerCase();
    const isOkr = isOkrAgent(agent);

    let kind: ScreenKind = 'generic';
    if (isOkr) {
        kind = 'okr';
    } else if (/(code|develop|program|engin|dev|前端|后端|开发|编程|软件)/.test(role)) {
        kind = 'code';
    } else if (/(translat|interpret|i18n|翻译|口译)/.test(role)) {
        kind = 'translation';
    } else if (/(data|analy|report|finance|财务|分析|会计|报表|bi|数据)/.test(role)) {
        kind = 'data';
    } else if (/(support|customer|服务|客服|support)/.test(role)) {
        kind = 'support';
    } else if (/(writ|editor|copy|cont|writer|编辑|文案|撰稿|写)/.test(role) || /(writer|editor|copy)/.test(name)) {
        kind = 'writing';
    }

    let state: ScreenState = 'normal';
    if (agent.status === 'error') state = 'error';
    else if (agent.status === 'creating') state = 'creating';
    else if (agent.status === 'stopped' || agent.status === 'idle') state = 'idle';
    else if (isOffline(agent)) state = 'offline';

    const palette = { ...SCREEN_PALETTES[kind] };
    if (state === 'error') {
        palette.accent = '#ff5a5a';
        palette.bg = '#4a1010';
        palette.text = '#ffd0d0';
        palette.textDim = '#c97070';
    } else if (state === 'idle') {
        palette.bg = '#0e1015';
    } else if (state === 'offline') {
        palette.text = '#8a7a60';
        palette.textDim = '#5a4e3a';
    }

    return { kind, state, ...palette };
}

/**
 * Compute whether the agent is currently past its validity period.
 * - Backend `is_expired` flag is the source of truth when set
 * - Otherwise fall back to comparing `expires_at` to the current time
 *   so a freshly-expired agent (job hasn't run yet) still shows in standby
 */
function isAgentExpired(agent: Agent): boolean {
    if (agent.is_expired) return true;
    if (!agent.expires_at) return false;
    const t = new Date(agent.expires_at).getTime();
    if (Number.isNaN(t)) return false;
    return t <= Date.now();
}

function getZone(agent: Agent): Zone {
    if (isAgentExpired(agent)) return 'standby';
    if (isOkrAgent(agent)) return 'office';
    switch (agent.status) {
        case 'creating': return 'rest';
        case 'running': return isOffline(agent) ? 'rest' : 'work';
        case 'idle':
        case 'stopped':
        case 'error':
        default:
            // idle/stopped/error 但 last_active_at 在 5 分钟内 → 刚对话过，进 work
            return isRecentlyActive(agent) ? 'work' : 'rest';
    }
}

/**
 * Format a date string into "YYYY-MM-DD HH:mm" for the standby tooltip.
 * Returns null if the date can't be parsed.
 */
function formatExpiresAt(expiresAt: string | undefined): string | null {
    if (!expiresAt) return null;
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getPose(zone: Zone, moving: boolean): Pose {
    if (moving) return 'walking';
    if (zone === 'work') return 'sitting';
    if (zone === 'standby') return 'pacing';
    if (zone === 'office') return 'sitting';
    return 'standing';
}

/* ─────────────────────────────────────────────────────────
 *  Zone layout configuration (percentages of scene)
 *  Each zone defines the bounding box + max grid capacity.
 *  The actual slot grid is generated per render based on
 *  how many agents are currently in that zone — keeping
 *  desks / sofas evenly spaced and tidy.
 * ──────────────────────────────────────────────────────── */
const ZONE_LAYOUT: Record<Zone, {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
    maxCols: number;
    maxRows: number;
}> = {
    office: { xStart: 86, xEnd: 86, yStart: 16, yEnd: 16, maxCols: 1, maxRows: 1 },
    // 工作区：固定 2 排每排 4 个工位（最多 8 个），拉高让两排之间不挤
    work:   { xStart: 16, xEnd: 84, yStart: 28, yEnd: 64, maxCols: 4, maxRows: 2 },
    // 休息区：放宽水平边距，避免智能体超出场景
    rest:   { xStart: 8,  xEnd: 92, yStart: 72, yEnd: 86, maxCols: 6, maxRows: 2 },
    // 待岗区：放宽水平边距，让踱步不会贴墙
    standby:{ xStart: 8,  xEnd: 92, yStart: 94, yEnd: 94, maxCols: 8, maxRows: 1 },
};

/**
 * Generate a tidy grid of slots that fits `count` agents.
 * - Work area is special: always emits maxRows × maxCols (= 2×4 = 8) slots,
 *   even when empty, so the desks/monitors can be drawn and lit up selectively.
 * - Other zones: prefer a single row when count <= maxCols; fall back to
 *   maxRows and grow cols to fit overflow.
 */
function generateSlots(zone: Zone, count: number): Slot[] {
    const cfg = ZONE_LAYOUT[zone];
    if (zone === 'office') return [{ left: cfg.xStart, top: cfg.yStart }];

    if (zone === 'work') {
        // 固定 2 排 4 列 = 8 工位
        const rows = cfg.maxRows;
        const cols = cfg.maxCols;
        const slots: Slot[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const left = cfg.xStart + ((cfg.xEnd - cfg.xStart) * c) / Math.max(cols - 1, 1);
                const top = cfg.yStart + ((cfg.yEnd - cfg.yStart) * r) / Math.max(rows - 1, 1);
                slots.push({ left, top });
            }
        }
        return slots;
    }

    if (count <= 0) return [];
    let rows: number;
    let cols: number;
    if (count <= cfg.maxCols) {
        rows = 1;
        cols = count;
    } else {
        // Use maxRows (cleanest grid) and grow cols to fit all agents
        rows = cfg.maxRows;
        cols = Math.ceil(count / rows);
    }

    const slots: Slot[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const left = cfg.xStart + ((cfg.xEnd - cfg.xStart) * c) / Math.max(cols - 1, 1);
            const top = cfg.yStart + ((cfg.yEnd - cfg.yStart) * r) / Math.max(rows - 1, 1);
            slots.push({ left, top });
        }
    }
    return slots;
}

/**
 * 给休息区的智能体挑一个活动。
 * - 基于 agentId 的 hash + 全局 tick 决定：每位员工的"开始活动"不同，
 *   tick 变化时大家一起换动作，但换完依然错开。
 * - 这样看起来像"集体同时换动作"但视觉上仍然丰富多样。
 */
function pickRestActivity(agentId: string, tick: number): RestActivity {
    let h = 0;
    for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0;
    return REST_ACTIVITIES[(h + tick) % REST_ACTIVITIES.length];
}

/**
 * Stable hash → slot index so the same agent keeps a consistent seat
 * across re-renders and status changes.
 */
function slotIndexFor(agentId: string, slotCount: number): number {
    if (slotCount <= 0) return 0;
    let h = 0;
    for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0;
    return h % slotCount;
}

/* ─────────────────────────────────────────────────────────
 *  Fox SVG
 *  - 视觉重做：头大身短、尾巴上翘、整体 1.5px 描边
 *  - 眼睛双层（外圈深 + 内圈白点）增加神态
 * ──────────────────────────────────────────────────────── */
function Fox({ pose, name, agentId }: { pose: Pose; name: string; agentId: string }) {
    const tailClass = `fox-tail fox-tail--${pose}`;
    const legClass = pose === 'walking' || pose === 'pacing' ? 'fox-legs fox-legs--walk' : 'fox-legs';
    const bodyClass = pose === 'walking' || pose === 'pacing' ? 'fox-body fox-body--walk' : 'fox-body';
    const headClass =
        pose === 'sitting' ? 'fox-head fox-head--sitting' :
        pose === 'walking' || pose === 'pacing' ? 'fox-head fox-head--walk' :
        'fox-head';

    // 用 agentId 哈希算稳定的随机延迟，给每只狐狸不同的动画相位
    const h = (() => {
        let n = 0;
        for (let i = 0; i < agentId.length; i++) n = (n * 31 + agentId.charCodeAt(i)) >>> 0;
        return n;
    })();
    const blinkDelay = `${(h % 5000) / 1000}s`;
    const earDelay = `${((h >> 5) % 7000) / 1000}s`;
    const breatheDelay = `${((h >> 10) % 3000) / 1000}s`;

    return (
        <svg className="fox-svg" viewBox="0 0 44 56" aria-label={name}>
            {/* tail — 上翘弧度更大 */}
            <g className={tailClass}>
                <path
                    d="M32 40 q12 -4 12 -16 q-2 6 -8 6 z"
                    fill="#e07b3a"
                    stroke="var(--ink, #1f1b16)"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                />
                <path d="M36 36 q6 -3 6 -10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </g>
            {/* legs (behind body) — 缩短 */}
            <g className={legClass}>
                <rect x="14" y="42" width="4" height="8" rx="2" fill="#c95f1f" stroke="var(--ink, #1f1b16)" strokeWidth="1" />
                <rect x="24" y="42" width="4" height="8" rx="2" fill="#c95f1f" stroke="var(--ink, #1f1b16)" strokeWidth="1" />
            </g>
            {/* body — 缩短 10% */}
            <g className={bodyClass} style={{ animationDelay: breatheDelay }}>
                <ellipse cx="22" cy="41" rx="11" ry="8" fill="#e07b3a" stroke="var(--ink, #1f1b16)" strokeWidth="1.4" />
                <ellipse cx="22" cy="44" rx="7" ry="5" fill="#fff" />
            </g>
            {/* head — 头部 16→17 放大，下移一点让身段更紧凑 */}
            <g className={headClass}>
                {/* ears — 单独 group，触发抽动动画 */}
                <g className="fox-ears" style={{ animationDelay: earDelay }}>
                    <path d="M10 18 l4 -8 l4 6 z" fill="#e07b3a" stroke="var(--ink, #1f1b16)" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M12 18 l3 -5 l3 4 z" fill="#fff" />
                    <path d="M34 18 l-4 -8 l-4 6 z" fill="#e07b3a" stroke="var(--ink, #1f1b16)" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M32 18 l-3 -5 l-3 4 z" fill="#fff" />
                </g>
                {/* face — 脸型略圆润 */}
                <path
                    d="M22 13 q-11 0 -11 11 q0 9 11 12 q11 -3 11 -12 q0 -11 -11 -11 z"
                    fill="#e07b3a"
                    stroke="var(--ink, #1f1b16)"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                />
                <ellipse cx="22" cy="24" rx="7" ry="5.5" fill="#fff" />
                {/* eyes — 单独 group，触发眨眼动画 */}
                <g className="fox-eyes" style={{ animationDelay: blinkDelay }}>
                    <circle cx="17" cy="22" r="1.5" fill="#1f1b16" />
                    <circle cx="17" cy="21.5" r="0.5" fill="#fff" />
                    <circle cx="27" cy="22" r="1.5" fill="#1f1b16" />
                    <circle cx="27" cy="21.5" r="0.5" fill="#fff" />
                </g>
                {/* nose */}
                <ellipse cx="22" cy="27" rx="1.4" ry="1" fill="#1f1b16" />
            </g>
        </svg>
    );
}

/* ─────────────────────────────────────────────────────────
 *  Status badge (emoji above fox)
 * ──────────────────────────────────────────────────────── */
function StatusBadge({ agent }: { agent: Agent }) {
    let symbol = '⏸';
    let title = '';
    if (isAgentExpired(agent)) { symbol = '⏳'; title = 'statusExpired'; }
    else if (isOkrAgent(agent)) { symbol = '🎯'; title = 'statusOkr'; }
    else if (agent.status === 'running' && isOffline(agent)) { symbol = '📡'; title = 'statusDisconnected'; }
    else if (agent.status === 'running') { symbol = '💻'; title = 'statusWorking'; }
    else if (agent.status === 'creating') { symbol = '✨'; title = 'statusCreating'; }
    else if (agent.status === 'error') { symbol = '⚠️'; title = 'statusError'; }
    else if (agent.status === 'stopped') { symbol = '⏸'; title = 'statusStopped'; }
    else { symbol = '☕'; title = 'statusResting'; }
    return (
        <span className="fox-badge" data-status={agent.status} title={title}>
            {symbol}
        </span>
    );
}

/* ─────────────────────────────────────────────────────────
 *  Workstation (chair + desk + monitor, screen lit when occupied)
 *  - agent 决定屏幕 kind + state
 *  - agent 为空 → 空工位，屏幕纯黑
 * ──────────────────────────────────────────────────────── */
function Workstation({ slot, agent }: { slot: Slot; agent?: Agent | null }) {
    const occupied = !!agent;
    const theme = agent ? inferScreenTheme(agent) : null;
    const className = [
        'my-company-workstation',
        occupied ? 'is-occupied' : '',
        theme ? `ws-kind-${theme.kind}` : '',
        theme ? `ws-state-${theme.state}` : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={className}
            style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
            aria-hidden
        >
            <svg viewBox="0 0 70 80" width="70" height="80">
                {/* 椅子（最底层） */}
                <ellipse cx="35" cy="76" rx="11" ry="2" fill="rgba(0,0,0,0.18)" />
                <rect x="30" y="58" width="10" height="16" rx="1.5" fill="#7a6850" />
                <rect x="31" y="60" width="8" height="12" rx="1" fill="#8a7860" />
                <ellipse cx="35" cy="73" rx="9" ry="1.4" fill="#555" />
                {/* 桌面板 */}
                <rect x="2" y="50" width="66" height="3" rx="0.5" fill="#a08868" />
                {/* 显示器外框 */}
                <rect x="12" y="20" width="46" height="28" rx="2" fill="#1a1a1f" />
                {/* 屏幕 */}
                <rect className="ws-screen" x="14" y="22" width="42" height="24" rx="1" />
                {/* 显示器底座 */}
                <rect x="33" y="48" width="4" height="2" fill="#1a1a1f" />
                <rect x="27" y="50" width="16" height="1" fill="#1a1a1f" />
                {/* 屏幕内容（仅点亮时） */}
                {occupied && theme && <ScreenContent theme={theme} agent={agent!} />}
            </svg>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────
 *  Screen content — 工位屏幕差异化内容
 *  根据 agent.kind 渲染不同画面：代码 / 文档 / 翻译 / OKR / 数据 / 客服 / 通用
 *  state 通过外层 .ws-state-* class 叠加效果（红色/暗屏/进度条/弱信号）
 * ──────────────────────────────────────────────────────── */
function ScreenContent({ theme, agent }: { theme: ScreenTheme; agent: Agent }) {
    switch (theme.kind) {
        case 'code':
            return <CodeScreen accent={theme.accent} text={theme.text} textDim={theme.textDim} />;
        case 'translation':
            return <TranslationScreen accent={theme.accent} text={theme.text} textDim={theme.textDim} />;
        case 'okr':
            return <OKRScreen accent={theme.accent} text={theme.text} textDim={theme.textDim} agent={agent} />;
        case 'data':
            return <DataScreen accent={theme.accent} text={theme.text} textDim={theme.textDim} />;
        case 'support':
            return <SupportScreen accent={theme.accent} text={theme.text} textDim={theme.textDim} />;
        case 'writing':
            return <WritingScreen accent={theme.accent} text={theme.text} textDim={theme.textDim} />;
        default:
            return <GenericScreen accent={theme.accent} text={theme.text} textDim={theme.textDim} />;
    }
}

function CodeScreen({ accent, text, textDim }: { accent: string; text: string; textDim: string }) {
    return (
        <g className="ws-screen-content">
            {/* 顶部 tab 栏 */}
            <rect x="15" y="23" width="8" height="1.2" rx="0.3" fill={accent} opacity="0.85" />
            <rect x="24" y="23" width="6" height="1.2" rx="0.3" fill={textDim} opacity="0.4" />
            <rect x="31" y="23" width="9" height="1.2" rx="0.3" fill={textDim} opacity="0.4" />
            {/* 行号 + 代码行（不同长度模拟不同缩进） */}
            <rect x="15" y="26" width="1.2" height="1" fill={textDim} opacity="0.5" />
            <rect x="17" y="26" width="6" height="1" rx="0.2" fill={accent} opacity="0.95" />
            <rect x="24" y="26" width="10" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="15" y="28" width="1.2" height="1" fill={textDim} opacity="0.5" />
            <rect x="19" y="28" width="4" height="1" rx="0.2" fill={accent} opacity="0.7" />
            <rect x="24" y="28" width="14" height="1" rx="0.2" fill={text} opacity="0.6" />
            <rect x="15" y="30" width="1.2" height="1" fill={textDim} opacity="0.5" />
            <rect x="19" y="30" width="8" height="1" rx="0.2" fill={accent} opacity="0.7" />
            <rect x="28" y="30" width="6" height="1" rx="0.2" fill={text} opacity="0.6" />
            <rect x="15" y="32" width="1.2" height="1" fill={textDim} opacity="0.5" />
            <rect x="21" y="32" width="12" height="1" rx="0.2" fill={text} opacity="0.5" />
            <rect x="34" y="32" width="4" height="1" rx="0.2" fill={accent} opacity="0.7" />
            <rect x="15" y="34" width="1.2" height="1" fill={textDim} opacity="0.5" />
            <rect x="19" y="34" width="5" height="1" rx="0.2" fill={accent} opacity="0.7" />
            <rect x="25" y="34" width="16" height="1" rx="0.2" fill={text} opacity="0.5" />
            <rect x="15" y="36" width="1.2" height="1" fill={textDim} opacity="0.5" />
            <rect x="21" y="36" width="9" height="1" rx="0.2" fill={text} opacity="0.5" />
            {/* 光标 */}
            <rect x="15" y="38.5" width="0.8" height="1.2" fill={accent} className="ws-cursor" />
            <rect x="17" y="38" width="11" height="1" rx="0.2" fill={text} opacity="0.4" />
            {/* 底部状态栏 */}
            <rect x="15" y="43" width="3" height="1" rx="0.2" fill={accent} opacity="0.7" />
            <rect x="19" y="43" width="20" height="1" rx="0.2" fill={textDim} opacity="0.5" />
            <rect x="50" y="43" width="4" height="1" rx="0.2" fill={textDim} opacity="0.4" />
        </g>
    );
}

function WritingScreen({ accent, text, textDim }: { accent: string; text: string; textDim: string }) {
    return (
        <g className="ws-screen-content">
            {/* 标题 */}
            <rect x="16" y="24" width="14" height="2" rx="0.3" fill={accent} opacity="0.95" />
            {/* 段落行（宽度不规则） */}
            <rect x="16" y="28" width="36" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="16" y="30" width="32" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="16" y="32" width="38" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="16" y="34" width="24" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="16" y="36" width="34" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="16" y="38" width="28" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="16" y="40" width="36" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="16" y="42" width="20" height="1" rx="0.2" fill={text} opacity="0.7" />
            {/* 滚动条 */}
            <rect x="53" y="25" width="1" height="18" rx="0.3" fill={textDim} opacity="0.4" />
            <rect x="53" y="27" width="1" height="5" rx="0.3" fill={accent} opacity="0.7" />
        </g>
    );
}

function TranslationScreen({ accent, text, textDim }: { accent: string; text: string; textDim: string }) {
    return (
        <g className="ws-screen-content">
            {/* 顶部：EN / 中 双标签 */}
            <rect x="16" y="23" width="6" height="2" rx="0.3" fill={accent} opacity="0.9" />
            <rect x="24" y="23" width="6" height="2" rx="0.3" fill={textDim} opacity="0.55" />
            {/* 左侧英文行 */}
            <rect x="16" y="27" width="14" height="1" rx="0.2" fill={text} opacity="0.75" />
            <rect x="16" y="29" width="11" height="1" rx="0.2" fill={text} opacity="0.65" />
            <rect x="16" y="31" width="16" height="1" rx="0.2" fill={text} opacity="0.65" />
            <rect x="16" y="33" width="9" height="1" rx="0.2" fill={text} opacity="0.65" />
            <rect x="16" y="35" width="13" height="1" rx="0.2" fill={text} opacity="0.65" />
            {/* 中间分隔线 */}
            <line x1="34" y1="26" x2="34" y2="44" stroke={textDim} strokeWidth="0.3" opacity="0.4" />
            {/* 右侧中文（用方块代替笔画） */}
            <rect x="36" y="27" width="6" height="2" rx="0.2" fill={text} opacity="0.85" />
            <rect x="44" y="27" width="6" height="2" rx="0.2" fill={text} opacity="0.85" />
            <rect x="36" y="30" width="10" height="2" rx="0.2" fill={text} opacity="0.85" />
            <rect x="36" y="33" width="6" height="2" rx="0.2" fill={text} opacity="0.85" />
            <rect x="44" y="33" width="6" height="2" rx="0.2" fill={text} opacity="0.85" />
            <rect x="36" y="36" width="8" height="2" rx="0.2" fill={text} opacity="0.85" />
            <rect x="36" y="39" width="10" height="2" rx="0.2" fill={text} opacity="0.85" />
            {/* 进度条 */}
            <rect x="16" y="43" width="36" height="1.2" rx="0.4" fill={textDim} opacity="0.3" />
            <rect x="16" y="43" width="22" height="1.2" rx="0.4" fill={accent} opacity="0.85" />
        </g>
    );
}

function OKRScreen({ accent, text, textDim, agent }: { accent: string; text: string; textDim: string; agent: Agent }) {
    // 用 tokens_used_today 简单映射一个百分比作为 OKR 进度
    const used = agent.tokens_used_today || 0;
    const cap = agent.max_tokens_per_day || 100000;
    const pct = Math.min(used / cap, 1);
    const r = 5;
    const cx = 22, cy = 33;
    const circ = 2 * Math.PI * r;
    const dash = pct * circ * 0.75;
    return (
        <g className="ws-screen-content">
            {/* 标题 */}
            <rect x="16" y="24" width="10" height="1.5" rx="0.3" fill={accent} opacity="0.95" />
            <rect x="16" y="26.5" width="6" height="1" rx="0.2" fill={textDim} opacity="0.6" />
            {/* 进度环（3/4 圆弧） */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={textDim} strokeWidth="1.4" opacity="0.35" strokeDasharray={`${circ * 0.75} ${circ}`} transform={`rotate(135 ${cx} ${cy})`} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform={`rotate(135 ${cx} ${cy})`} />
            {/* 百分比数字（用方块拼出） */}
            <rect x="20" y="32" width="4" height="1.2" rx="0.2" fill={accent} opacity="0.95" />
            {/* KPI 列 */}
            <rect x="32" y="28" width="3" height="1" rx="0.2" fill={text} opacity="0.85" />
            <rect x="36" y="28" width="14" height="1" rx="0.2" fill={accent} opacity="0.85" />
            <rect x="32" y="30.5" width="3" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="36" y="30.5" width="10" height="1" rx="0.2" fill={text} opacity="0.6" />
            <rect x="32" y="33" width="3" height="1" rx="0.2" fill={text} opacity="0.7" />
            <rect x="36" y="33" width="13" height="1" rx="0.2" fill={text} opacity="0.6" />
            {/* 柱状图 */}
            <rect x="16" y="40" width="2" height="4" rx="0.3" fill={accent} opacity="0.85" />
            <rect x="19" y="38" width="2" height="6" rx="0.3" fill={accent} opacity="0.7" />
            <rect x="22" y="36" width="2" height="8" rx="0.3" fill={accent} opacity="0.85" />
            <rect x="25" y="37" width="2" height="7" rx="0.3" fill={accent} opacity="0.7" />
            <rect x="28" y="35" width="2" height="9" rx="0.3" fill={accent} opacity="0.85" />
            <rect x="31" y="38" width="2" height="6" rx="0.3" fill={accent} opacity="0.7" />
            {/* KR 进度小条 */}
            <rect x="36" y="38" width="18" height="1" rx="0.3" fill={textDim} opacity="0.3" />
            <rect x="36" y="38" width="12" height="1" rx="0.3" fill={accent} opacity="0.85" />
            <rect x="36" y="41" width="18" height="1" rx="0.3" fill={textDim} opacity="0.3" />
            <rect x="36" y="41" width="8" height="1" rx="0.3" fill={accent} opacity="0.85" />
            <rect x="36" y="44" width="18" height="1" rx="0.3" fill={textDim} opacity="0.3" />
            <rect x="36" y="44" width="15" height="1" rx="0.3" fill={accent} opacity="0.85" />
        </g>
    );
}

function DataScreen({ accent, text, textDim }: { accent: string; text: string; textDim: string }) {
    const points: Array<[number, number]> = [
        [17, 38], [22, 36], [27, 37], [32, 32], [37, 34], [42, 30], [47, 31], [52, 28],
    ];
    return (
        <g className="ws-screen-content">
            {/* 坐标轴 */}
            <line x1="16" y1="42" x2="54" y2="42" stroke={textDim} strokeWidth="0.4" opacity="0.5" />
            <line x1="16" y1="27" x2="16" y2="42" stroke={textDim} strokeWidth="0.4" opacity="0.5" />
            {/* 网格虚线 */}
            <line x1="16" y1="32" x2="54" y2="32" stroke={textDim} strokeWidth="0.2" opacity="0.25" strokeDasharray="1 1" />
            <line x1="16" y1="37" x2="54" y2="37" stroke={textDim} strokeWidth="0.2" opacity="0.25" strokeDasharray="1 1" />
            {/* 折线 */}
            <polyline points={points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={accent} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
            {/* 数据点 */}
            {points.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="0.6" fill={accent} />
            ))}
            {/* 顶部表头 */}
            <rect x="16" y="24" width="6" height="1" rx="0.2" fill={text} opacity="0.8" />
            <rect x="24" y="24" width="4" height="1" rx="0.2" fill={accent} opacity="0.85" />
            <rect x="30" y="24" width="4" height="1" rx="0.2" fill={accent} opacity="0.85" />
        </g>
    );
}

function SupportScreen({ accent, text, textDim }: { accent: string; text: string; textDim: string }) {
    return (
        <g className="ws-screen-content">
            {/* 对话气泡：对方问 → 我方答 */}
            <rect x="16" y="25" width="18" height="4" rx="1" fill={textDim} opacity="0.45" />
            <rect x="17" y="26" width="14" height="0.8" rx="0.2" fill={text} opacity="0.6" />
            <rect x="17" y="27.4" width="10" height="0.8" rx="0.2" fill={text} opacity="0.5" />
            <rect x="30" y="31" width="18" height="4" rx="1" fill={accent} opacity="0.6" />
            <rect x="31" y="32" width="14" height="0.8" rx="0.2" fill={text} opacity="0.85" />
            <rect x="31" y="33.4" width="11" height="0.8" rx="0.2" fill={text} opacity="0.7" />
            <rect x="16" y="37" width="16" height="4" rx="1" fill={textDim} opacity="0.45" />
            <rect x="17" y="38" width="12" height="0.8" rx="0.2" fill={text} opacity="0.6" />
            <rect x="17" y="39.4" width="9" height="0.8" rx="0.2" fill={text} opacity="0.5" />
            {/* 输入框 */}
            <rect x="16" y="43" width="32" height="2" rx="0.4" fill="none" stroke={textDim} strokeWidth="0.3" opacity="0.6" />
            <rect x="50" y="43" width="2" height="2" rx="0.3" fill={accent} opacity="0.85" />
        </g>
    );
}

function GenericScreen({ accent, text, textDim }: { accent: string; text: string; textDim: string }) {
    return (
        <g className="ws-screen-content">
            <rect x="17" y="26" width="18" height="2.5" rx="0.5" fill={accent} opacity="0.9" />
            <rect x="17" y="31" width="24" height="1.4" rx="0.3" fill={textDim} opacity="0.6" />
            <rect x="17" y="34" width="20" height="1.4" rx="0.3" fill={textDim} opacity="0.6" />
            <rect x="17" y="37" width="26" height="1.4" rx="0.3" fill={textDim} opacity="0.6" />
            <rect x="17" y="40" width="16" height="1.4" rx="0.3" fill={textDim} opacity="0.6" />
            <rect x="17" y="43" width="22" height="1.4" rx="0.3" fill={textDim} opacity="0.6" />
        </g>
    );
}

/* ─────────────────────────────────────────────────────────
 *  Rest activity (多种动作，随机切换)
 * ──────────────────────────────────────────────────────── */
function RestActivity({ activity }: { activity: RestActivity }) {
    // 用 key={activity} 让切换时旧元素被卸载、触发 keyframe 入场动画
    switch (activity) {
        case 'coffee':
            return (
                <span key="coffee" className="fox-activity fox-activity--coffee" aria-hidden>
                    <span className="fox-coffee-cup" />
                    <span className="fox-coffee-steam fox-coffee-steam--1" />
                    <span className="fox-coffee-steam fox-coffee-steam--2" />
                </span>
            );
        case 'treadmill':
            return (
                <span key="treadmill" className="fox-activity fox-activity--treadmill" aria-hidden>
                    <svg viewBox="0 0 56 20" width="56" height="20">
                        {/* 跑步机底座 */}
                        <rect x="0" y="10" width="56" height="8" rx="1.5" fill="#3a3a40" />
                        {/* 滚带（动） */}
                        <g className="treadmill-belt">
                            <rect x="0" y="11" width="6" height="6" fill="#7a7a82" />
                            <rect x="8" y="11" width="4" height="6" fill="#5a5a62" />
                            <rect x="14" y="11" width="6" height="6" fill="#7a7a82" />
                            <rect x="22" y="11" width="4" height="6" fill="#5a5a62" />
                            <rect x="28" y="11" width="6" height="6" fill="#7a7a82" />
                            <rect x="36" y="11" width="4" height="6" fill="#5a5a62" />
                            <rect x="42" y="11" width="6" height="6" fill="#7a7a82" />
                            <rect x="50" y="11" width="4" height="6" fill="#5a5a62" />
                        </g>
                        {/* 两侧扶手 */}
                        <rect x="1" y="2" width="2" height="10" fill="#2a2a30" />
                        <rect x="53" y="2" width="2" height="10" fill="#2a2a30" />
                        {/* 仪表盘 */}
                        <rect x="32" y="0" width="20" height="8" rx="1" fill="#222" />
                        <rect x="34" y="1.5" width="16" height="3.5" fill="#0a84ff" />
                        <circle cx="50" cy="6" r="0.8" fill="#ff3b30" />
                    </svg>
                </span>
            );
        case 'phone':
            return (
                <span key="phone" className="fox-activity fox-activity--phone" aria-hidden>
                    <svg viewBox="0 0 14 20" width="14" height="20">
                        <rect x="0" y="0" width="14" height="20" rx="2" fill="#1a1a1f" />
                        <rect x="1.5" y="2" width="11" height="14" rx="1" fill="#4a9eff" />
                        <rect x="3" y="4" width="6" height="1" rx="0.3" fill="#fff" opacity="0.7" />
                        <rect x="3" y="6.5" width="8" height="0.8" rx="0.3" fill="#fff" opacity="0.5" />
                        <rect x="3" y="8.5" width="5" height="0.8" rx="0.3" fill="#fff" opacity="0.5" />
                        <circle cx="7" cy="18" r="0.6" fill="#666" />
                    </svg>
                </span>
            );
        case 'book':
            return (
                <span key="book" className="fox-activity fox-activity--book" aria-hidden>
                    <svg viewBox="0 0 26 18" width="26" height="18">
                        {/* 书页 */}
                        <path d="M2 3 L13 4 L24 3 L24 15 L13 16 L2 15 Z" fill="#fff8e7" stroke="#b8a878" strokeWidth="0.5" />
                        {/* 中缝 */}
                        <line x1="13" y1="4" x2="13" y2="16" stroke="#b8a878" strokeWidth="0.5" />
                        {/* 左侧文字线 */}
                        <line x1="3.5" y1="6" x2="11" y2="6.8" stroke="#b8a878" strokeWidth="0.3" />
                        <line x1="3.5" y1="9" x2="11" y2="9.8" stroke="#b8a878" strokeWidth="0.3" />
                        <line x1="3.5" y1="12" x2="11" y2="12.8" stroke="#b8a878" strokeWidth="0.3" />
                        {/* 右侧文字线 */}
                        <line x1="15" y1="6.8" x2="22.5" y2="6" stroke="#b8a878" strokeWidth="0.3" />
                        <line x1="15" y1="9.8" x2="22.5" y2="9" stroke="#b8a878" strokeWidth="0.3" />
                        <line x1="15" y1="12.8" x2="22.5" y2="12" stroke="#b8a878" strokeWidth="0.3" />
                    </svg>
                </span>
            );
        case 'music':
            return (
                <span key="music" className="fox-activity fox-activity--music" aria-hidden>
                    <svg viewBox="0 0 24 18" width="24" height="18">
                        <text x="0" y="14" fontSize="14" fill="#5a4ad0" fontFamily="serif">♪</text>
                        <text x="9" y="16" fontSize="16" fill="#5a4ad0" fontFamily="serif">♫</text>
                        <text x="-2" y="6" fontSize="9" fill="#8a7ad0" fontFamily="serif" opacity="0.7">♪</text>
                    </svg>
                </span>
            );
        case 'stretch':
            return (
                <span key="stretch" className="fox-activity fox-activity--stretch" aria-hidden>
                    <span className="fox-stretch-fig">🤸</span>
                </span>
            );
    }
}

/* ─────────────────────────────────────────────────────────
 *  AgentHoverCard — 跟随光标的详情卡片（替代旧 fox-tooltip）
 *  - 1s 延迟出现
 *  - 显示名字 / 状态 / 当前任务 / 最后活跃 / 到期时间
 * ──────────────────────────────────────────────────────── */
function AgentHoverCard({ agent, pos }: { agent: Agent; pos: { x: number; y: number } | null }) {
    const { t } = useTranslation();
    const expiresLabel = formatExpiresAt(agent.expires_at);
    const lastActive = agent.last_active_at
        ? new Date(agent.last_active_at).toLocaleString()
        : null;
    const roleText = (agent.role_description || '').slice(0, 80) || t('myCompany.noRole', '通用');
    return (
        <div
            className="agent-hover-card"
            style={{ left: `${pos?.x ?? 0}px`, top: `${pos?.y ?? 0}px` }}
            role="tooltip"
        >
            <div className="agent-hover-card__name">{agent.name}</div>
            <div className="agent-hover-card__row">
                <span className="agent-hover-card__label">{t('myCompany.card.status', '状态')}</span>
                <span className="agent-hover-card__value">
                    {t(`myCompany.${badgeKey(agent)}`, agent.status)}
                </span>
            </div>
            <div className="agent-hover-card__row">
                <span className="agent-hover-card__label">{t('myCompany.card.role', '角色')}</span>
                <span className="agent-hover-card__value">{roleText}</span>
            </div>
            {lastActive && (
                <div className="agent-hover-card__row">
                    <span className="agent-hover-card__label">{t('myCompany.card.lastActive', '最近活跃')}</span>
                    <span className="agent-hover-card__value">{lastActive}</span>
                </div>
            )}
            {expiresLabel && (
                <div className="agent-hover-card__row">
                    <span className="agent-hover-card__label">{t('myCompany.card.expires', '到期')}</span>
                    <span className="agent-hover-card__value agent-hover-card__value--mono">{expiresLabel}</span>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────
 *  ContextMenu — 右键狐狸弹出的快捷操作菜单
 *  - 三项：发送消息 / 查看详情 / 切换状态
 * ──────────────────────────────────────────────────────── */
function ContextMenu({
    pos,
    agent,
    onClose,
    onAction,
}: {
    pos: { x: number; y: number };
    agent: Agent;
    onClose: () => void;
    onAction: (action: 'message' | 'detail' | 'status') => void;
}) {
    const { t } = useTranslation();
    return (
        <div
            className="agent-context-menu"
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                className="agent-context-menu__item"
                onClick={() => { onAction('message'); onClose(); }}
            >
                {t('myCompany.menu.message', '发送消息')}
            </button>
            <button
                type="button"
                className="agent-context-menu__item"
                onClick={() => { onAction('detail'); onClose(); }}
            >
                {t('myCompany.menu.detail', '查看详情')}
            </button>
            <button
                type="button"
                className="agent-context-menu__item"
                onClick={() => { onAction('status'); onClose(); }}
            >
                {t('myCompany.menu.toggleStatus', '切换状态')}
            </button>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────
 *  AmbientLayer — 环境氛围层（光斑 / 尘埃 / 窗外云）
 *  位置：场景底层，绝对定位、pointer-events: none
 *  性能：纯 CSS animation，零 JS 状态
 * ──────────────────────────────────────────────────────── */
function AmbientLayer() {
    return (
        <div className="ambient-layer" aria-hidden>
            {/* 工作区光斑 — 暗示显示器光晕洒在空气里 */}
            <span className="ambient-speck ambient-speck--1" />
            <span className="ambient-speck ambient-speck--2" />
            <span className="ambient-speck ambient-speck--3" />
            <span className="ambient-speck ambient-speck--4" />
            {/* 空气尘埃 — 整场随机飘浮 */}
            <span className="ambient-dust ambient-dust--1" />
            <span className="ambient-dust ambient-dust--2" />
            <span className="ambient-dust ambient-dust--3" />
            <span className="ambient-dust ambient-dust--4" />
            <span className="ambient-dust ambient-dust--5" />
            <span className="ambient-dust ambient-dust--6" />
            {/* 窗外云 — 在 office 区域右侧上方慢慢飘过 */}
            <div className="ambient-clouds">
                <span className="ambient-cloud ambient-cloud--1" />
                <span className="ambient-cloud ambient-cloud--2" />
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────
 *  Page
 * ──────────────────────────────────────────────────────── */
export default function MyCompany() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const tenantId = (user as any)?.tenant_id || localStorage.getItem('current_tenant_id') || '';

    const { data: agents = [], isLoading } = useQuery<Agent[]>({
        queryKey: ['agents-for-my-company', tenantId],
        queryFn: () => agentApi.list(tenantId || undefined),
        refetchInterval: 5000,
        enabled: !!user,
    });
    const queryClient = useQueryClient();

    // Track each agent's previous zone so we can flag a "moving" state
    // when it changes (and avoid animating on first render).
    const prevZonesRef = useRef<Map<string, Zone>>(new Map());
    const [moving, setMoving] = useState<Set<string>>(new Set());
    const [hovered, setHovered] = useState<string | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

    // 过滤 / 交互状态
    const [zoneFilter, setZoneFilter] = useState<Zone | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; agent: Agent } | null>(null);

    // 入场动画：第一次挂载时把狐狸放屏幕外左侧，setTimeout 后切到真实位置触发 transition
    const [hasEntered, setHasEntered] = useState(false);
    useEffect(() => {
        const id = window.setTimeout(() => setHasEntered(true), 60);
        return () => window.clearTimeout(id);
    }, []);

    // 全局点击 / 滚动关闭右键菜单
    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('scroll', close, true);
        };
    }, [contextMenu]);

    // 休息区活动切换的全局 tick：每隔一段时间大家一起换动作。
    // 14 秒一个 tick，配合 pickRestActivity 的 hash 偏移，让所有员工错开活动。
    const [restTick, setRestTick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setRestTick((t) => t + 1), 14000);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        if (!agents.length) return;
        const prev = prevZonesRef.current;
        const newlyMoving = new Set<string>();
        agents.forEach((a) => {
            const target = getZone(a);
            const last = prev.get(a.id);
            if (last && last !== target) {
                newlyMoving.add(a.id);
            }
            prev.set(a.id, target);
        });
        if (newlyMoving.size > 0) {
            setMoving((cur) => {
                const next = new Set(cur);
                newlyMoving.forEach((id) => next.add(id));
                return next;
            });
            const ids = Array.from(newlyMoving);
            window.setTimeout(() => {
                setMoving((cur) => {
                    const next = new Set(cur);
                    ids.forEach((id) => next.delete(id));
                    return next;
                });
            }, 1300);
        }
    }, [agents]);

    // Count per zone + generate tidy slot grids, then assign each agent a stable seat
    const { placements, zoneSlots } = useMemo<{
        placements: AgentPlacement[];
        zoneSlots: Record<Zone, Slot[]>;
    }>(() => {
        const counts: Record<Zone, number> = { office: 0, work: 0, rest: 0, standby: 0 };
        agents.forEach((a) => { counts[getZone(a)]++; });

        // Dynamic, tidy grids sized to fit current occupancy
        // 工作区例外：固定 2×4 = 8 个工位（generateSlots 内部处理）
        const slots: Record<Zone, Slot[]> = {
            office: generateSlots('office', counts.office),
            work:   generateSlots('work',   counts.work),
            rest:   generateSlots('rest',   counts.rest),
            standby:generateSlots('standby',counts.standby),
        };

        // Assign each agent a slot index within their zone (hash-stable per agent id)
        const usedIndices: Record<Zone, Set<number>> = {
            office: new Set(), work: new Set(), rest: new Set(), standby: new Set(),
        };

        const enriched = agents.map<AgentPlacement>((agent) => {
            const zone = getZone(agent);
            const isMoving = moving.has(agent.id);
            const zoneSlotList = slots[zone];
            let idx = slotIndexFor(agent.id, Math.max(zoneSlotList.length, 1));
            if (zoneSlotList.length > 0) {
                const taken = usedIndices[zone];
                if (taken.has(idx)) {
                    for (let i = 0; i < zoneSlotList.length; i++) {
                        if (!taken.has(i)) { idx = i; break; }
                    }
                }
                taken.add(idx);
            }
            const slot = zoneSlotList[idx] ?? { left: 50, top: 50 };
            return {
                agent,
                zone,
                pose: getPose(zone, isMoving),
                slot,
                moving: isMoving,
                tooltipVisible: hovered === agent.id,
                restActivity: zone === 'rest' ? pickRestActivity(agent.id, restTick) : null,
                workSlotIndex: zone === 'work' ? idx : -1,
            };
        });
        return { placements: enriched, zoneSlots: slots };
    }, [agents, moving, hovered, restTick]);

    const stats = useMemo(() => {
        let working = 0, resting = 0, standby = 0;
        agents.forEach((a) => {
            const z = getZone(a);
            if (z === 'work') working++;
            else if (z === 'standby') standby++;
            else resting++;
        });
        return { working, resting, standby };
    }, [agents]);

    // 应用过滤：仅按 zone（点 zone 标签）
    const filteredPlacements = useMemo(() => {
        if (!zoneFilter) return placements;
        return placements.filter((p) => p.zone === zoneFilter);
    }, [placements, zoneFilter]);

    // 把 work 区的 agent 按工位索引映射（0-7），渲染工位时按索引取 agent
    const workAgentsByIndex = useMemo(() => {
        const map = new Map<number, Agent>();
        placements.forEach((p) => {
            if (p.zone === 'work' && p.workSlotIndex >= 0) {
                map.set(p.workSlotIndex, p.agent);
            }
        });
        return map;
    }, [placements]);

    const onAgentClick = useCallback(
        (id: string) => {
            // 乐观更新：用户点击进入对话时立即把目标 agent 标记为 running，
            // 让画面中的智能体立刻从休息区走到工作区（不必等 5s 轮询）。
            // 后续 invalidateQueries 会用后端真实状态覆盖。
            queryClient.setQueryData<Agent[]>(['agents-for-my-company', tenantId], (old) => {
                if (!old) return old;
                return old.map((a) =>
                    a.id === id && a.status !== 'running' ? { ...a, status: 'running' as const } : a,
                );
            });
            // 标记"刚进入对话的 agent"，回 MyCompany 时会被 reset 回 idle
            // （后端 chat WebSocket 只更新 last_active_at 不动 status，所以前端要主动收尾）
            try {
                sessionStorage.setItem('myCompany.lastChatAgentId', id);
            } catch { /* sessionStorage 不可用时静默忽略 */ }
            queryClient.invalidateQueries({ queryKey: ['agents-for-my-company', tenantId] });
            navigate(`/agents/${id}/chat`);
        },
        [navigate, queryClient, tenantId],
    );

    // 路由切换检测：从 /agents/:id/chat 返回 /my-company(或 /dashboard?view=company)时,
    // 把对应 agent 乐观 reset 为 idle
    // 之后狐狸会按"5 分钟宽限期"逻辑(last_active_at 在 5 分钟内)继续在 work,
    // 5 分钟后切到 rest —— 与既有设计保持一致
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const isMyCompanyView =
        location.pathname === '/my-company' ||
        (location.pathname === '/dashboard' && searchParams.get('view') === 'company');
    const prevPathRef = useRef<string | null>(null);
    const prevSearchRef = useRef<string | null>(null);
    useEffect(() => {
        const prevPath = prevPathRef.current;
        const prevSearch = prevSearchRef.current;
        prevPathRef.current = location.pathname;
        prevSearchRef.current = location.search;
        if (!isMyCompanyView) return;
        // 首次挂载 / 本来就在 my-company 视图 → 不触发
        if (prevPath === null) return;
        const wasMyCompanyView =
            prevPath === '/my-company' ||
            (prevPath === '/dashboard' && (prevSearch ?? '').includes('view=company'));
        if (wasMyCompanyView) return;

        let lastChatId: string | null = null;
        try {
            lastChatId = sessionStorage.getItem('myCompany.lastChatAgentId');
            if (lastChatId) sessionStorage.removeItem('myCompany.lastChatAgentId');
        } catch { return; }
        if (!lastChatId) return;

        queryClient.setQueryData<Agent[]>(['agents-for-my-company', tenantId], (old) => {
            if (!old) return old;
            return old.map((a) =>
                a.id === lastChatId && a.status === 'running' ? { ...a, status: 'idle' as const } : a,
            );
        });
    }, [isMyCompanyView, location.pathname, location.search, queryClient, tenantId]);

    // hover 卡片：1s 延迟后显示
    const [hoverShown, setHoverShown] = useState(false);
    useEffect(() => {
        if (!hovered) {
            setHoverShown(false);
            return;
        }
        const id = window.setTimeout(() => setHoverShown(true), 1000);
        return () => window.clearTimeout(id);
    }, [hovered]);
    const hoveredAgent = useMemo(() => {
        if (!hovered || !hoverShown) return null;
        return agents.find((a) => a.id === hovered) || null;
    }, [agents, hovered, hoverShown]);

    const isEmpty = !isLoading && agents.length === 0;

    return (
        <div className="my-company-page">
            <header className="my-company-header">
                <div className="my-company-header-text">
                    <h1 className="my-company-title">{t('myCompany.title', '我的公司')}</h1>
                    <p className="my-company-subtitle">
                        {t('myCompany.subtitle', '看看你的数字员工们都在忙什么')}
                    </p>
                </div>
                <div className="my-company-stats">
                    <span className="my-company-stat my-company-stat--work">
                        <span className="my-company-stat-dot" /> {stats.working} {t('myCompany.statsWorking', '工作中')}
                    </span>
                    <span className="my-company-stat my-company-stat--rest">
                        <span className="my-company-stat-dot" /> {stats.resting} {t('myCompany.statsResting', '休息中')}
                    </span>
                    <span className="my-company-stat my-company-stat--standby">
                        <span className="my-company-stat-dot" /> {stats.standby} {t('myCompany.statsExpired', '待岗')}
                    </span>
                </div>
            </header>

            {isEmpty ? (
                <div className="my-company-empty">
                    <div className="my-company-empty-art" aria-hidden>🦊</div>
                    <p className="my-company-empty-text">{t('myCompany.empty')}</p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => navigate('/plaza?view=hire')}
                    >
                        {t('myCompany.hireButton', '去招聘')}
                    </button>
                </div>
            ) : (
                <>
                <div className="my-company-scene" role="img" aria-label="Office scene">
                    {/* Decorative backdrops for each zone */}
                    <div className="my-company-zone my-company-zone--office">
                        <button
                            type="button"
                            className={`my-company-zone-label my-company-zone-label--clickable${zoneFilter === 'office' ? ' is-active' : ''}`}
                            onClick={() => setZoneFilter(zoneFilter === 'office' ? null : 'office')}
                            title={t('myCompany.zoneFilterHint', '点击只看该区域')}
                        >
                            {t('myCompany.office')}
                        </button>
                        {zoneSlots.office.map((s, i) => (
                            <div
                                key={`chair-${i}`}
                                className="my-company-chair"
                                style={{ left: `${s.left}%`, top: '19%' }}
                                aria-hidden
                            >
                                <svg viewBox="0 0 40 36" width="40" height="36">
                                    {/* Chair backrest */}
                                    <rect x="6" y="2" width="5" height="20" rx="1.5" fill="#7a6850" />
                                    <rect x="7" y="3" width="3" height="17" rx="1" fill="#8a7860" />
                                    {/* Seat */}
                                    <rect x="5" y="20" width="26" height="4" rx="1" fill="#9a8870" />
                                    {/* Cushion on seat */}
                                    <ellipse cx="20" cy="22" rx="11" ry="2" fill="#b09870" />
                                    {/* Pole */}
                                    <rect x="27" y="24" width="2" height="8" fill="#666" />
                                    {/* Base shadow */}
                                    <ellipse cx="28" cy="33" rx="10" ry="2" fill="rgba(0,0,0,0.12)" />
                                    {/* Base wheels */}
                                    <ellipse cx="28" cy="32" rx="10" ry="1.5" fill="#555" />
                                    <circle cx="20" cy="32" r="1.2" fill="#777" />
                                    <circle cx="28" cy="32" r="1.2" fill="#777" />
                                    <circle cx="36" cy="32" r="1.2" fill="#777" />
                                </svg>
                            </div>
                        ))}
                    </div>
                    <div className="my-company-zone my-company-zone--work">
                        <button
                            type="button"
                            className={`my-company-zone-label my-company-zone-label--clickable${zoneFilter === 'work' ? ' is-active' : ''}`}
                            onClick={() => setZoneFilter(zoneFilter === 'work' ? null : 'work')}
                            title={t('myCompany.zoneFilterHint', '点击只看该区域')}
                        >
                            {t('myCompany.workArea')}
                        </button>
                        {zoneSlots.work.map((s, i) => (
                            <Workstation
                                key={`ws-${i}`}
                                slot={s}
                                agent={workAgentsByIndex.get(i) || null}
                            />
                        ))}
                    </div>
                    <div className="my-company-zone my-company-zone--rest">
                        <button
                            type="button"
                            className={`my-company-zone-label my-company-zone-label--clickable${zoneFilter === 'rest' ? ' is-active' : ''}`}
                            onClick={() => setZoneFilter(zoneFilter === 'rest' ? null : 'rest')}
                            title={t('myCompany.zoneFilterHint', '点击只看该区域')}
                        >
                            {t('myCompany.restArea')}
                        </button>
                    </div>
                    <div className="my-company-zone my-company-zone--standby">
                        <button
                            type="button"
                            className={`my-company-zone-label my-company-zone-label--clickable${zoneFilter === 'standby' ? ' is-active' : ''}`}
                            onClick={() => setZoneFilter(zoneFilter === 'standby' ? null : 'standby')}
                            title={t('myCompany.zoneFilterHint', '点击只看该区域')}
                        >
                            {t('myCompany.standby')}
                        </button>
                    </div>

                    {/* 环境氛围：光斑 / 尘埃 / 窗外云 */}
                    <AmbientLayer />

                    {/* Agents */}
                    {filteredPlacements.map((p, idx) => {
                        // 入场前：放在屏幕外左侧
                        // 入场后：放真实 slot
                        const displaySlot = hasEntered
                            ? p.slot
                            : { left: -15, top: 80 + (idx % 4) * 4 };
                        const enterDelay = hasEntered ? 0 : idx * 60;
                        const agentClass = [
                            'fox-agent',
                            `fox-agent--${p.zone}`,
                            `fox-agent--${p.pose}`,
                            p.zone === 'work' && p.agent.status === 'running' ? 'fox-agent--typing' : '',
                            p.zone === 'work' && p.agent.status === 'running' && isOffline(p.agent) ? 'fox-agent--offline' : '',
                            p.agent.status === 'error' ? 'fox-agent--error' : '',
                        ].filter(Boolean).join(' ');
                        return (
                            <button
                                type="button"
                                key={p.agent.id}
                                className={agentClass}
                                style={{
                                    left: `${displaySlot.left}%`,
                                    top: `${displaySlot.top}%`,
                                    transitionDelay: `${enterDelay}ms`,
                                }}
                                onClick={() => onAgentClick(p.agent.id)}
                                onMouseEnter={(e) => {
                                    setHovered(p.agent.id);
                                    setHoverPos({ x: e.clientX, y: e.clientY });
                                }}
                                onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => {
                                    setHovered((h) => (h === p.agent.id ? null : h));
                                    setHoverPos(null);
                                }}
                                onFocus={(e) => {
                                    setHovered(p.agent.id);
                                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setHoverPos({ x: r.left + r.width / 2, y: r.top });
                                }}
                                onBlur={() => {
                                    setHovered((h) => (h === p.agent.id ? null : h));
                                    setHoverPos(null);
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ x: e.clientX, y: e.clientY, agent: p.agent });
                                }}
                                aria-label={`${p.agent.name} — ${p.agent.status}`}
                            >
                                <Fox pose={p.pose} name={p.agent.name} agentId={p.agent.id} />
                                <StatusBadge agent={p.agent} />
                                {p.zone === 'rest' && p.restActivity ? (
                                    <RestActivity activity={p.restActivity} />
                                ) : null}
                            </button>
                        );
                    })}

                    {/* Hover detail card — single instance, 1s delay */}
                    {hoveredAgent && hoverPos && (
                        <AgentHoverCard agent={hoveredAgent} pos={hoverPos} />
                    )}

                    {/* Context menu */}
                    {contextMenu && (
                        <ContextMenu
                            pos={contextMenu}
                            agent={contextMenu.agent}
                            onClose={() => setContextMenu(null)}
                            onAction={(action) => {
                                if (action === 'message') onAgentClick(contextMenu.agent.id);
                                else if (action === 'detail') navigate(`/agents/${contextMenu.agent.id}`);
                                else if (action === 'status') {
                                    const next = contextMenu.agent.status === 'running' ? 'idle' : 'running';
                                    queryClient.setQueryData<Agent[]>(['agents-for-my-company', tenantId], (old) => {
                                        if (!old) return old;
                                        return old.map((a) => a.id === contextMenu.agent.id ? { ...a, status: next as any } : a);
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['agents-for-my-company', tenantId] });
                                }
                            }}
                        />
                    )}
                </div>
                </>
            )}
        </div>
    );
}

function badgeKey(agent: Agent): string {
    if (isAgentExpired(agent)) return 'statusExpired';
    if (isOkrAgent(agent)) return 'statusOkr';
    if (agent.status === 'running' && isOffline(agent)) return 'statusDisconnected';
    if (agent.status === 'running') return 'statusWorking';
    if (agent.status === 'creating') return 'statusCreating';
    if (agent.status === 'error') return 'statusError';
    if (agent.status === 'stopped') return 'statusStopped';
    return 'statusResting';
}
