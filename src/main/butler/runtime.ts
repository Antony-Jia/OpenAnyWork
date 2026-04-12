import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages"
import { createDeepAgent } from "deepagents"
import { createMiddleware } from "langchain"
import { LocalSandbox } from "../agent/local-sandbox"
import { getProviderState } from "../provider-config"
import { getCheckpointer } from "../agent/runtime"
import { getSettings } from "../settings"
import { getOpenworkDir } from "../storage"
import type { ProviderConfig, ProviderState, SimpleProviderId } from "../types"
import { createChatModelFromProviderConfig } from "../model-factory"
import { stripReasoningBlocks } from "../../shared/reasoning"
import {
  buildButlerDirectReplySystemPrompt,
  buildButlerDirectReplyUserPrompt,
  buildButlerDigestSystemPrompt,
  buildButlerDigestUserPrompt,
  buildButlerTaskCommentSystemPrompt,
  buildButlerTaskCommentUserPrompt,
  buildButlerSystemPrompt,
  buildButlerPerceptionSystemPrompt,
  buildButlerPerceptionUserPrompt,
  getClarificationPrefix,
  parseButlerAssistantText,
  type ButlerPromptContext
} from "./prompt"
import { composeButlerUserPrompt } from "./prompt/composer"
import { createButlerDispatchTools, type ButlerDispatchIntent } from "./tools"
import type {
  ButlerDigestTaskCard,
  ButlerPerceptionInput,
  TaskCompletionNotice,
  TaskLifecycleNotice
} from "../types"
import { getEnabledToolNames, resolveToolInstancesByName } from "../tools/service"

export interface ButlerOrchestratorTurnInput {
  threadId: string
  promptContext: ButlerPromptContext
}

export interface ButlerOrchestratorTurnResult {
  assistantText: string
  dispatchIntents: ButlerDispatchIntent[]
  clarification: boolean
}

export interface ButlerDirectReplyTurnInput {
  promptContext: ButlerPromptContext
}

export interface ButlerDirectReplyTurnResult {
  assistantText: string
  clarification: boolean
}

export interface ButlerPerceptionTurnInput {
  threadId: string
  perception: ButlerPerceptionInput
  promptContext: Pick<
    ButlerPromptContext,
    "personaProfile" | "workingMemoryText" | "memoryRecallText"
  >
}

export interface ButlerPerceptionTurnResult {
  reminderText: string
}

export interface ButlerDigestTurnInput {
  threadId: string
  digest: {
    windowStart: string
    windowEnd: string
    tasks: ButlerDigestTaskCard[]
  }
  promptContext: Pick<
    ButlerPromptContext,
    "personaProfile" | "workingMemoryText" | "memoryRecallText"
  >
}

export interface ButlerDigestTurnResult {
  summaryText: string
}

export interface ButlerTaskCommentTurnInput {
  threadId: string
  notice: TaskCompletionNotice | TaskLifecycleNotice
  promptContext: Pick<
    ButlerPromptContext,
    "personaProfile" | "workingMemoryText" | "memoryRecallText"
  >
}

export interface ButlerTaskCommentTurnResult {
  commentText: string
}

const DAILY_PROFILE_MARKER = "[Daily Profile]"
const PROFILE_DELTA_MARKER = "[Profile Delta]"
const BLOCKED_BUTLER_TOOL_NAMES = new Set([
  "execute",
  "ls",
  "read_file",
  "write_file",
  "edit_file",
  "glob",
  "grep",
  "download_files",
  "upload_files",
  "task",
  "write_todos"
])
const DIRECT_QUERY_TOOL_ALLOWLIST = new Set([
  "query_calendar_events",
  "query_countdown_timers",
  "query_rss_items",
  "query_mailbox"
])

function createButlerSafetyMiddleware() {
  return createMiddleware({
    name: "butlerSafetyMiddleware",
    wrapToolCall: async (request, handler) => {
      const toolName = String(request.tool?.name || "unknown")
      if (!BLOCKED_BUTLER_TOOL_NAMES.has(toolName)) {
        return handler(request)
      }

      const toolCallId = request.toolCall?.id || "unknown"
      return new ToolMessage({
        content: `TOOL_ERROR: "${toolName}" is blocked in Butler mode. Butler cannot operate system commands or filesystem tools directly.`,
        tool_call_id: toolCallId,
        name: toolName
      })
    }
  })
}

function getDirectButlerToolInstances(): unknown[] {
  const enabledNames = getEnabledToolNames("butler")
  const allowedNames = enabledNames.filter((name) => DIRECT_QUERY_TOOL_ALLOWLIST.has(name))
  return resolveToolInstancesByName(allowedNames, "butler") ?? []
}

function extractAssistantChunkText(data: unknown): string {
  const tuple = data as [unknown, unknown]
  const chunk = tuple?.[0] as { id?: unknown; kwargs?: { content?: unknown } } | undefined
  if (!chunk || typeof chunk !== "object") return ""
  const classId = Array.isArray(chunk.id) ? chunk.id : []
  const className = String(classId[classId.length - 1] || "")
  if (!className.includes("AI")) return ""
  return extractTextContent(chunk.kwargs?.content)
}

function getMessageRole(message: Record<string, unknown>): string {
  if (typeof message._getType === "function") {
    try {
      return String((message._getType as () => string)())
    } catch {
      return ""
    }
  }
  if (typeof message.type === "string") return message.type
  const classId = Array.isArray(message.id) ? message.id : []
  const className = String(classId[classId.length - 1] || "")
  if (className.includes("AI")) return "ai"
  if (className.includes("Tool")) return "tool"
  if (className.includes("Human")) return "human"
  return ""
}

function extractMessageContent(message: Record<string, unknown>): string {
  if ("content" in message) {
    return extractTextContent(message.content)
  }
  const kwargs = message.kwargs as { content?: unknown } | undefined
  return extractTextContent(kwargs?.content)
}

function extractAssistantTextFromValues(data: unknown): string {
  const state = data as { messages?: unknown[] } | undefined
  if (!state || !Array.isArray(state.messages)) return ""
  let latest = ""
  for (const rawMessage of state.messages) {
    if (!rawMessage || typeof rawMessage !== "object") continue
    const message = rawMessage as Record<string, unknown>
    if (getMessageRole(message) !== "ai") continue
    const content = extractMessageContent(message).trim()
    if (content) latest = content
  }
  return latest
}

function hasToolCallsInValues(data: unknown): boolean {
  const state = data as { messages?: unknown[] } | undefined
  if (!state || !Array.isArray(state.messages)) return false
  for (const rawMessage of state.messages) {
    if (!rawMessage || typeof rawMessage !== "object") continue
    const message = rawMessage as Record<string, unknown>
    const directCalls = message.tool_calls
    if (Array.isArray(directCalls) && directCalls.length > 0) return true
    const kwargs = message.kwargs as { tool_calls?: unknown[] } | undefined
    if (Array.isArray(kwargs?.tool_calls) && kwargs.tool_calls.length > 0) return true
  }
  return false
}

function requireProviderState(): ProviderState {
  const state = getProviderState()
  if (!state) {
    throw new Error(
      "Provider not configured. Please configure Ollama, OpenAI-compatible, or Multimodal provider in Settings."
    )
  }
  return state
}

function resolveProviderConfig(state: ProviderState, providerId: SimpleProviderId): ProviderConfig {
  const config = state.configs[providerId]
  if (!config) {
    throw new Error(`Provider "${providerId}" not configured. Please configure it in Settings.`)
  }
  return config
}

function getModelInstance() {
  const state = requireProviderState()
  const config = resolveProviderConfig(state, state.active)
  if (!config.model) {
    throw new Error("Active provider has no model configured.")
  }
  return createChatModelFromProviderConfig(config)
}

async function createButlerRuntime(params: {
  threadId: string
  onIntent: (intent: ButlerDispatchIntent) => void
  personaProfile?: string
}) {
  const model = getModelInstance()
  const checkpointer = await getCheckpointer(params.threadId)
  const backend = new LocalSandbox({
    rootDir: getOpenworkDir(),
    virtualMode: false,
    timeout: 60_000,
    maxOutputBytes: 50_000
  })

  const dispatchTools = createButlerDispatchTools({ onIntent: params.onIntent })
  const capabilityTools = getDirectButlerToolInstances()
  const systemPrompts = getSettings().systemPrompts
  const tools = [...dispatchTools]
  for (const toolInstance of capabilityTools) {
    if (!tools.includes(toolInstance)) {
      tools.push(toolInstance)
    }
  }

  return createDeepAgent({
    model,
    checkpointer,
    backend,
    systemPrompt: buildButlerSystemPrompt(systemPrompts.butlerPrefix, params.personaProfile),
    tools,
    middleware: [createButlerSafetyMiddleware()],
    subagents: [],
    skills: []
  } as Parameters<typeof createDeepAgent>[0])
}

export async function runButlerOrchestratorTurn(
  input: ButlerOrchestratorTurnInput
): Promise<ButlerOrchestratorTurnResult> {
  const intents: ButlerDispatchIntent[] = []
  const agent = await createButlerRuntime({
    threadId: input.threadId,
    onIntent: (intent) => {
      intents.push(intent)
    },
    personaProfile: input.promptContext.personaProfile
  })
  let userPrompt = composeButlerUserPrompt(
    {
      ...input.promptContext,
      dispatchPolicy: input.promptContext.dispatchPolicy ?? "standard",
      planningFocus: input.promptContext.planningFocus ?? "normal"
    },
    {
      clarificationPrefix: getClarificationPrefix()
    }
  )
  // Regression guard: keep daily profile context visible in prompt even after refactors.
  if (!userPrompt.includes(DAILY_PROFILE_MARKER)) {
    console.warn("[Butler] Missing [Daily Profile] in user prompt, injecting fallback section.")
    userPrompt = [
      userPrompt,
      "",
      DAILY_PROFILE_MARKER,
      input.promptContext.profileText?.trim() || "none"
    ].join("\n")
  }
  if (!userPrompt.includes(PROFILE_DELTA_MARKER)) {
    console.warn("[Butler] Missing [Profile Delta] in user prompt, injecting fallback section.")
    userPrompt = [
      userPrompt,
      "",
      PROFILE_DELTA_MARKER,
      input.promptContext.comparisonText?.trim() || "none"
    ].join("\n")
  }

  const stream = await agent.stream(
    { messages: [new HumanMessage(userPrompt)] },
    {
      configurable: { thread_id: input.threadId },
      streamMode: ["messages", "values"],
      recursionLimit: 250
    }
  )

  let lastAssistant = ""
  let lastValuesAssistant = ""
  let sawToolCalls = false
  for await (const chunk of stream) {
    const [mode, data] = chunk as [string, unknown]
    if (mode === "messages") {
      const chunkText = extractAssistantChunkText(data).trim()
      if (chunkText) {
        if (chunkText.startsWith(lastAssistant)) {
          lastAssistant = chunkText
        } else {
          lastAssistant += chunkText
        }
      }
      continue
    }
    if (mode === "values") {
      const valuesText = extractAssistantTextFromValues(data).trim()
      if (valuesText) {
        lastValuesAssistant = valuesText
      }
      if (!sawToolCalls && hasToolCallsInValues(data)) {
        sawToolCalls = true
      }
    }
  }

  const rawAssistantText = stripReasoningBlocks(lastAssistant.trim() || lastValuesAssistant.trim())
  const parsed = parseButlerAssistantText(rawAssistantText)
  const assistantText =
    parsed.assistantText || (intents.length > 0 ? "已完成任务编排并开始执行。" : "")
  if (!assistantText) {
    console.warn("[Butler] Empty assistant text after orchestration.", {
      intents: intents.length,
      sawToolCalls,
      hasMessagesStreamText: !!lastAssistant.trim(),
      hasValuesStreamText: !!lastValuesAssistant.trim()
    })
  }

  return {
    assistantText,
    dispatchIntents: intents,
    clarification: parsed.clarification
  }
}

export async function runButlerDirectReplyTurn(
  input: ButlerDirectReplyTurnInput
): Promise<ButlerDirectReplyTurnResult> {
  const model = getModelInstance()
  const systemPrompt = buildButlerDirectReplySystemPrompt(getSettings().systemPrompts.butlerPrefix)
  const userPrompt = buildButlerDirectReplyUserPrompt(input.promptContext)
  const result = await model.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)])
  const text = stripReasoningBlocks(extractTextContent(result.content))
  const parsed = parseButlerAssistantText(text)
  return {
    assistantText: parsed.assistantText,
    clarification: parsed.clarification
  }
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim()
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (item): item is { type?: string; text?: string } =>
          !!item && typeof item === "object" && (item as { type?: string }).type === "text"
      )
      .map((item) => item.text?.trim() || "")
      .filter(Boolean)
      .join("")
      .trim()
  }
  return ""
}

export async function runButlerPerceptionTurn(
  input: ButlerPerceptionTurnInput
): Promise<ButlerPerceptionTurnResult> {
  const model = getModelInstance()
  const systemPrompt = buildButlerPerceptionSystemPrompt(getSettings().systemPrompts.butlerPrefix)
  const userPrompt = buildButlerPerceptionUserPrompt({
    perception: input.perception,
    personaProfile: input.promptContext.personaProfile,
    workingMemoryText: input.promptContext.workingMemoryText,
    memoryRecallText: input.promptContext.memoryRecallText
  })

  const result = await model.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)])
  const reminderText = stripReasoningBlocks(extractTextContent(result.content))
  return {
    reminderText: reminderText || "检测到新的监听事件，请及时处理。"
  }
}

export async function runButlerDigestTurn(
  input: ButlerDigestTurnInput
): Promise<ButlerDigestTurnResult> {
  const model = getModelInstance()
  const systemPrompt = buildButlerDigestSystemPrompt(getSettings().systemPrompts.butlerPrefix)
  const userPrompt = buildButlerDigestUserPrompt({
    windowStart: input.digest.windowStart,
    windowEnd: input.digest.windowEnd,
    tasks: input.digest.tasks,
    personaProfile: input.promptContext.personaProfile,
    workingMemoryText: input.promptContext.workingMemoryText,
    memoryRecallText: input.promptContext.memoryRecallText
  })

  const result = await model.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)])
  const summaryText = stripReasoningBlocks(extractTextContent(result.content))
  return {
    summaryText: summaryText || ""
  }
}

export async function runButlerTaskCommentTurn(
  input: ButlerTaskCommentTurnInput
): Promise<ButlerTaskCommentTurnResult> {
  const model = getModelInstance()
  const systemPrompt = buildButlerTaskCommentSystemPrompt(getSettings().systemPrompts.butlerPrefix)
  const userPrompt = buildButlerTaskCommentUserPrompt({
    notice: input.notice,
    personaProfile: input.promptContext.personaProfile,
    workingMemoryText: input.promptContext.workingMemoryText,
    memoryRecallText: input.promptContext.memoryRecallText
  })
  const result = await model.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)])
  const commentText = stripReasoningBlocks(extractTextContent(result.content))
  return {
    commentText: commentText || ""
  }
}
