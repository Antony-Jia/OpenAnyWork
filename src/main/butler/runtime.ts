import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { createDeepAgent } from "deepagents"
import { createMiddleware } from "langchain"
import { LocalSandbox } from "../agent/local-sandbox"
import { getProviderState } from "../provider-config"
import { getCheckpointer } from "../agent/runtime"
import { getOpenworkDir } from "../storage"
import type { ProviderConfig, ProviderState, SimpleProviderId } from "../types"
import {
  buildButlerDigestSystemPrompt,
  buildButlerDigestUserPrompt,
  buildButlerSystemPrompt,
  buildButlerPerceptionSystemPrompt,
  buildButlerPerceptionUserPrompt,
  getClarificationPrefix,
  parseButlerAssistantText,
  type ButlerPromptContext
} from "./prompt"
import { composeButlerUserPrompt } from "./prompt/composer"
import { createButlerDispatchTools, type ButlerDispatchIntent } from "./tools"
import type { ButlerDigestTaskCard, ButlerPerceptionInput } from "../types"
import { getEnabledToolInstances } from "../tools/service"

export interface ButlerOrchestratorTurnInput {
  threadId: string
  promptContext: ButlerPromptContext
}

export interface ButlerOrchestratorTurnResult {
  assistantText: string
  dispatchIntents: ButlerDispatchIntent[]
  clarification: boolean
}

export interface ButlerPerceptionTurnInput {
  threadId: string
  perception: ButlerPerceptionInput
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
}

export interface ButlerDigestTurnResult {
  summaryText: string
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

function getModelInstance(): ChatOpenAI {
  const state = requireProviderState()
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

async function createButlerRuntime(params: {
  threadId: string
  onIntent: (intent: ButlerDispatchIntent) => void
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
  const capabilityTools = getEnabledToolInstances("butler")
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
    systemPrompt: buildButlerSystemPrompt(),
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
    }
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
  for await (const chunk of stream) {
    const [mode, data] = chunk as [string, unknown]
    if (mode !== "messages") continue
    const tuple = data as [{ kwargs?: { content?: unknown } }, unknown]
    const content = tuple?.[0]?.kwargs?.content
    if (typeof content === "string" && content.trim()) {
      lastAssistant = content
    } else if (Array.isArray(content)) {
      const text = content
        .filter(
          (item): item is { type?: string; text?: string } => !!item && typeof item === "object"
        )
        .map((item) => (item.type === "text" ? (item.text ?? "") : ""))
        .join("")
      if (text.trim()) {
        lastAssistant = text
      }
    }
  }

  const parsed = parseButlerAssistantText(lastAssistant)
  const assistantText =
    parsed.assistantText || (intents.length > 0 ? "已完成任务编排并开始执行。" : "已记录。")

  return {
    assistantText,
    dispatchIntents: intents,
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
  const systemPrompt = buildButlerPerceptionSystemPrompt()
  const userPrompt = buildButlerPerceptionUserPrompt({
    perception: input.perception
  })

  const result = await model.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)])
  const reminderText = extractTextContent(result.content)
  return {
    reminderText: reminderText || "检测到新的监听事件，请及时处理。"
  }
}

export async function runButlerDigestTurn(
  input: ButlerDigestTurnInput
): Promise<ButlerDigestTurnResult> {
  const model = getModelInstance()
  const systemPrompt = buildButlerDigestSystemPrompt()
  const userPrompt = buildButlerDigestUserPrompt({
    windowStart: input.digest.windowStart,
    windowEnd: input.digest.windowEnd,
    tasks: input.digest.tasks
  })

  const result = await model.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)])
  const summaryText = extractTextContent(result.content)
  return {
    summaryText: summaryText || ""
  }
}
