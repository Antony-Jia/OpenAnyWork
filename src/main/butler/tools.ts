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
      ? `{"taskKey":"news_1","title":"AI新闻汇总","initialPrompt":"收集今天AI大模型新闻并输出表格","threadStrategy":"new_thread","deliverableFormat":"table"}`
      : mode === "ralph"
        ? `{"taskKey":"impl_1","title":"实现任务","initialPrompt":"按需求实现","threadStrategy":"new_thread","acceptanceCriteria":["类型检查通过","核心功能可用"],"maxIterations":5}`
        : mode === "email"
          ? `{"taskKey":"mail_1","title":"邮件处理","initialPrompt":"生成并发送邮件草稿","threadStrategy":"reuse_last_thread","emailIntent":"reply_to_customer","recipientHints":["alice@example.com"],"tone":"professional"}`
          : `{"taskKey":"loop_1","title":"循环任务","initialPrompt":"建立监控循环","threadStrategy":"new_thread","loopConfig":{"enabled":true,"contentTemplate":"处理触发事件","trigger":{"type":"schedule","cron":"*/5 * * * *"},"queue":{"policy":"strict","mergeWindowSec":300}}}`

  return [
    `Create a ${mode} mode task for Butler.`,
    "Use valid JSON only. taskKey must be unique within this turn.",
    "dependsOn references other taskKey values in the same turn.",
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

export function renderTaskPrompt(intent: ButlerDispatchIntent): string {
  const sections: string[] = [intent.initialPrompt]

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
