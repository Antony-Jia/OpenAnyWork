import type { ButlerDispatchIntent } from "./tools"

export type ButlerDispatchPolicy = "standard" | "single_task_first"

export interface ButlerPromptMemoryHint {
  threadId: string
  title?: string
  summaryBrief: string
}

export interface ButlerPromptRecentTask {
  id: string
  title: string
  mode: ButlerDispatchIntent["mode"]
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  threadId: string
  createdAt: string
}

export interface ButlerPromptContext {
  userMessage: string
  capabilityCatalog: string
  capabilitySummary: string
  dispatchPolicy?: ButlerDispatchPolicy
  profileText?: string
  comparisonText?: string
  memoryHints: ButlerPromptMemoryHint[]
  previousUserMessage?: string
  recentTasks: ButlerPromptRecentTask[]
}

const CLARIFICATION_PREFIX = "CLARIFICATION_REQUIRED:"

function formatMemoryHints(memoryHints: ButlerPromptMemoryHint[]): string {
  if (memoryHints.length === 0) {
    return "none"
  }
  return memoryHints
    .map((hint, index) => {
      const title = hint.title ? ` (${hint.title})` : ""
      return `${index + 1}. ${hint.threadId}${title}: ${hint.summaryBrief}`
    })
    .join("\n")
}

function formatRecentTasks(tasks: ButlerPromptRecentTask[]): string {
  if (tasks.length === 0) return "none"
  return tasks
    .map((task, index) => {
      return `${index + 1}. [${task.mode}/${task.status}] ${task.title} | thread=${task.threadId} | createdAt=${task.createdAt}`
    })
    .join("\n")
}

function formatDispatchPolicy(policy?: ButlerDispatchPolicy): string {
  if (policy === "single_task_first") {
    return [
      "single_task_first",
      "默认将单一业务目标编排为 1 个任务；把步骤写入同一任务的 initialPrompt/loopConfig.contentTemplate。",
      "仅当存在两个及以上语义独立、可独立交付、失败互不影响的目标时，才允许拆分。"
    ].join("\n")
  }

  return [
    "standard",
    "可创建多个任务，但只有在目标语义独立时才拆分；避免把同一目标的执行步骤拆成 DAG。"
  ].join("\n")
}

export function getClarificationPrefix(): string {
  return CLARIFICATION_PREFIX
}

export function buildButlerSystemPrompt(): string {
  return `
你是 OpenAnyWork 的 Butler AI 编排器。
你是唯一的语义路由器，禁止使用关键词匹配策略。

核心目标：
1) 语义理解用户意图。
2) 决定以下其一：
   - 直接回复（不调用工具），
   - 澄清追问（不调用工具），
   - 派发一个或多个任务（调用工具）。
3) 派发时只能使用以下 4 个工具：
   - create_default_task
   - create_ralph_task
   - create_email_task
   - create_loop_task

工具用途说明：
- create_default_task：通用任务模式。适用于信息收集、内容生成、数据整理、问答等一般性任务。
  可选 deliverableFormat（"text" | "data" | "table" | "page"）指定输出格式。
  示例场景：汇总新闻、生成报告、整理资料、翻译文档等。
- create_ralph_task：迭代式开发/实现任务模式。及其复杂的任务，需要反复验证直到满足验收标准。
  必填 acceptanceCriteria（string[]）定义验收条件，可选 maxIterations（number，1-50）限制最大迭代次数。
  示例场景：实现功能模块、修复 Bug、重构代码等需要多轮迭代验证的开发任务，或者需要多角色讨论、研讨、明确问题。。
- create_email_task：邮件处理任务模式。这种模式下是可以通过邮件远程控制任务，例如停止、重启、发送新的命令，结果也可以发送等。
  必填 emailIntent（string）描述邮件意图，可选 recipientHints（string[]）提示收件人，可选 tone（string）指定语气风格。
  示例场景：客户不在电脑旁也可以完成任务。
- create_loop_task：周期/循环任务模式。适用于需要定时或基于事件触发反复执行的任务。
  必填 loopConfig，包含触发器配置，支持三种触发方式：
    - schedule：基于 cron 表达式定时触发。
    - api：定时轮询 API 并根据条件（equals/contains/truthy）判断是否执行。
    - file：监听文件系统变化触发。
  示例场景：定时发送日报、周期性监控服务状态、监听文件变更自动处理等。

每个工具都可以完成复杂任务，不要将一个复杂任务拆分成多个简单任务。除非是完全不相关的任务。

派发规则：
- 一轮对话中可以创建多个任务。
- 注意不要随意创建多个任务，上面所述4个任务都可以完成复杂的任务，不要将一个复杂任务拆分成多个简单任务。除非是完全不相关的任务。
  例如“周期性发送日报”，这种的就不需要拆分为多个任务，周期任务足够完成。
- [Dispatch Policy] 为 single_task_first 时，默认只创建 1 个任务，把检索/去重/发送等步骤写入该任务 prompt，不要拆成步骤 DAG。
- [Dispatch Policy] 为 single_task_first 时，仅允许在“用户请求中包含两个及以上语义独立目标”时拆分多任务。
- 反例（不要这样拆）：
  用户：“创建一个周期任务，每30分钟检索AI新闻，去重并记录到news_send.json，再发给jiafan@duck.com”
  错误拆分：抓新闻任务 + 去重任务 + 邮件任务 + 循环任务。
- 正例（应该这样做）：
  同一请求只创建 1 个 loop 任务，在 loopConfig.contentTemplate 中包含检索、去重记录、发送全流程。
- 每个任务都应该有明确的意图和目标。
- 使用 dependsOn 通过 taskKey 构建依赖图。
- 无依赖的任务可并行执行。
- 有依赖的任务必须通过 dependsOn 保证串行。
- 如果关键信息缺失且无法生成有效的工具 JSON，则不要调用工具。
  以 "${CLARIFICATION_PREFIX}" 为前缀回复，仅询问关键问题。
- 如果能生成有效 JSON，优先派发，避免不必要的追问。

Thread strategy：
- "reuse_last_thread"：继续该 mode 下最近的相关线程。
- "new_thread"：创建新线程。

Handoff：
- method "context"：上游摘要传入下游 prompt。
- method "filesystem"：下游工作区接收 .butler_handoff.json。
- method "both"：同时使用以上两种机制。

JSON 字段约定（所有工具通用）：
- taskKey：本轮唯一标识。
- title：面向用户的任务标题。
- initialPrompt：传给 worker 线程的可执行 prompt。
- threadStrategy："new_thread" | "reuse_last_thread"。
- dependsOn：taskKey[]（可选）。
- handoff：{ method, note?, requiredArtifacts? }（可选）。

Mode 要求：
- default：deliverableFormat?（"text" | "data" | "table" | "page"）
- ralph：acceptanceCriteria（string[]，必填），maxIterations?（number）
- email：emailIntent（必填），recipientHints?（string[]），tone?（string）
- loop：loopConfig（必填且可执行）

输出规则：
- 调用工具后，为用户提供简洁的中文摘要。
- 禁止提及内部隐藏的思维链。
- 禁止在此编排器中直接调用任何业务工具。
`.trim()
}

export function buildButlerUserPrompt(context: ButlerPromptContext): string {
  const sections = [
    "[User Request]",
    context.userMessage.trim(),
    "",
    "[Dispatch Policy]",
    formatDispatchPolicy(context.dispatchPolicy),
    "",
    "[Capability Summary]",
    context.capabilitySummary,
    "",
    context.capabilityCatalog,
    "",
    "[Memory Hints]",
    formatMemoryHints(context.memoryHints),
    "",
    "[Previous User Message]",
    context.previousUserMessage?.trim() || "none",
    "",
    "[Recent Butler Tasks]",
    formatRecentTasks(context.recentTasks),
    "",
    "[Daily Profile]",
    context.profileText?.trim() || "none",
    "",
    "[Profile Delta]",
    context.comparisonText?.trim() || "none",
    "",
    "[Instruction]",
    "Use semantic reasoning. If dispatch is feasible, call creation tools with valid JSON. If not feasible, respond with clarification prefix."
  ]
  return sections.join("\n")
}

export function parseButlerAssistantText(raw: string): {
  assistantText: string
  clarification: boolean
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { assistantText: "", clarification: false }
  }

  if (trimmed.startsWith(CLARIFICATION_PREFIX)) {
    const stripped = trimmed.slice(CLARIFICATION_PREFIX.length).trim()
    return {
      assistantText: stripped || "请补充关键信息。",
      clarification: true
    }
  }

  return {
    assistantText: trimmed,
    clarification: false
  }
}
