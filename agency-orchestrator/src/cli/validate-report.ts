/**
 * validate 报告美化：把 validateWorkflow() 的扁平 string[] 错误，
 * 分类 + 按 step 分组 + 按修复优先级排序后渲染。
 *
 * 重要：本模块只“读” validateWorkflow 的字符串输出，不改动其契约。
 * compose/mcp 仍消费原始 string[]，分类靠模式识别派生，互不影响。
 */

export type FindingCategory =
  | 'cycle' | 'role' | 'dependency' | 'output' | 'loop' | 'variable' | 'other';

export interface ValidationFinding {
  scope: 'workflow' | 'step';
  stepId?: string;
  category: FindingCategory;
  /** 首行错误信息 */
  message: string;
  /** 后续行（如“你是不是想用…”建议），已去缩进 */
  hint?: string;
}

// 修复优先级：结构性错误在前（它们常引发下游连锁报错），变量类在后
const CATEGORY_ORDER: FindingCategory[] = [
  'cycle', 'role', 'dependency', 'output', 'loop', 'variable', 'other',
];

const CATEGORY_LABEL: Record<FindingCategory, string> = {
  cycle: '循环依赖', role: '角色', dependency: '依赖',
  output: '输出', loop: '循环', variable: '变量', other: '其他',
};

/** 展示用的信息清洗：去掉与分组标题重复的 `step "X" ` 前缀、缩短角色绝对路径 */
function cleanMessage(first: string, stepId: string | undefined, category: FindingCategory): string {
  let m = first;
  if (stepId && m.startsWith(`step "${stepId}" `)) {
    m = m.slice(`step "${stepId}" `.length);
    if (m.startsWith('的 ')) m = m.slice('的 '.length);
  }
  if (category === 'role') {
    // 角色文件不存在: /abs/.../engineering/backend-architect.md → 角色 "engineering/backend-architect" 不存在
    const p = m.match(/角色文件不存在: .*?([^/\\]+[/\\][^/\\]+)\.md/);
    if (p) m = `角色 "${p[1].replace(/\\/g, '/')}" 不存在`;
  }
  return m;
}

/** 从一条错误字符串派生结构化分类 */
export function classifyError(raw: string): ValidationFinding {
  // 角色错误可能多行：首行是信息，其余（“你是不是想用…”）作为 hint
  const lines = raw.split('\n');
  const first = lines[0];
  let hint = lines.length > 1 ? lines.slice(1).map(l => l.trim()).filter(Boolean).join(' ') : undefined;
  // 建议文案精简掉双语前缀，留核心
  if (hint) hint = hint.replace(/^你是不是想用 \/ Did you mean:\s*/, '你是不是想用: ');

  const stepMatch = first.match(/^step "([^"]+)"/);
  if (stepMatch) {
    const stepId = stepMatch[1];
    let category: FindingCategory = 'other';
    if (first.includes('role 无法加载')) category = 'role';
    else if (first.includes('引用了未定义的变量')) category = 'variable';
    else if (first.includes('的 loop')) category = 'loop';
    else if (first.includes('依赖')) category = 'dependency';
    return { scope: 'step', stepId, category, message: cleanMessage(first, stepId, category), hint };
  }

  if (first.startsWith('output 变量')) {
    return { scope: 'workflow', category: 'output', message: first, hint };
  }
  if (first.includes('循环依赖')) {
    return { scope: 'workflow', category: 'cycle', message: first, hint };
  }
  return { scope: 'workflow', category: 'other', message: first, hint };
}

export function classifyErrors(errors: string[]): ValidationFinding[] {
  return errors.map(classifyError);
}

export interface ValidationReport {
  valid: boolean;
  name: string;
  steps: number;
  inputs: number;
  findings: ValidationFinding[];
}

/** 构造 --json 输出对象（纯函数，便于测试） */
export function buildValidationReport(
  name: string, stepCount: number, inputCount: number, errors: string[],
): ValidationReport {
  return {
    valid: errors.length === 0,
    name,
    steps: stepCount,
    inputs: inputCount,
    findings: classifyErrors(errors),
  };
}

function byCategory(a: ValidationFinding, b: ValidationFinding): number {
  return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
}

/**
 * 渲染分组报告。stepOrder 用于让 step 分组按工作流定义顺序出现。
 */
export function formatValidationReport(
  workflowName: string,
  errors: string[],
  stepOrder: string[] = [],
): string {
  const findings = classifyErrors(errors);
  const out: string[] = [];
  out.push(`  ${workflowName} — 校验失败 (${findings.length} 个问题)`);

  const render = (f: ValidationFinding) => {
    out.push(`    • [${CATEGORY_LABEL[f.category]}] ${f.message}`);
    if (f.hint) out.push(`        ↳ ${f.hint}`);
  };

  // 1) 工作流级问题在前
  const wf = findings.filter(f => f.scope === 'workflow').sort(byCategory);
  if (wf.length > 0) {
    out.push('');
    out.push(`  ⚠ 工作流级`);
    wf.forEach(render);
  }

  // 2) 按 step 分组（按定义顺序；未知顺序的 step 追加在后）
  const stepFindings = findings.filter(f => f.scope === 'step');
  const seen = stepFindings.map(f => f.stepId!);
  const ordered = [
    ...stepOrder.filter(id => seen.includes(id)),
    ...seen.filter(id => !stepOrder.includes(id)),
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  for (const id of ordered) {
    const group = stepFindings.filter(f => f.stepId === id).sort(byCategory);
    if (group.length === 0) continue;
    out.push('');
    out.push(`  ✗ step "${id}"`);
    group.forEach(render);
  }

  // 3) 优先级提示
  const hasStructural = findings.some(f =>
    f.category === 'cycle' || f.category === 'role' || f.category === 'dependency');
  if (hasStructural) {
    out.push('');
    out.push('  💡 角色/依赖/循环类错误会连带后续校验，建议优先修复。');
  }

  return out.join('\n');
}
