# Clawith 待开发清单

本文件用于集中记录本项目尚未实现或有待完善的功能/任务，由 Claude 协助维护。

## 维护说明

- **优先级**：高 / 中 / 低
  - 高：影响核心功能、生产可用性、阻塞性问题
  - 中：增强体验、扩展集成、补全已有功能边界
  - 低：锦上添花、优化、重构、技术债清理
- **状态**：待开始 / 进行中 / 已完成 / 已搁置
- 完成任务后请将状态改为 `已完成`，并保留记录作为历史参考
- 每条新待办追加到对应优先级分组的末尾即可

---

## 高优先级

> 影响核心功能或生产可用性，需优先处理

- [ ] **【待开始】** 招聘市场 — Agent 模型加 `is_public` + 公开列表/发布 API
  - 描述：在 `Agent` 模型新增 `is_public` 字段（租户内可切换），新增发布/取消发布 API（仅本租户 agent），以及跨租户的公开 agent 列表 API（分页 + 关键词搜索 + 分类筛选）；列表返回 Agent 表中所有公开字段
  - 涉及文件/模块：backend/app/models/agent.py、backend/app/api/agents.py、backend/app/schemas/、alembic 迁移
  - 添加日期：2026-06-08

- [ ] **【待开始】** 招聘市场 — 前端 `/marketplace` 页面 + 路由 + Agent 列表页发布按钮
  - 描述：新增独立路由 `/marketplace` 与页面，展示所有 `is_public=True` 的智能体卡片（展示 Agent 全部公开字段）；支持关键词搜索/分类筛选/详情跳转；在现有 Agent 列表/详情页增加"发布到市场"开关
  - 涉及文件/模块：frontend/src/pages/、frontend/src/router/、frontend/src/components/
  - 添加日期：2026-06-08

- [ ] **【待开始】** 协调员 AgentTemplate 模板（基于 `chief-of-staff` 改造）
  - 描述：参照 `backend/agent_templates/chief-of-staff/` 结构，新建 `team-coordinator/` 子目录（含 `meta.yaml` / `soul.md` / `bootstrap.md`）；soul 内容侧重：多轮需求收集、角色拆解、团队组建、市场匹配、创建审批；`category` 设为 `coordinator`
  - 涉及文件/模块：backend/agent_templates/team-coordinator/（新建）、backend/app/services/template_seeder.py:445 启动时注册
  - 添加日期：2026-06-08

- [ ] **【待开始】** `seed_coordinator_for_tenant` 服务 + Agent/Tenant 字段迁移
  - 描述：参照 `seed_okr_agent_for_tenant`（agent_seeder.py:876）实现 `seed_coordinator_for_tenant(tenant_id, creator_id)`：拷贝 `team-coordinator` 模板 → 实例化 Agent（含 soul.md/工具集）→ 写回 `Tenant.coordinator_agent_id`；alembic 迁移：Agent 加 `is_default_coordinator: bool`，Tenant 加 `coordinator_agent_id: FK(agents.id)`（参照 `OKRSettings.okr_agent_id`）
  - 涉及文件/模块：backend/app/services/agent_seeder.py、backend/app/models/agent.py:103、backend/app/models/tenant.py、alembic 迁移
  - 添加日期：2026-06-08

- [ ] **【待开始】** 协调员 seed 触发入口（参照 OKR 启用模式）— **等决策**
  - 描述：参照 `seed_okr_agent_for_tenant`（agent_seeder.py:876）的现有触发模式（首次启用 OKR 时由 `okr.py:557` 触发），为协调员提供对等的启用入口；不在 `tenants.py:152` 的 `self_create_company` 加 hook，避免破坏现有公司创建流程；具体触发方式待定（首登提示启用 / 显式开关 / 创建公司时占位 + 首登确认，三选一）
  - 涉及文件/模块：backend/app/api/okr.py:557、backend/app/services/agent_seeder.py:876
  - 添加日期：2026-06-08

- [ ] **【待开始】** 协调员核心工具集：4 个新工具（注册到 tool_seeder.py）
  - 描述：基于现有 `agent_tools.py`/`tool_seeder.py` 模式新增：
    - `list_tenant_agents` — 列出本租户全部 agent
    - `search_agents` — 按 `category` + `capability_bullets` 关键词检索本租户 + `is_public` 公开（为后续市场匹配做准备）
    - `propose_agent_creation` — 基于需求生成草稿（name/role/capabilities/draft_soul），提交 `AgentCreationRequest` 进入审批
    - `create_agent_for_tenant` — 审批通过后实际执行创建（拷贝模板 + 写入）
  - 涉及文件/模块：backend/app/services/agent_tools.py、backend/app/services/tool_seeder.py:68
  - 添加日期：2026-06-08

- [ ] **【待开始】** Agent 搜索/匹配 API + 服务（标签+关键词 MVP）
  - 描述：新增 `GET /api/marketplace/agents/search` 端点 + `services/team_builder.search_agents()` 服务；按 `AgentTemplate.category` 过滤 + `role_description`/`bio`/`capability_bullets` 关键词命中排序；返回 Top-N + 命中片段理由；后续可叠加向量相似度（无需引入新依赖，先用 PG 全文或 LIKE）
  - 涉及文件/模块：backend/app/api/marketplace.py（新建）、backend/app/services/team_builder.py（新建）
  - 添加日期：2026-06-08

- [ ] **【待开始】** `AgentCreationRequest` 模型 + 审批 API（独立于现有 `ApprovalRequest`）
  - 描述：现有 `ApprovalRequest`（audit.py:27）与 `agent_id` 强绑定，不适合"先审批后创建"；新建独立模型：字段含 `tenant_id / proposer_agent_id / proposer_user_id / proposed_name / proposed_role / proposed_capabilities / draft_soul / status: pending|approved|rejected / reviewer_id / resolution_note`；审批人限定为本租户 `org_admin`（参照 autonomy_service.py:108-110 模式）；通过后调用 `create_agent_for_tenant` 实际创建
  - 涉及文件/模块：backend/app/models/agent_creation_request.py（新建）、backend/app/api/agent_creation.py（新建）、alembic 迁移
  - 添加日期：2026-06-08

- [ ] **【待开始】** 协调员需求对话编排（复用 `Onboarding` phase 状态机）
  - 描述：复用 `backend/app/services/onboarding.py` 的 phase 机制驱动协调员多轮对话：greeted → collecting_requirements → decomposed → matching → building_team → done；每阶段触发对应工具调用（拆解 → 搜索 → 提议创建）
  - 涉及文件/模块：backend/app/services/onboarding.py、backend/app/services/agent_tools.py
  - 添加日期：2026-06-08

- [ ] **【待开始】** 前端 — 协调员聊天入口（首登即看到）+ 审批中心
  - 描述：协调员作为公司级唯一固定入口展示（首登直接进入对话）；审批中心 `/approvals` 复用现有页面风格，列出 `AgentCreationRequest`（带详情预览：拟创建的 agent 信息 + 草稿 soul.md 渲染），管理员可批准/驳回/编辑后批准；接入 Notification 通知
  - 涉及文件/模块：frontend/src/pages/、frontend/src/router/、frontend/src/components/
  - 添加日期：2026-06-08

- [x] **【已完成】** 客户端安装界面 v5 重新设计（按参考图改造）
  - 描述：按 `client-nsis-installer-ui-current-design.md` 的 SOP 改造：1) 拿到参考图后解析配色/字体/版式/装饰元素（注意 57×57 header、164×314 sidebar 的硬约束）；2) 改 `client/build/installer/generate_assets.py` 的色常量与 `make_header_bmp`/`make_sidebar_bmp`；3) 跑 `python generate_assets.py` 看 `*_preview.png`；4) 同步改 `installer.nsh` 中英 LangString（1033/2052）；5) 跑 `npm run electron:build` 验证 NSIS 编译干净（无 warning/error）；6) 跑 `release/DeerClaw Client Setup *.exe` 实际看 7 个页面效果
  - 涉及文件/模块：client/build/installer/generate_assets.py、client/build/installer/installer.nsh
  - 添加日期：2026-06-08
  - 完成日期：2026-06-09
  - 备注：步骤 6 需用户手动在桌面运行安装器确认 7 个页面效果（headless 环境无法显示 NSIS GUI）

## 中优先级

> 增强体验或补全已有功能的边界

- [x] **【已完成】** 客户端安装包 — 添加 License 协议页
  - 描述：在 NSIS 安装流程中加 License 协议页：1) 准备 `client/build/LICENSE.rtf`（NSIS 只识别 RTF 格式）；2) `electron-builder.yml` 添加 `license: build/LICENSE.rtf`；3) `installer.nsh` 激活 `MUI_PAGE_LICENSE` 并补全 `MUI_LICENSEPAGE_TEXT_TOP/BOTTOM` LangString（中英 1033/2052）；4) 跑 `npm run electron:build` 验证
  - 涉及文件/模块：client/electron-builder.yml、client/build/installer/installer.nsh、client/build/LICENSE.rtf（新建）
  - 添加日期：2026-06-08
  - 完成日期：2026-06-09

- [x] **【已完成】** 客户端安装界面 — 清理 v4 死代码 + 启用 MUI_PAGE_WELCOME
  - 描述：v5 重写 `installer.nsh` 后已经不存在 v4 死代码（v4 第 46-50 行的 `MUI_WELCOMEPAGE_TITLE` / `MUI_WELCOMEPAGE_TEXT` / `MUI_LICENSEPAGE_TEXT_*` 全部清理），且 v5 已通过 `customWelcomePage` 钩子启用自定义欢迎页（不再用 MUI_PAGE_WELCOME 默认）；清理 + 启用两项都已随 v5 完成
  - 涉及文件/模块：client/build/installer/installer.nsh
  - 添加日期：2026-06-08
  - 完成日期：2026-06-09

- [x] **【已完成】** 客户端主题系统 — 新增 Apple 主题（5 套循环）+ MiniMax 品牌色谱升级
  - 描述：1) 按 `client/design/apple.md` 17 个 token 1:1 落地 Apple 主题（纯白 + Action Blue #0066cc + 博物馆级留白），写入 `[data-theme="apple"]` CSS 块；2) `Layout.tsx` `THEME_CYCLE` 从 4 扩到 5，加 `IconCamera` 图标（呼应 photography-first 语汇）；3) `i18n/en.json` + `i18n/zh.json` 加 `common.appleMode`；4) MiniMax 主题加 5 品牌色 + 2 渐变 + 10 处视觉锚点（顶色谱条、active 左条+洋红图标、btn 底条+双光晕、avatar 色谱、status 光环、badge 色谱、divider 色谱线、notification 紫渐变、logo 渐变字、section-title 渐变字），从"无印良品黑白"升到"vibrant gradient"；5) 全部改动锁在 `[data-theme=X]` 作用域，零结构/零布局/零主键变更；6) 完整 electron 打包验证：`release/DeerClaw Client Setup 0.1.0.exe` 73 MB + `DeerClaw Client 0.1.0.exe` 73 MB
  - 涉及文件/模块：client/web/index.css、client/web/pages/Layout.tsx、client/web/i18n/{en,zh}.json
  - 添加日期：2026-06-09
  - 完成日期：2026-06-09
  - 详见：`client/DEV-NOTES-THEMES.md`

## 低优先级

> 锦上添花、优化重构、技术债清理

- [ ] **【待开始】** <在此填写任务标题>
  - 描述：<具体要做什么>
  - 涉及文件/模块：<可选>
  - 添加日期：YYYY-MM-DD

---

## 已完成 / 已搁置

> 完成后移到这里归档，保留作为变更历史

- [x] **【已完成】** <示例：Microsoft Teams OAuth 接入>
  - 描述：补全 auth_provider.py 中 Teams 的三个占位方法
  - 涉及文件/模块：backend/app/services/auth_provider.py:766-772
  - 完成日期：YYYY-MM-DD