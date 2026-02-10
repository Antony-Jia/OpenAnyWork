import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import type { ToolRuntime } from "@langchain/core/tools"
import { ChatOpenAI } from "@langchain/openai"
import { tool } from "langchain"
import { z } from "zod"
import { SqlJsSaver } from "../checkpointer/sqljs-saver"
import { logEntry, logExit } from "../logging"
import { getProviderState } from "../provider-config"
import { createSkill, getSkillsRoot, listAppSkills } from "../skills"
import { getThreadCheckpointPath } from "../storage"
import type { ProviderConfig, ProviderState, SimpleProviderId, ToolDefinition } from "../types"

type ProcessEventType = "user" | "assistant" | "tool_call" | "tool_result"

interface ProcessEvent {
  type: ProcessEventType
  content: string
  messageId?: string
  toolCallId?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
}

interface ProcessExtraction {
  events: ProcessEvent[]
  userCount: number
  assistantCount: number
  toolCallCount: number
  toolResultCount: number
}

interface SkillDraft {
  name?: string
  description: string
  body: string
}

const createSkillFromConversationSchema = z.object({
  skillName: z.string().trim().min(1).optional(),
  threadId: z.string().trim().min(1).optional(),
  focus: z.string().trim().min(1).optional()
})

const modelOutputSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().min(1),
  body: z.string().trim().min(1)
})

const EXTRACTION_SYSTEM_PROMPT = [
  "你是 skill 提炼器。你会把会话执行过程提炼成可复用技能。",
  "必须只输出 JSON，不允许输出解释文字。",
  'JSON 结构必须为：{"name":"...","description":"...","body":"..."}',
  "description 必须写清“做什么 + 何时使用（触发条件）”。",
  "body 必须使用可执行的指令语气，聚焦一个稳定流程，避免泛化空话。",
  "body 必须显式提醒读取 references/execution-log.md，避免把长日志写进 SKILL.md。",
  "如果识别到可复用步骤，body 必须给出明确 step-by-step 工作流。",
  "name 必须是小写字母/数字/连字符，长度不超过 64。"
].join("\n")

export const createSkillFromConversationDefinition: ToolDefinition = {
  name: "create_skill_from_conversation",
  label: "Create Skill From Conversation",
  description: "Extract a reusable skill from the current thread execution process.",
  requiresKey: false
}

function normalizeSkillName(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!normalized) return "conversation-skill"
  return normalized.slice(0, 64).replace(/-+$/g, "") || "conversation-skill"
}

function resolveSkillNameWithSuffix(preferred: string): string {
  const base = normalizeSkillName(preferred)
  const existing = new Set(listAppSkills().map((item) => item.name))
  if (!existing.has(base)) return base

  for (let index = 2; index < 10000; index += 1) {
    const suffix = `-${index}`
    const headMax = Math.max(1, 64 - suffix.length)
    const head = base.slice(0, headMax).replace(/-+$/g, "") || "skill"
    const candidate = `${head}${suffix}`
    if (!existing.has(candidate)) return candidate
  }
  throw new Error("Unable to allocate a unique skill name.")
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item
        if (!item || typeof item !== "object") return ""
        const block = item as { type?: string; text?: string; content?: unknown }
        if (block.type === "text" && typeof block.text === "string") return block.text
        if (typeof block.text === "string") return block.text
        if (typeof block.content === "string") return block.content
        if (block.content !== undefined) {
          try {
            return JSON.stringify(block.content)
          } catch {
            return String(block.content)
          }
        }
        return ""
      })
      .join("")
  }
  if (content && typeof content === "object") {
    const value = content as { text?: unknown; content?: unknown }
    if (typeof value.text === "string") return value.text
    if (typeof value.content === "string") return value.content
    try {
      return JSON.stringify(content)
    } catch {
      return String(content)
    }
  }
  return ""
}

function parseJsonObject(text: string): unknown {
  const raw = text.trim()
  if (!raw) {
    throw new Error("Model returned empty response.")
  }
  try {
    return JSON.parse(raw)
  } catch {
    const first = raw.indexOf("{")
    const last = raw.lastIndexOf("}")
    if (first < 0 || last < first) {
      throw new Error("Model output contains no JSON object.")
    }
    return JSON.parse(raw.slice(first, last + 1))
  }
}

function getMessageRole(msg: Record<string, unknown>): string {
  if (typeof (msg as { _getType?: () => string })._getType === "function") {
    return (msg as { _getType: () => string })._getType()
  }
  if (typeof msg.type === "string") return msg.type
  const classId = Array.isArray(msg.id) ? msg.id : []
  const className = classId[classId.length - 1] || ""
  if (className.includes("Human")) return "human"
  if (className.includes("AI")) return "ai"
  if (className.includes("Tool")) return "tool"
  if (className.includes("System")) return "system"
  return ""
}

function getMessageId(msg: Record<string, unknown>): string | undefined {
  if (typeof msg.id === "string") return msg.id
  const kwargs = msg.kwargs as { id?: string } | undefined
  return kwargs?.id
}

function getMessageContent(msg: Record<string, unknown>): string {
  if ("content" in msg) {
    return extractTextContent(msg.content)
  }
  const kwargs = msg.kwargs as { content?: unknown } | undefined
  return extractTextContent(kwargs?.content)
}

function getToolCalls(
  msg: Record<string, unknown>
): Array<{ id?: string; name?: string; args?: Record<string, unknown> }> {
  if (Array.isArray((msg as { tool_calls?: unknown }).tool_calls)) {
    return (
      msg as {
        tool_calls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>
      }
    ).tool_calls
  }
  const kwargs = msg.kwargs as
    | {
        tool_calls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>
      }
    | undefined
  return kwargs?.tool_calls || []
}

function getToolMessageMeta(msg: Record<string, unknown>): {
  toolCallId?: string
  toolName?: string
} {
  const toolCallId = (msg as { tool_call_id?: string }).tool_call_id
  const toolName = (msg as { name?: string }).name
  const kwargs = msg.kwargs as { tool_call_id?: string; name?: string } | undefined
  return {
    toolCallId: toolCallId || kwargs?.tool_call_id,
    toolName: toolName || kwargs?.name
  }
}

function uniqueMessageKey(msg: Record<string, unknown>, role: string, content: string): string {
  const id = getMessageId(msg)
  if (id) return `id:${id}`
  const meta = getToolMessageMeta(msg)
  return `anon:${role}:${meta.toolCallId || ""}:${meta.toolName || ""}:${content}`
}

function extractMessagesFromCheckpointTuple(tuple: unknown): unknown[] {
  if (!tuple || typeof tuple !== "object") return []
  const entry = tuple as { checkpoint?: { channel_values?: { messages?: unknown[] } } }
  const messages = entry.checkpoint?.channel_values?.messages
  return Array.isArray(messages) ? messages : []
}

async function loadThreadCheckpointHistory(threadId: string): Promise<unknown[]> {
  const checkpointPath = getThreadCheckpointPath(threadId)
  if (!existsSync(checkpointPath)) {
    return []
  }

  const saver = new SqlJsSaver(checkpointPath)
  await saver.initialize()
  try {
    const checkpoints: unknown[] = []
    for await (const tuple of saver.list(
      { configurable: { thread_id: threadId } },
      { limit: 2000 }
    )) {
      checkpoints.push(tuple)
    }
    checkpoints.reverse()
    return checkpoints
  } finally {
    await saver.close()
  }
}

function extractProcessEvents(checkpoints: unknown[]): ProcessExtraction {
  const events: ProcessEvent[] = []
  const seenMessages = new Set<string>()
  const seenToolCalls = new Set<string>()
  let userCount = 0
  let assistantCount = 0
  let toolCallCount = 0
  let toolResultCount = 0

  for (const tuple of checkpoints) {
    const messages = extractMessagesFromCheckpointTuple(tuple)
    for (const rawMessage of messages) {
      if (!rawMessage || typeof rawMessage !== "object") continue
      const message = rawMessage as Record<string, unknown>
      const role = getMessageRole(message)
      if (!role || role === "system") continue

      const content = getMessageContent(message).trim()
      const messageKey = uniqueMessageKey(message, role, content)
      if (seenMessages.has(messageKey)) {
        continue
      }
      seenMessages.add(messageKey)

      if (role === "human") {
        if (content) {
          events.push({ type: "user", content, messageId: getMessageId(message) })
          userCount += 1
        }
        continue
      }

      if (role === "ai") {
        if (content) {
          events.push({ type: "assistant", content, messageId: getMessageId(message) })
          assistantCount += 1
        }
        const toolCalls = getToolCalls(message)
        for (const toolCall of toolCalls) {
          const argsText = toolCall.args ? JSON.stringify(toolCall.args) : "{}"
          const key = toolCall.id || `${toolCall.name || "tool"}:${argsText}`
          if (seenToolCalls.has(key)) continue
          seenToolCalls.add(key)
          events.push({
            type: "tool_call",
            content: `${toolCall.name || "tool"}(${argsText})`,
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            toolArgs: toolCall.args
          })
          toolCallCount += 1
        }
        continue
      }

      if (role === "tool") {
        const meta = getToolMessageMeta(message)
        events.push({
          type: "tool_result",
          content,
          messageId: getMessageId(message),
          toolCallId: meta.toolCallId,
          toolName: meta.toolName
        })
        toolResultCount += 1
      }
    }
  }

  return {
    events,
    userCount,
    assistantCount,
    toolCallCount,
    toolResultCount
  }
}

function formatEventBlock(event: ProcessEvent, index: number): string {
  const header =
    event.type === "user"
      ? `### ${index + 1}. USER`
      : event.type === "assistant"
        ? `### ${index + 1}. ASSISTANT`
        : event.type === "tool_call"
          ? `### ${index + 1}. TOOL_CALL ${event.toolName || "unknown"}`
          : `### ${index + 1}. TOOL_RESULT ${event.toolName || "unknown"}`

  const metadata = [
    event.messageId ? `- messageId: ${event.messageId}` : null,
    event.toolCallId ? `- toolCallId: ${event.toolCallId}` : null
  ]
    .filter(Boolean)
    .join("\n")

  const body =
    event.type === "tool_call" && event.toolArgs
      ? `\`\`\`json\n${JSON.stringify(event.toolArgs, null, 2)}\n\`\`\``
      : `\`\`\`text\n${event.content || "(empty)"}\n\`\`\``

  return [header, metadata, body].filter(Boolean).join("\n")
}

function renderExecutionLog(params: {
  threadId: string
  focus?: string
  checkpointsCount: number
  extraction: ProcessExtraction
}): string {
  const { threadId, focus, checkpointsCount, extraction } = params
  const summary = [
    "# Execution Log",
    `- generatedAt: ${new Date().toISOString()}`,
    `- threadId: ${threadId}`,
    `- focus: ${focus || "none"}`,
    `- checkpointsAnalyzed: ${checkpointsCount}`,
    `- events: ${extraction.events.length}`,
    `- userMessages: ${extraction.userCount}`,
    `- assistantMessages: ${extraction.assistantCount}`,
    `- toolCalls: ${extraction.toolCallCount}`,
    `- toolResults: ${extraction.toolResultCount}`,
    "",
    "## Timeline"
  ]

  if (extraction.events.length === 0) {
    summary.push("_No process events found in checkpoint history._")
  } else {
    for (let index = 0; index < extraction.events.length; index += 1) {
      summary.push(formatEventBlock(extraction.events[index], index))
      summary.push("")
    }
  }
  return summary.join("\n")
}

function compactForModel(input: string, max = 500): string {
  const text = input.trim().replace(/\s+/g, " ")
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function buildModelInput(params: {
  threadId: string
  focus?: string
  extraction: ProcessExtraction
}): string {
  const { threadId, focus, extraction } = params
  const recentEvents = extraction.events.slice(-120)
  const timeline = recentEvents
    .map((event, index) => {
      if (event.type === "tool_call") {
        return `${index + 1}. [tool_call] ${event.toolName || "tool"} args=${compactForModel(
          JSON.stringify(event.toolArgs ?? {}),
          360
        )}`
      }
      if (event.type === "tool_result") {
        return `${index + 1}. [tool_result] ${event.toolName || "tool"} result=${compactForModel(
          event.content,
          420
        )}`
      }
      return `${index + 1}. [${event.type}] ${compactForModel(event.content, 420)}`
    })
    .join("\n")

  return [
    "[Thread]",
    threadId,
    "",
    "[Focus]",
    focus || "none",
    "",
    "[Stats]",
    `events=${extraction.events.length}; users=${extraction.userCount}; assistants=${extraction.assistantCount}; toolCalls=${extraction.toolCallCount}; toolResults=${extraction.toolResultCount}`,
    "",
    "[Recent Timeline]",
    timeline || "none",
    "",
    "[Constraints]",
    "Generate a reusable SKILL.md body. Mention references/execution-log.md explicitly."
  ].join("\n")
}

function resolveRuntimeThreadId(runtime?: ToolRuntime): string | undefined {
  const top = runtime as unknown as { configurable?: { thread_id?: unknown } }
  if (typeof top?.configurable?.thread_id === "string" && top.configurable.thread_id.trim()) {
    return top.configurable.thread_id.trim()
  }
  const nested = runtime as unknown as { config?: { configurable?: { thread_id?: unknown } } }
  if (
    typeof nested?.config?.configurable?.thread_id === "string" &&
    nested.config.configurable.thread_id.trim()
  ) {
    return nested.config.configurable.thread_id.trim()
  }
  return undefined
}

function resolveProviderConfig(state: ProviderState, providerId: SimpleProviderId): ProviderConfig {
  const config = state.configs[providerId]
  if (!config) {
    throw new Error(`Provider "${providerId}" not configured. Please configure it in Settings.`)
  }
  return config
}

function getModelInstance(): ChatOpenAI {
  const state = getProviderState()
  if (!state) {
    throw new Error(
      "Provider not configured. Please configure Ollama, OpenAI-compatible, or Multimodal provider in Settings."
    )
  }
  const config = resolveProviderConfig(state, state.active)
  if (!config.model) {
    throw new Error("Active provider has no model configured.")
  }

  if (config.type === "ollama") {
    const baseURL = config.url.endsWith("/v1") ? config.url : `${config.url}/v1`
    return new ChatOpenAI({
      model: config.model,
      configuration: { baseURL },
      apiKey: "ollama"
    })
  }

  return new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    configuration: { baseURL: config.url }
  })
}

async function extractSkillDraftByModel(params: {
  threadId: string
  focus?: string
  extraction: ProcessExtraction
}): Promise<SkillDraft> {
  const model = getModelInstance()
  const response = await model.invoke([
    new SystemMessage(EXTRACTION_SYSTEM_PROMPT),
    new HumanMessage(buildModelInput(params))
  ])
  const raw = extractTextContent(response.content)
  const parsed = parseJsonObject(raw)
  const output = modelOutputSchema.parse(parsed)
  return {
    name: output.name,
    description: output.description,
    body: output.body
  }
}

function ensureExecutionReference(body: string): string {
  const marker = "references/execution-log.md"
  if (body.includes(marker)) {
    return body.trim()
  }
  return [
    body.trim(),
    "",
    "## References",
    "- Read `references/execution-log.md` for full execution details."
  ].join("\n")
}

function buildFallbackDescription(focus?: string): string {
  if (focus?.trim()) {
    return `Extract and execute the "${focus.trim()}" workflow from prior conversations. Use this skill when a similar objective appears.`
  }
  return "Extract and execute a reusable workflow from prior conversation execution. Use this skill when similar goals and tool sequences appear."
}

function buildFallbackBody(params: { name: string; focus?: string; modelError?: string }): string {
  const focusLine = params.focus?.trim()
    ? `- Prioritize the workflow around: ${params.focus.trim()}.`
    : "- Prioritize the core objective from the latest conversation."
  const errorLine = params.modelError
    ? `- Model extraction failed: ${params.modelError}`
    : "- Model extraction fallback path was used."

  return [
    `# ${params.name}`,
    "",
    "Execute this workflow consistently when the user asks for the same outcome.",
    "",
    "## Workflow",
    "1. Read `references/execution-log.md` completely to reconstruct the exact sequence.",
    "2. Identify the minimal reusable path (inputs, tools, expected outputs).",
    "3. Execute steps in order; keep tool calls and output formats consistent.",
    "4. Validate final output against the user's original objective.",
    "",
    "## Notes",
    focusLine,
    errorLine,
    "- Keep this skill focused on one stable process."
  ].join("\n")
}

function buildSkillMarkdown(params: { name: string; description: string; body: string }): string {
  const description = params.description.trim().replace(/\r?\n+/g, " ")
  const safeDescription = description || "Reusable skill extracted from conversation process."
  return [
    "---",
    `name: ${params.name}`,
    `description: ${JSON.stringify(safeDescription)}`,
    "---",
    "",
    ensureExecutionReference(params.body),
    ""
  ].join("\n")
}

export const createSkillFromConversationTool = tool(
  async (
    { skillName, threadId, focus }: z.infer<typeof createSkillFromConversationSchema>,
    runtime?: ToolRuntime
  ) => {
    const start = Date.now()
    const runtimeThreadId = resolveRuntimeThreadId(runtime)
    const resolvedThreadId = threadId?.trim() || runtimeThreadId
    logEntry("Tool", "create_skill_from_conversation", {
      requestedThreadId: threadId || null,
      runtimeThreadId: runtimeThreadId || null,
      hasFocus: !!focus
    })

    if (!resolvedThreadId) {
      const message =
        "Thread ID is required. Provide threadId explicitly or invoke the tool from a thread runtime."
      logExit(
        "Tool",
        "create_skill_from_conversation",
        { ok: false, error: "missing_thread_id" },
        Date.now() - start
      )
      throw new Error(message)
    }

    const checkpoints = await loadThreadCheckpointHistory(resolvedThreadId)
    const extraction = extractProcessEvents(checkpoints)
    const executionLogContent = renderExecutionLog({
      threadId: resolvedThreadId,
      focus,
      checkpointsCount: checkpoints.length,
      extraction
    })

    let draft: SkillDraft | null = null
    let usedFallback = false
    let modelError: string | undefined
    try {
      draft = await extractSkillDraftByModel({
        threadId: resolvedThreadId,
        focus,
        extraction
      })
    } catch (error) {
      usedFallback = true
      modelError = error instanceof Error ? error.message : String(error)
    }

    const preferredName =
      skillName?.trim() ||
      draft?.name?.trim() ||
      focus?.trim() ||
      extraction.events.find((event) => event.type === "user")?.content ||
      "conversation-skill"
    const finalName = resolveSkillNameWithSuffix(preferredName)
    const description = draft?.description?.trim() || buildFallbackDescription(focus)
    const body = draft?.body?.trim() || buildFallbackBody({ name: finalName, focus, modelError })
    const skillMd = buildSkillMarkdown({
      name: finalName,
      description,
      body
    })

    const created = createSkill({
      name: finalName,
      description,
      content: skillMd
    })

    const skillsRoot = getSkillsRoot()
    const skillDir = resolve(skillsRoot, finalName)
    const executionLogPath = join(skillDir, "references", "execution-log.md")
    mkdirSync(resolve(skillDir, "references"), { recursive: true })
    writeFileSync(executionLogPath, executionLogContent)

    const result = {
      ok: true,
      threadId: resolvedThreadId,
      skill: {
        name: created.name,
        path: created.path,
        sourceType: "managed"
      },
      files: {
        skillMdPath: created.path,
        executionLogPath: resolve(executionLogPath)
      },
      stats: {
        checkpoints: checkpoints.length,
        events: extraction.events.length,
        userMessages: extraction.userCount,
        assistantMessages: extraction.assistantCount,
        toolCalls: extraction.toolCallCount,
        toolResults: extraction.toolResultCount
      },
      usedFallback,
      modelError: modelError || null
    }

    logExit(
      "Tool",
      "create_skill_from_conversation",
      { ok: true, skillName: finalName },
      Date.now() - start
    )
    return result
  },
  {
    name: createSkillFromConversationDefinition.name,
    description: createSkillFromConversationDefinition.description,
    schema: createSkillFromConversationSchema
  }
)
