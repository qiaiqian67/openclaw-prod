/**
 * validate 报告美化测试（纯函数：classifyError / formatValidationReport）
 * 用与 parser.ts 完全一致的错误字符串作输入，确保分类/分组/排序/清洗正确。
 */
import { classifyError, classifyErrors, formatValidationReport, buildValidationReport } from '../src/cli/validate-report.js';

let passed = 0, failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.log(`  ❌ ${name}: ${err instanceof Error ? err.message : err}`); failed++; }
}
function assert(c: boolean, msg: string): void { if (!c) throw new Error(msg); }

console.log('\n=== classifyError ===');

test('依赖错误 → step/dependency', () => {
  const f = classifyError('step "b" 依赖不存在的 step: "x"');
  assert(f.scope === 'step' && f.stepId === 'b' && f.category === 'dependency', JSON.stringify(f));
});

test('变量错误 → step/variable，去掉 step 前缀', () => {
  const f = classifyError('step "c" 引用了未定义的变量: {{v}}');
  assert(f.category === 'variable' && f.stepId === 'c', JSON.stringify(f));
  assert(f.message === '引用了未定义的变量: {{v}}', `应去前缀: ${f.message}`);
});

test('角色错误 → step/role，路径缩短 + hint 提取', () => {
  const raw = 'step "a" 的 role 无法加载: 角色文件不存在: /abs/x/engineering/backend-architect.md\n        你是不是想用 / Did you mean: engineering/engineering-backend-architect';
  const f = classifyError(raw);
  assert(f.category === 'role' && f.stepId === 'a', JSON.stringify(f));
  assert(f.message === '角色 "engineering/backend-architect" 不存在', `路径应缩短: ${f.message}`);
  assert(!!f.hint && f.hint.includes('engineering-backend-architect'), `应有建议 hint: ${f.hint}`);
});

test('loop 错误 → step/loop', () => {
  const f = classifyError('step "s" 的 loop 缺少 exit_condition');
  assert(f.category === 'loop' && f.stepId === 's', JSON.stringify(f));
});

test('output 重名 → workflow/output', () => {
  const f = classifyError('output 变量 "x" 被多个 step 同时产出: a, b（重名会让下游引用结果不确定）');
  assert(f.scope === 'workflow' && f.category === 'output', JSON.stringify(f));
});

test('循环依赖 → workflow/cycle', () => {
  const f = classifyError('工作流存在循环依赖');
  assert(f.scope === 'workflow' && f.category === 'cycle', JSON.stringify(f));
});

console.log('\n=== formatValidationReport ===');

const sample = [
  'output 变量 "shared" 被多个 step 同时产出: a, b（重名会让下游引用结果不确定）',
  'step "a" 引用了未定义的变量: {{missing}}',
  'step "a" 的 role 无法加载: 角色文件不存在: /x/engineering/backend-architect.md\n        你是不是想用 / Did you mean: engineering/engineering-backend-architect',
  'step "b" 依赖不存在的 step: "nope"',
];

test('报告含问题总数', () => {
  const r = formatValidationReport('WF', sample, ['a', 'b']);
  assert(r.includes('校验失败 (4 个问题)'), r);
});

test('工作流级分组在 step 分组之前', () => {
  const r = formatValidationReport('WF', sample, ['a', 'b']);
  assert(r.indexOf('工作流级') < r.indexOf('step "a"'), '工作流级应在前');
});

test('step 按 stepOrder 顺序出现', () => {
  const r = formatValidationReport('WF', sample, ['a', 'b']);
  assert(r.indexOf('step "a"') < r.indexOf('step "b"'), 'a 应在 b 前');
});

test('同一 step 内角色排在变量之前（优先级）', () => {
  const r = formatValidationReport('WF', sample, ['a', 'b']);
  const aBlock = r.slice(r.indexOf('step "a"'), r.indexOf('step "b"'));
  assert(aBlock.indexOf('[角色]') < aBlock.indexOf('[变量]'), `角色应优先: ${aBlock}`);
});

test('结构性错误存在时给优先级提示', () => {
  const r = formatValidationReport('WF', sample, ['a', 'b']);
  assert(r.includes('建议优先修复'), '应有优先级提示');
});

test('只有变量错误时不给结构性提示', () => {
  const r = formatValidationReport('WF', ['step "a" 引用了未定义的变量: {{v}}'], ['a']);
  assert(!r.includes('建议优先修复'), '纯变量错误不该提示结构性优先');
});

test('未在 stepOrder 中的 step 也会被渲染', () => {
  const r = formatValidationReport('WF', ['step "z" 依赖不存在的 step: "q"'], []);
  assert(r.includes('step "z"'), '应渲染未知顺序的 step');
});

test('classifyErrors 批量长度一致', () => {
  assert(classifyErrors(sample).length === sample.length, '长度应一致');
});

console.log('\n=== buildValidationReport (--json) ===');

test('无错误 → valid:true, findings 空', () => {
  const r = buildValidationReport('WF', 3, 1, []);
  assert(r.valid === true && r.findings.length === 0, JSON.stringify(r));
  assert(r.steps === 3 && r.inputs === 1 && r.name === 'WF', JSON.stringify(r));
});

test('有错误 → valid:false, findings 结构化', () => {
  const r = buildValidationReport('WF', 2, 0, ['step "a" 引用了未定义的变量: {{v}}']);
  assert(r.valid === false && r.findings.length === 1, JSON.stringify(r));
  assert(r.findings[0].category === 'variable' && r.findings[0].stepId === 'a', JSON.stringify(r.findings[0]));
});

test('报告对象可被 JSON 序列化且往返一致', () => {
  const r = buildValidationReport('WF', 1, 0, ['step "z" 依赖不存在的 step: "q"']);
  const round = JSON.parse(JSON.stringify(r));
  assert(round.findings[0].category === 'dependency', JSON.stringify(round));
});

console.log('\n' + '='.repeat(50));
console.log(`  Validate-report 测试: ${passed} 通过, ${failed} 失败 (共 ${passed + failed} 项)`);
if (failed === 0) console.log('  全部通过!');
else process.exit(1);
console.log('='.repeat(50) + '\n');
