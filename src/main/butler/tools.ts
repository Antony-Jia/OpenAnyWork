import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ButlerTaskHandoff, ExpertConfig, LoopConfig, ThreadMode } from "../types"

export type ButlerThreadStrategy = "new_thread" | "reuse_last_thread"
export type ButlerDeliverableFormat = "text" | "data" | "table" | "page"

interface ButlerDispatchIntentBase {
  taskKey: string
  title: string
  initialPrompt: string
  threadStrategy: ButlerThreadStrategy
  workspacePath?: string
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

export interface ExpertTaskIntent extends ButlerDispatchIntentBase {
  mode: "expert"
  expertConfig: ExpertConfig
}

export type ButlerDispatchIntent =
  | DefaultTaskIntent
  | RalphTaskIntent
  | EmailTaskIntent
  | LoopTaskIntent
  | ExpertTaskIntent

const commonFieldsSchema = z.object({
  taskKey: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, "taskKey must be alphanumeric/underscore/hyphen"),
  title: z.string().trim().min(1),
  initialPrompt: z.string().trim().min(1),
  threadStrategy: z.enum(["new_thread", "reuse_last_thread"]),
  workspacePath: z.string().trim().min(1).optional(),
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

const expertAgentConfigSchema = z.object({
  id: z.string().trim().optional(),
  role: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  agentThreadId: z.string().trim().optional()
})

const expertTaskSchema = commonFieldsSchema.extend({
  expertConfig: z.object({
    experts: z.array(expertAgentConfigSchema).min(1),
    loop: z
      .object({
        enabled: z.boolean(),
        maxCycles: z.number().int().min(1).max(20)
      })
      .optional()
  })
})

function normalizeCommon(input: z.infer<typeof commonFieldsSchema>): ButlerDispatchIntentBase {
  return {
    taskKey: input.taskKey.trim(),
    title: input.title.trim(),
    initialPrompt: input.initialPrompt.trim(),
    threadStrategy: input.threadStrategy,
    workspacePath: input.workspacePath?.trim() || undefined,
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
      ? `{"taskKey":"news_1","title":"AI新闻汇总","initialPrompt":"补充说明：覆盖主流来源并去重；按“标题/来源/时间/要点”输出 Markdown 表格；禁止编造事实。","threadStrategy":"new_thread","workspacePath":"D:\\\\OpenAnyWork\\\\example","deliverableFormat":"table"}`
      : mode === "ralph"
        ? `{"taskKey":"impl_1","title":"实现任务","initialPrompt":"补充说明：先定位失败根因并最小化改动；补齐关键测试并记录设计取舍；如冲突以用户原任务主体为准。","threadStrategy":"new_thread","workspacePath":"project-a","acceptanceCriteria":["类型检查通过","核心功能可用"],"maxIterations":5}`
        : mode === "email"
          ? `{"taskKey":"mail_1","title":"邮件处理","initialPrompt":"补充说明：优先回答用户核心问题并给出下一步；语气专业简洁；信息不足时先列待确认点。","threadStrategy":"reuse_last_thread","workspacePath":"D:\\\\OpenAnyWork\\\\mailbox","emailIntent":"reply_to_customer","recipientHints":["alice@example.com"],"tone":"professional"}`
          : mode === "loop"
            ? `{"taskKey":"loop_1","title":"循环任务","initialPrompt":"补充说明：每次触发都执行完整流程；失败需记录错误并继续下一轮；结果需可审计。","threadStrategy":"new_thread","workspacePath":"loop-jobs","loopConfig":{"enabled":true,"contentTemplate":"检索 AI 新闻，去重后写入 news_send.json，并发送给指定邮箱","trigger":{"type":"schedule","cron":"*/5 * * * *"},"queue":{"policy":"strict","mergeWindowSec":300}}}`
            : `{"taskKey":"expert_1","title":"专家协作写作","initialPrompt":"补充说明：专家链路必须严格串行；每轮交接输出结构化 handoff；最终稿需附审稿修订记录。","threadStrategy":"new_thread","workspacePath":"D:\\\\OpenAnyWork\\\\docs","expertConfig":{"experts":[{"role":"写稿人","prompt":"先产出完整初稿，强调结构与论据。"},{"role":"审稿人","prompt":"聚焦逻辑漏洞、事实风险与改进建议。"},{"role":"校对人","prompt":"修复语法措辞并统一术语风格。"}],"loop":{"enabled":true,"maxCycles":5}}}`

  return [
    `Create a ${mode} mode task for Butler.`,
    "Use valid JSON only. taskKey must be unique within this turn.",
    "If user explicitly specifies a workspace directory, set workspacePath accordingly.",
    "workspacePath supports absolute path or path relative to butler.rootPath.",
    "dependsOn references other taskKey values in the same turn.",
    "Treat the original user request as locked task body; do not rewrite it in initialPrompt.",
    "initialPrompt is execution addendum only: constraints, method, risk controls, or user habit notes.",
    "initialPrompt must not change scope/time/object/format/acceptance from the locked task body.",
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

  const createExpertTask = tool(
    async (input: z.infer<typeof expertTaskSchema>) => {
      const common = normalizeCommon(input)
      onIntent({
        ...common,
        mode: "expert",
        expertConfig: {
          experts: input.expertConfig.experts.map((expert) => ({
            id: expert.id?.trim() || "",
            role: expert.role.trim(),
            prompt: expert.prompt.trim(),
            agentThreadId: expert.agentThreadId?.trim() || ""
          })),
          loop: {
            enabled: input.expertConfig.loop?.enabled === true,
            maxCycles: input.expertConfig.loop?.maxCycles ?? 5
          }
        }
      })
      return { ok: true, mode: "expert", taskKey: common.taskKey }
    },
    {
      name: "create_expert_task",
      description: buildDescription("expert"),
      schema: expertTaskSchema
    }
  )

  return [createDefaultTask, createRalphTask, createEmailTask, createLoopTask, createExpertTask]
}

export interface RenderTaskPromptContext {
  originUserMessage: string
  habitAddendum: string
}

function normalizeOriginUserMessage(originUserMessage: string): string {
  const trimmed = originUserMessage.trim()
  return trimmed || "none"
}

function normalizeHabitAddendum(habitAddendum: string): string {
  const trimmed = habitAddendum.trim()
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

  if (intent.mode === "expert") {
    return [
      "- 专家链路必须严格串行执行（不并行、不分支）。",
      "- 每位专家输出必须包含结构化 summary/handoff。",
      `- 循环配置: enabled=${intent.expertConfig.loop.enabled}, maxCycles=${intent.expertConfig.loop.maxCycles}`
    ].join("\n")
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
    `[Locked Task Body]\n${normalizeOriginUserMessage(context.originUserMessage)}`,
    `[Task Objective]\n${intent.title}`,
    `[Execution Requirements]\n${intent.initialPrompt}`,
    `[User Habit Addendum]\n${normalizeHabitAddendum(context.habitAddendum)}`,
    "[Execution Guardrails]\n- [Locked Task Body] 是用户任务主体原文，必须逐字遵循。\n- [Execution Requirements] 与 [User Habit Addendum] 仅为补充说明。\n- 若补充说明与主体冲突，以 [Locked Task Body] 为准。",
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

  if (intent.mode === "expert") {
    sections.push(
      `[Expert Behavior]\nUse provided expertConfig as source of truth. Execute experts strictly in order with structured handoff.`
    )
    sections.push(
      `[Expert Config]\n${JSON.stringify(
        {
          experts: intent.expertConfig.experts.map((expert) => ({
            role: expert.role,
            prompt: expert.prompt
          })),
          loop: intent.expertConfig.loop
        },
        null,
        2
      )}`
    )
  }

  return sections.join("\n\n")
}
