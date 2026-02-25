import type { ButlerDispatchIntent } from "./tools"
import type { ButlerDigestTaskCard, ButlerPerceptionInput } from "../types"
import { composeButlerUserPrompt } from "./prompt/composer"

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

export interface ButlerRetryPromptContext {
  failedTaskTitle: string
  failedTaskMode: ButlerDispatchIntent["mode"]
  failedTaskPrompt: string
  failureError: string
  originUserMessage: string
}

export interface ButlerPromptContext {
  userMessage: string
  capabilityCatalog: string
  capabilitySummary: string
  currentTimeIso?: string
  currentLocalTime?: string
  currentWeekday?: string
  currentTimezone?: string
  dispatchPolicy?: ButlerDispatchPolicy
  planningFocus?: "normal" | "retry_reassign"
  retryContext?: ButlerRetryPromptContext
  forcedMode?: ButlerDispatchIntent["mode"]
  profileText?: string
  comparisonText?: string
  memoryHints: ButlerPromptMemoryHint[]
  previousUserMessage?: string
  recentTasks: ButlerPromptRecentTask[]
}

export interface ButlerPerceptionPromptContext {
  perception: ButlerPerceptionInput
}

export interface ButlerDigestPromptContext {
  windowStart: string
  windowEnd: string
  tasks: ButlerDigestTaskCard[]
}

const CLARIFICATION_PREFIX = "CLARIFICATION_REQUIRED:"

export function getClarificationPrefix(): string {
  return CLARIFICATION_PREFIX
}

function formatPerceptionSnapshot(context: ButlerPerceptionPromptContext): string {
  const snapshot = context.perception.snapshot
  const calendarLines = snapshot.calendarEvents
    .slice(0, 5)
    .map((event, index) => `${index + 1}. ${event.title} @ ${event.startAt}`)
  const countdownLines = snapshot.countdownTimers
    .slice(0, 5)
    .map((timer, index) => `${index + 1}. ${timer.title} @ ${timer.dueAt} (${timer.status})`)
  const mailLines = snapshot.recentMails
    .slice(0, 5)
    .map(
      (mail, index) =>
        `${index + 1}. ${mail.subject || "(无主题)"} | from=${mail.from || "unknown"}`
    )
  const rssLines = snapshot.recentRssItems
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.title || "(无标题)"} | link=${item.link || "none"}`)

  return [
    "[Snapshot Summary]",
    `calendar_count=${snapshot.calendarEvents.length}`,
    `countdown_count=${snapshot.countdownTimers.length}`,
    `mail_rule_count=${snapshot.mailRules.length}`,
    `recent_mail_count=${snapshot.recentMails.length}`,
    `rss_subscription_count=${snapshot.rssSubscriptions.length}`,
    `recent_rss_count=${snapshot.recentRssItems.length}`,
    "",
    "[Calendar Top 5]",
    calendarLines.length > 0 ? calendarLines.join("\n") : "none",
    "",
    "[Countdown Top 5]",
    countdownLines.length > 0 ? countdownLines.join("\n") : "none",
    "",
    "[Recent Mail Top 5]",
    mailLines.length > 0 ? mailLines.join("\n") : "none",
    "",
    "[Recent RSS Top 5]",
    rssLines.length > 0 ? rssLines.join("\n") : "none"
  ].join("\n")
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
   - 直接调用日常操作工具完成请求，
   - 派发一个或多个任务（调用任务创建工具）。
3) 任务派发时可使用以下 5 个工具：
   - create_default_task
   - create_ralph_task
   - create_email_task
   - create_loop_task
   - create_expert_task
4) 日常操作优先直接工具调用，不必启动任务。重点工具：
   - calendar_upsert（action=create|update）
   - countdown_upsert（action=create|update）
   - query_calendar_events
   - query_countdown_timers
   - pull_rss_updates
   - query_rss_items（detailLevel=summary|detailed）
   - query_mailbox（mode=today|latest）

路由优先级（从高到低）：
1) 能直接回答就直接回答。
2) 关键信息缺失才澄清。
3) 可由日常工具直接完成时，优先调用日常工具（可多次调用）。
4) 必须长流程/跨角色/持续执行时，才创建任务。

任务创建工具说明：
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
- create_expert_task：专家串行协作模式。适用于需要多角色线性协作并可循环审稿/修订的复杂任务。
  必填 expertConfig，包含 experts（角色+prompt 顺序）与 loop（是否循环、最大轮次）。
  示例场景：写稿人→审稿人→校对人；开发者→Reviewer→测试工程师。

安全边界（强约束）：
- Butler 只能完成对话、日常工具操作、任务创建。
- Butler 不能操作系统命令，不能读写任意文件，不能调用文件系统类工具。
- 即使用户要求，也要拒绝执行系统/文件操作并给出替代方案（例如创建任务或使用允许的业务工具）。

派发规则：
- 一轮对话中可以创建多个任务。
- 注意不要随意创建多个任务，上述 5 个任务工具都可以完成复杂任务，不要把同一目标拆成多个步骤任务。除非是完全不相关的目标。
  例如“周期性发送日报”，这种的就不需要拆分为多个任务，周期任务足够完成。
- [Dispatch Policy] 为 single_task_first 时，默认只创建 1 个任务，把检索/去重/发送等步骤写入该任务 prompt，不要拆成步骤 DAG。
- [Dispatch Policy] 为 single_task_first 时，仅允许在“用户请求中包含两个及以上语义独立目标”时拆分多任务。
- 反例（不要这样拆）：
  用户：“创建一个周期任务，每30分钟检索AI新闻，去重并记录到news_send.json，再发给jiafan@duck.com”
  错误拆分：抓新闻任务 + 去重任务 + 邮件任务 + 循环任务。
- 正例（应该这样做）：
  同一请求只创建 1 个 loop 任务，在 loopConfig.contentTemplate 中包含检索、去重记录、发送全流程。
- 每个任务都应该有明确的意图和目标。
- 用户任务主体必须以 [User Request] 原文为唯一事实来源，不得改写、弱化、替换。
- initialPrompt 仅用于补充执行说明（addendum），不能重写用户任务主体。
- 用户在请求中明确提供了工作目录时，必须在工具 JSON 中填写 workspacePath。
- workspacePath 支持绝对路径，或相对于 butler.rootPath 的相对路径。
- 如果路径相关信息不足且无法安全生成可执行路径，先澄清/确认，不要直接派发。
- initialPrompt 中可追加用户习惯偏好，但不得改变目标、范围、时间、对象、格式、验收口径。
- initialPrompt 必须可执行，至少包含可落地的执行约束和验收补充。
- 使用 dependsOn 通过 taskKey 构建依赖图。
- 无依赖的任务可并行执行。
- 有依赖的任务必须通过 dependsOn 保证串行。
- 若输入中出现 [Retry Reassign Context]，你必须：
  - 只创建 1 个任务；
  - mode 必须与失败任务一致；
  - 在不改写用户任务主体前提下，在 initialPrompt 中补充错误修复策略。
- 涉及相对时间（如“三天后”“下周三”）时，必须结合 user prompt 中给出的当前时间、星期与时区先转换为绝对时间再调用查询或写入工具。
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
- initialPrompt：传给 worker 的补充执行说明（addendum），不是任务主体重写正文。
- threadStrategy："new_thread" | "reuse_last_thread"。
- workspacePath：可选；任务工作目录。支持绝对路径或相对 butler.rootPath 的路径。
- dependsOn：taskKey[]（可选）。
- handoff：{ method, note?, requiredArtifacts? }（可选）。

Mode 要求：
- default：deliverableFormat?（"text" | "data" | "table" | "page"）
- ralph：acceptanceCriteria（string[]，必填），maxIterations?（number）
- email：emailIntent（必填），recipientHints?（string[]），tone?（string）
- loop：loopConfig（必填且可执行）
- expert：expertConfig（必填，包含 experts[] 与 loop 配置）

输出规则：
- 调用工具后，为用户提供简洁的中文摘要。
- 禁止提及内部隐藏的思维链。
- 禁止声称已执行任何被安全边界禁止的系统/文件操作。
`.trim()
}

export function buildButlerPerceptionSystemPrompt(): string {
  return `
你是 OpenAnyWork 的 Butler 事件提醒助手。

目标：
1) 根据输入的监听事件（日历/倒计时/邮件/RSS）生成简洁中文提醒。
2) 不要调用任何工具，不要派发任务。
3) 仅输出提醒正文，不要输出 JSON、代码块、前后缀解释。

要求：
- 优先说明“发生了什么”“用户现在应做什么”。
- 1 到 3 句话，控制在 120 字内。
- 语气明确，不夸张。
`.trim()
}

export function buildButlerDigestSystemPrompt(): string {
  return `
你是 OpenAnyWork 的 Butler 服务总结助手。

目标：
1) 对一个时间窗口内的任务状态更新进行中文总结。
2) 仅输出 1 段自然语言总结，不要输出 JSON、列表符号前缀、代码块。
3) 总结应包含：总体进展、关键任务、异常/阻塞（若有）与下一步建议。

要求：
- 字数控制在 80~220 字。
- 表述准确，不编造。
- 若没有失败任务，可简要说明当前风险低。
`.trim()
}

export function buildButlerUserPrompt(context: ButlerPromptContext): string {
  return composeButlerUserPrompt(context, {
    clarificationPrefix: CLARIFICATION_PREFIX
  })
}

export function buildButlerPerceptionUserPrompt(context: ButlerPerceptionPromptContext): string {
  const perception = context.perception
  return [
    "[Triggered Event]",
    `id: ${perception.id}`,
    `kind: ${perception.kind}`,
    `triggeredAt: ${perception.triggeredAt}`,
    `title: ${perception.title}`,
    `detail: ${perception.detail || "none"}`,
    "",
    "[Payload]",
    JSON.stringify(perception.payload, null, 2),
    "",
    formatPerceptionSnapshot(context),
    "",
    "[Instruction]",
    "请直接输出提醒正文。"
  ].join("\n")
}

export function buildButlerDigestUserPrompt(context: ButlerDigestPromptContext): string {
  const tasks = context.tasks.map((task, index) =>
    [
      `${index + 1}. [${task.status}] ${task.title}`,
      `mode=${task.mode} source=${task.source} thread=${task.threadId}`,
      `updatedAt=${task.updatedAt}`,
      `brief=${task.resultBrief || "none"}`,
      task.resultDetail ? `detail=${task.resultDetail}` : ""
    ]
      .filter(Boolean)
      .join("\n")
  )

  return [
    "[Digest Window]",
    `windowStart: ${context.windowStart}`,
    `windowEnd: ${context.windowEnd}`,
    `taskCount: ${context.tasks.length}`,
    "",
    "[Task Updates]",
    tasks.length > 0 ? tasks.join("\n\n") : "none",
    "",
    "[Instruction]",
    "请输出服务总结正文。"
  ].join("\n")
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
