import { tool } from "langchain"
import { z } from "zod"
import type { ButlerTaskHandoff, LoopConfig, ThreadMode } from "../types"

export type ButlerThreadStrategy = "new_thread" | "reuse_last_thread"
export type ButlerDeliverableFormat = "text" | "data" | "table" | "page"

interface ButlerDispatchIntentBase {
  taskKey: string
  title: string
  initialPrompt: string
  threadStrategy: ButlerThreadStrategy
  dependsOn: string[]
  handoff?: ButlerTaskHandoff
}

export interface DefaultTaskIntent extends ButlerDispatchIntentBase {
  mode: "default"
  deliverableFormat?: ButlerDeliverableFormat
}

export interface RalphTaskIntent extends ButlerDispatchIntentBase {
  mode: "ralph"
  acceptanceCriteria: string[]
  maxIterations?: number
}

export interface EmailTaskIntent extends ButlerDispatchIntentBase {
  mode: "email"
  emailIntent: string
  recipientHints?: string[]
  tone?: string
}

export interface LoopTaskIntent extends ButlerDispatchIntentBase {
  mode: "loop"
  loopConfig: LoopConfig
}

export type ButlerDispatchIntent =
  | DefaultTaskIntent
  | RalphTaskIntent
  | EmailTaskIntent
  | LoopTaskIntent

const commonFieldsSchema = z.object({
  taskKey: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, "taskKey must be alphanumeric/underscore/hyphen"),
  title: z.string().trim().min(1),
  initialPrompt: z.string().trim().min(1),
  threadStrategy: z.enum(["new_thread", "reuse_last_thread"]),
  dependsOn: z.array(z.string().trim().min(1)).optional().default([]),
  handoff: z
    .object({
      method: z.enum(["context", "filesystem", "both"]),
      note: z.string().trim().optional(),
      requiredArtifacts: z.array(z.string().trim().min(1)).optional()
    })
    .optional()
})

const defaultTaskSchema = commonFieldsSchema.extend({
  deliverableFormat: z.enum(["text", "data", "table", "page"]).optional()
})

const ralphTaskSchema = commonFieldsSchema.extend({
  acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
  maxIterations: z.number().int().min(1).max(50).optional()
})

const emailTaskSchema = commonFieldsSchema.extend({
  emailIntent: z.string().trim().min(1),
  recipientHints: z.array(z.string().trim().min(1)).optional(),
  tone: z.string().trim().optional()
})

const loopTriggerScheduleSchema = z.object({
  type: z.literal("schedule"),
  cron: z.string().trim().min(1)
})

const loopTriggerApiSchema = z.object({
  type: z.literal("api"),
  cron: z.string().trim().min(1),
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  headers: z.record(z.string(), z.string()).optional(),
  bodyJson: z.record(z.string(), z.unknown()).nullable().optional(),
  jsonPath: z.string().trim().min(1),
  op: z.enum(["equals", "contains", "truthy"]),
  expected: z.string().optional(),
  timeoutMs: z.number().int().positive().optional()
})

const loopTriggerFileSchema = z.object({
  type: z.literal("file"),
  watchPath: z.string().trim().min(1),
  suffixes: z.array(z.string().trim().min(1)).optional(),
  previewMaxLines: z.number().int().positive(),
  previewMaxBytes: z.number().int().positive()
})

const loopConfigSchema = z.object({
  enabled: z.boolean(),
  contentTemplate: z.string().trim().min(1),
  trigger: z.union([loopTriggerScheduleSchema, loopTriggerApiSchema, loopTriggerFileSchema]),
  queue: z.object({
    policy: z.literal("strict"),
    mergeWindowSec: z.number().int().positive()
  }),
  lastRunAt: z.string().optional(),
  lastError: z.string().nullable().optional(),
  nextRunAt: z.string().nullable().optional()
})

const loopTaskSchema = commonFieldsSchema.extend({
  loopConfig: loopConfigSchema
})

function normalizeCommon(input: z.infer<typeof commonFieldsSchema>): ButlerDispatchIntentBase {
  return {
    taskKey: input.taskKey.trim(),
    title: input.title.trim(),
    initialPrompt: input.initialPrompt.trim(),
    threadStrategy: input.threadStrategy,
    dependsOn: input.dependsOn ?? [],
    handoff: input.handoff
      ? {
          method: input.handoff.method,
          note: input.handoff.note?.trim() || undefined,
          requiredArtifacts: input.handoff.requiredArtifacts?.map((entry) => entry.trim())
        }
      : undefined
  }
}

function buildDescription(mode: Exclude<ThreadMode, "butler">): string {
  const example =
    mode === "default"
      ? `{"taskKey":"news_1","title":"AI新闻汇总","initialPrompt":"[Task Objective]\\n汇总今天 AI 大模型新闻并形成结构化摘要。\\n\\n[Execution Requirements]\\n1) 覆盖主流来源并去重。\\n2) 记录时间、来源与核心结论。\\n3) 禁止编造事实。\\n\\n[Output & Acceptance]\\n- 输出 Markdown 表格，至少包含标题/来源/时间/要点。","threadStrategy":"new_thread","deliverableFormat":"table"}`
      : mode === "ralph"
        ? `{"taskKey":"impl_1","title":"实现任务","initialPrompt":"[Task Objective]\\n实现需求并修复相关缺陷。\\n\\n[Execution Requirements]\\n1) 修改代码并补齐关键测试。\\n2) 记录主要设计取舍。\\n3) 不破坏现有行为。\\n\\n[Output & Acceptance]\\n- 提供变更说明与验证结果。","threadStrategy":"new_thread","acceptanceCriteria":["类型检查通过","核心功能可用"],"maxIterations":5}`
        : mode === "email"
          ? `{"taskKey":"mail_1","title":"邮件处理","initialPrompt":"[Task Objective]\\n生成可直接发送的客户回复邮件。\\n\\n[Execution Requirements]\\n1) 回应用户问题并给出下一步。\\n2) 语气专业且简洁。\\n3) 若信息不足先列出待确认点。\\n\\n[Output & Acceptance]\\n- 产出完整邮件正文和主题建议。","threadStrategy":"reuse_last_thread","emailIntent":"reply_to_customer","recipientHints":["alice@example.com"],"tone":"professional"}`
          : `{"taskKey":"loop_1","title":"循环任务","initialPrompt":"[Task Objective]\\n建立稳定的周期监控任务。\\n\\n[Execution Requirements]\\n1) 每次触发都执行完整处理流程。\\n2) 失败要记录错误并继续下一轮。\\n\\n[Output & Acceptance]\\n- 触发后可产出可审计结果。","threadStrategy":"new_thread","loopConfig":{"enabled":true,"contentTemplate":"检索 AI 新闻，去重后写入 news_send.json，并发送给指定邮箱","trigger":{"type":"schedule","cron":"*/5 * * * *"},"queue":{"policy":"strict","mergeWindowSec":300}}}`

  return [
    `Create a ${mode} mode task for Butler.`,
    "Use valid JSON only. taskKey must be unique within this turn.",
    "dependsOn references other taskKey values in the same turn.",
    "initialPrompt must preserve user constraints and stay executable.",
    "initialPrompt must include objective, execution requirements, and output/acceptance criteria.",
    `Example: ${example}`
  ].join(" ")
}

export function createButlerDispatchTools(params: {
  onIntent: (intent: ButlerDispatchIntent) => void
}): Array<unknown> {
  const { onIntent } = params

  const createDefaultTask = tool(
    async (input: z.infer<typeof defaultTaskSchema>) => {
      const common = normalizeCommon(input)
      onIntent({
        ...common,
        mode: "default",
        deliverableFormat: input.deliverableFormat
      })
      return { ok: true, mode: "default", taskKey: common.taskKey }
    },
    {
      name: "create_default_task",
      description: buildDescription("default"),
      schema: defaultTaskSchema
    }
  )

  const createRalphTask = tool(
    async (input: z.infer<typeof ralphTaskSchema>) => {
      const common = normalizeCommon(input)
      onIntent({
        ...common,
        mode: "ralph",
        acceptanceCriteria: input.acceptanceCriteria.map((entry) => entry.trim()),
        maxIterations: input.maxIterations
      })
      return { ok: true, mode: "ralph", taskKey: common.taskKey }
    },
    {
      name: "create_ralph_task",
      description: buildDescription("ralph"),
      schema: ralphTaskSchema
    }
  )

  const createEmailTask = tool(
    async (input: z.infer<typeof emailTaskSchema>) => {
      const common = normalizeCommon(input)
      onIntent({
        ...common,
        mode: "email",
        emailIntent: input.emailIntent.trim(),
        recipientHints: input.recipientHints?.map((entry) => entry.trim()),
        tone: input.tone?.trim()
      })
      return { ok: true, mode: "email", taskKey: common.taskKey }
    },
    {
      name: "create_email_task",
      description: buildDescription("email"),
      schema: emailTaskSchema
    }
  )

  const createLoopTask = tool(
    async (input: z.infer<typeof loopTaskSchema>) => {
      const common = normalizeCommon(input)
      onIntent({
        ...common,
        mode: "loop",
        loopConfig: input.loopConfig
      })
      return { ok: true, mode: "loop", taskKey: common.taskKey }
    },
    {
      name: "create_loop_task",
      description: buildDescription("loop"),
      schema: loopTaskSchema
    }
  )

  return [createDefaultTask, createRalphTask, createEmailTask, createLoopTask]
}

export interface RenderTaskPromptContext {
  originUserMessage: string
}

function normalizeOriginUserMessage(originUserMessage: string): string {
  const trimmed = originUserMessage.trim()
  return trimmed || "none"
}

function buildOutputAcceptance(intent: ButlerDispatchIntent): string {
  if (intent.mode === "default") {
    const formatLine = intent.deliverableFormat
      ? `- 输出格式: ${intent.deliverableFormat}`
      : "- 输出格式: text（默认）"
    return [formatLine, "- 输出必须可直接交付，且覆盖用户关键约束。"].join("\n")
  }

  if (intent.mode === "ralph") {
    return [
      "- 必须满足全部 Acceptance Criteria。",
      "- 给出验证过程与最终结论。",
      intent.maxIterations
        ? `- 最大迭代轮数: ${intent.maxIterations}`
        : "- 最大迭代轮数: 按系统默认。"
    ].join("\n")
  }

  if (intent.mode === "email") {
    return ["- 产出可直接发送的邮件内容。", "- 明确邮件目标、对象、语气并避免遗漏关键信息。"].join(
      "\n"
    )
  }

  return [
    "- loopConfig 是执行事实来源，触发与队列策略必须严格遵守。",
    "- 每次触发需输出可审计结果或错误摘要。"
  ].join("\n")
}

export function renderTaskPrompt(
  intent: ButlerDispatchIntent,
  context: RenderTaskPromptContext
): string {
  const sections: string[] = [
    `[Original User Request]\n${normalizeOriginUserMessage(context.originUserMessage)}`,
    `[Task Objective]\n${intent.title}`,
    `[Execution Requirements]\n${intent.initialPrompt}`,
    `[Output & Acceptance]\n${buildOutputAcceptance(intent)}`
  ]

  if (intent.mode === "default" && intent.deliverableFormat) {
    sections.push(`[Deliverable Format]\n${intent.deliverableFormat}`)
  }

  if (intent.mode === "ralph") {
    sections.push(`[Acceptance Criteria]\n- ${intent.acceptanceCriteria.join("\n- ")}`)
    if (intent.maxIterations) {
      sections.push(`[Max Iterations]\n${intent.maxIterations}`)
    }
  }

  if (intent.mode === "email") {
    sections.push(`[Email Intent]\n${intent.emailIntent}`)
    if (intent.recipientHints && intent.recipientHints.length > 0) {
      sections.push(`[Recipient Hints]\n- ${intent.recipientHints.join("\n- ")}`)
    }
    if (intent.tone) {
      sections.push(`[Tone]\n${intent.tone}`)
    }
  }

  if (intent.mode === "loop") {
    sections.push(`[Loop Behavior]\nUse provided loopConfig as execution source of truth.`)
  }

  return sections.join("\n\n")
}
