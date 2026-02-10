import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { createDeepAgent } from "deepagents"
import { LocalSandbox } from "../agent/local-sandbox"
import { getProviderState } from "../provider-config"
import { getCheckpointer } from "../agent/runtime"
import { getOpenworkDir } from "../storage"
import type { ProviderConfig, ProviderState, SimpleProviderId } from "../types"
import {
  buildButlerSystemPrompt,
  buildButlerPerceptionSystemPrompt,
  buildButlerPerceptionUserPrompt,
  getClarificationPrefix,
  parseButlerAssistantText,
  type ButlerPromptContext
} from "./prompt"
import { composeButlerUserPrompt } from "./prompt/composer"
import { createButlerDispatchTools, type ButlerDispatchIntent } from "./tools"
import type { ButlerPerceptionInput } from "../types"

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

const DAILY_PROFILE_MARKER = "[Daily Profile]"
const PROFILE_DELTA_MARKER = "[Profile Delta]"

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

  const tools = createButlerDispatchTools({ onIntent: params.onIntent })
  return createDeepAgent({
    model,
    checkpointer,
    backend,
    systemPrompt: buildButlerSystemPrompt(),
    tools,
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
      dispatchPolicy: input.promptContext.dispatchPolicy ?? "standard"
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
