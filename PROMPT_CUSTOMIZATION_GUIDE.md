# Prompt 修改指南（模式 + Butler）

本文档说明如何修改以下 Prompt：
- 主 Agent 模式 Prompt：`default` / `ralph` / `loop` / `email`
- Butler AI Prompt（编排器 + 感知提醒）

## 1. 总体结构

### 1.1 主 Agent（createDeepAgent 链路）

主 Agent 的系统 Prompt 已改为“按模式加载”，核心入口：
- `src/main/agent/runtime.ts`
  - `createAgentRuntime(options)`
  - 内部调用 `composeAgentSystemPrompt(...)` 组装最终系统 Prompt

Prompt 组装器：
- `src/main/agent/prompts/index.ts`
  - `resolveAgentPromptMode(threadMode?)`
  - `buildModePrompt(mode, context)`
  - `composeAgentSystemPrompt(input)`

模式 Prompt 文件：
- `src/main/agent/prompts/modes/default.ts`
- `src/main/agent/prompts/modes/ralph.ts`
- `src/main/agent/prompts/modes/loop.ts`
- `src/main/agent/prompts/modes/email.ts`

共享基座：
- `src/main/agent/prompts/base.ts` -> 调用 `src/main/agent/system-prompt.ts` 的 `getBaseSystemPrompt(...)`

### 1.2 Butler AI（独立于主 Agent）

Butler 不走 `src/main/agent/prompts/*`，而是独立体系：
- `src/main/butler/prompt.ts`
  - `buildButlerSystemPrompt()`：Butler 编排器 system prompt
  - `buildButlerPerceptionSystemPrompt()`：监听事件提醒 system prompt
  - `buildButlerPerceptionUserPrompt(...)`：感知输入 user prompt
- `src/main/butler/prompt/composer.ts`
  - `composeButlerUserPrompt(...)`：把多个 section 拼成编排 user prompt

Section 文件：
- `src/main/butler/prompt/sections/overview.ts`
- `src/main/butler/prompt/sections/temporal.ts`
- `src/main/butler/prompt/sections/retry.ts`
- `src/main/butler/prompt/sections/memory.ts`
- `src/main/butler/prompt/sections/router.ts`
- `src/main/butler/prompt/sections/capabilities.ts`

运行时绑定：
- `src/main/butler/runtime.ts`
  - `createButlerRuntime(...)` 内 `systemPrompt: buildButlerSystemPrompt()`
  - `createButlerRuntime(...)` 会注入 Butler 作用域已启用 tools，并挂载安全中间件阻断系统/文件类工具
  - `runButlerOrchestratorTurn(...)` 内 `composeButlerUserPrompt(...)`
  - `runButlerPerceptionTurn(...)` 内感知 system/user prompt

## 2. 主 Agent 模式 Prompt：修改位置与方法

## 2.1 Prompt 组装顺序（固定）

`composeAgentSystemPrompt(...)` 当前顺序：
1. Base Prompt（共享规则）
2. Workspace/Path 段
3. Docker 段（按需）
4. Mode 段（default/ralph/loop/email）
5. Current time 段
6. `extraSystemPrompt`（可选，最后追加）

文件位置：
- `src/main/agent/prompts/index.ts`

如需调整顺序，修改 `sections` 数组的排列。

## 2.2 修改某个模式 Prompt（最常见）

直接改对应文件：
- `default`：`src/main/agent/prompts/modes/default.ts` -> `buildDefaultModePrompt`
- `ralph`：`src/main/agent/prompts/modes/ralph.ts` -> `buildRalphModePrompt`
- `loop`：`src/main/agent/prompts/modes/loop.ts` -> `buildLoopModePrompt`
- `email`：`src/main/agent/prompts/modes/email.ts` -> `buildEmailModePrompt`

说明：
- `email` 模式会动态注入 `threadId`，函数在 `buildEmailModePromptForThread(threadId)`。
- 兼容壳仍保留在 `src/main/email/prompt.ts`（deprecated，内部转调新实现）。

## 2.3 模式选择逻辑（切换映射）

文件：
- `src/main/agent/prompts/index.ts`

函数：
- `resolveAgentPromptMode(threadMode?)`

你可以在这里定义 `ThreadMode -> AgentPromptMode` 映射。
当前 `butler` 或未知模式会回退到 `default`。

## 2.4 模式从哪里传入

关键透传点：
- `src/main/agent/run.ts` -> `runAgentStream(...)` 参数 `threadMode?: ThreadMode`
- `src/main/agent/runtime.ts` -> `createAgentRuntime(...)` 参数 `threadMode?: ThreadMode`

调用方：
- `src/main/ipc/agent.ts`
  - 从 `metadata.mode` 取 mode，并在所有 `runAgentStream(...)` 调用传 `threadMode: mode`
  - `agent:resume` / `agent:interrupt` 直调 runtime 也会传 `threadMode`
- `src/main/loop/manager.ts`
  - 运行 loop 时显式 `threadMode: "loop"`
- `src/main/email/worker.ts`
  - 邮件流程显式 `threadMode: "email"`
- `src/main/butler/task-dispatcher.ts`
  - Butler 派发的任务线程使用 `threadMode: task.mode`

## 2.5 Ralph 的“额外用户 Prompt”位置（很重要）

除了模式 system prompt，Ralph 还有两段特殊用户 prompt（不在 modes 目录）：
- `src/main/ipc/agent.ts`
  - `buildRalphInitPrompt(userMessage)`：初始化阶段 prompt
  - 迭代阶段字符串（`Ralph 迭代 i/maxIterations` 那段数组拼接）

如果你要调整 Ralph 的计划格式、/confirm 行为、迭代指令，请改这里。

## 3. Butler Prompt：修改位置与方法

## 3.1 修改 Butler 编排器 system prompt

文件：
- `src/main/butler/prompt.ts`

函数：
- `buildButlerSystemPrompt()`

适合改：
- 任务工具约束（create_default_task / create_ralph_task / create_email_task / create_loop_task / create_expert_task）
- 日常工具路由策略（calendar_upsert / countdown_upsert / query_calendar_events / query_countdown_timers / pull_rss_updates / query_rss_items / query_mailbox）
- 拆分策略、依赖策略、输出规范、模式字段要求

## 3.2 修改 Butler 编排 user prompt 的结构

文件：
- `src/main/butler/prompt/composer.ts`

函数：
- `composeButlerUserPrompt(...)`
- `DEFAULT_SECTION_PIPELINE`

你可以：
- 调整 section 顺序
- 新增 section builder
- 控制每段输出的拼接规则

## 3.3 修改 Butler 各 section 内容

对应文件与函数：
- `overview`：`src/main/butler/prompt/sections/overview.ts` -> `buildOverviewSection`
- `temporal`：`src/main/butler/prompt/sections/temporal.ts` -> `buildTemporalSection`
- `retry`：`src/main/butler/prompt/sections/retry.ts` -> `buildRetrySection`
- `memory`：`src/main/butler/prompt/sections/memory.ts` -> `buildMemorySection`
- `router`：`src/main/butler/prompt/sections/router.ts` -> `buildRouterSection`
- `capabilities`：`src/main/butler/prompt/sections/capabilities.ts` -> `buildCapabilitiesSection`

建议：
- 业务规则尽量放 `overview/retry/router`
- 动态上下文尽量放 `memory/capabilities`

## 3.4 修改 Butler 感知提醒 Prompt

文件：
- `src/main/butler/prompt.ts`

函数：
- `buildButlerPerceptionSystemPrompt()`
- `buildButlerPerceptionUserPrompt(context)`

适合改：
- 提醒文风、长度、输出格式
- 感知输入内容组织方式

## 3.5 Runtime 绑定点（确认改动是否生效）

文件：
- `src/main/butler/runtime.ts`

函数：
- `createButlerRuntime(...)`：绑定 `buildButlerSystemPrompt()`
- `runButlerOrchestratorTurn(...)`：构建 user prompt 并执行
- `runButlerPerceptionTurn(...)`：感知模型调用

如果改了 prompt 但行为没变化，优先检查这里是否仍使用了旧函数。

## 4. 常见修改任务示例

## 4.1 修改 email 模式“完成后必须发邮件”的文案

改：
- `src/main/agent/prompts/modes/email.ts` 的 `buildEmailModePromptForThread(...)`

## 4.2 调整 loop 模式的行为边界

改：
- `src/main/agent/prompts/modes/loop.ts` 的 `buildLoopModePrompt(...)`

如果要改 loop 触发数据模板，另改：
- `src/main/loop/manager.ts`（`finalMessage` 组装逻辑）

## 4.3 增强 Butler 的“少拆任务”策略

改：
- `src/main/butler/prompt.ts` 的 `buildButlerSystemPrompt()`
- 可选配套改 `src/main/butler/prompt/sections/overview.ts` 的 dispatch policy 文案

## 5. 新增一个模式 Prompt（例如 `research`）的最小步骤

1. 扩展类型：
- `src/main/agent/prompts/types.ts` 的 `AgentPromptMode`

2. 新建模式文件：
- `src/main/agent/prompts/modes/research.ts`

3. 注册到分发器：
- `src/main/agent/prompts/index.ts`
  - import 新 mode builder
  - 更新 `resolveAgentPromptMode(...)`
  - 更新 `buildModePrompt(...)`

4. 确保调用链能传入对应 `threadMode`（若已有 metadata.mode 则通常无需额外改）

## 6. 修改后的验证建议

至少执行：
```bash
npm run typecheck:node
```

建议手测场景：
- default 线程一次普通问答
- ralph 线程：初始化 + `/confirm` 迭代
- loop 线程：触发一次自动运行
- email 线程：确认 send_email 约束仍在
- Butler 编排：观察是否按新规则派发
- Butler 感知：观察提醒输出格式是否符合预期
