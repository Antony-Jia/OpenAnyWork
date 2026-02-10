import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"
import { getProviderState } from "../provider-config"
import type { ProviderConfig, ProviderState, SimpleProviderId } from "../types"
import type { ButlerDispatchIntent } from "./tools"

export type OversplitVerdict = "valid_multi" | "suspected_oversplit"

export interface OversplitDetectionInput {
  userMessage: string
  intents: ButlerDispatchIntent[]
}

export interface OversplitDetectionResult {
  verdict: OversplitVerdict
  reason: string
  confidence: number
}

const OVERSPLIT_CONFIDENCE_THRESHOLD = 0.6

const detectorOutputSchema = z.object({
  verdict: z.enum(["valid_multi", "suspected_oversplit"]),
  reason: z.string().trim().min(1),
  confidence: z.number().min(0).max(1)
})

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

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((item): item is { type?: string; text?: string } => !!item && typeof item === "object")
    .map((item) => (item.type === "text" ? (item.text ?? "") : ""))
    .join("")
}

function parseJsonObject(text: string): unknown {
  const raw = text.trim()
  if (!raw) {
    throw new Error("Detector returned empty response.")
  }
  try {
    return JSON.parse(raw)
  } catch {
    const first = raw.indexOf("{")
    const last = raw.lastIndexOf("}")
    if (first < 0 || last < first) {
      throw new Error("Detector output contains no JSON object.")
    }
    return JSON.parse(raw.slice(first, last + 1))
  }
}

function formatIntents(intents: ButlerDispatchIntent[]): string {
  if (intents.length === 0) return "none"
  return intents
    .map((intent, index) => {
      const deps = intent.dependsOn.length > 0 ? intent.dependsOn.join(", ") : "none"
      return `${index + 1}. [${intent.mode}] ${intent.title} | taskKey=${intent.taskKey} | dependsOn=${deps}`
    })
    .join("\n")
}

function normalizeDetectorVerdict(
  parsed: z.infer<typeof detectorOutputSchema>
): OversplitDetectionResult {
  const confidence = Math.max(0, Math.min(1, parsed.confidence))
  if (parsed.verdict === "suspected_oversplit" && confidence >= OVERSPLIT_CONFIDENCE_THRESHOLD) {
    return {
      verdict: "suspected_oversplit",
      reason: parsed.reason.trim(),
      confidence
    }
  }
  return {
    verdict: "valid_multi",
    reason: parsed.reason.trim(),
    confidence
  }
}

export async function detectOversplitByModel(
  input: OversplitDetectionInput
): Promise<OversplitDetectionResult> {
  try {
    const model = getModelInstance()
    const response = await model.invoke([
      new SystemMessage(
        [
          "你是任务粒度判定器，只判断是否疑似过拆。",
          "判定标准：仅当多个任务在语义上彼此独立、可独立交付、失败互不影响时，才是 valid_multi。",
          "如果一个目标只是步骤链（如抓取->去重->发送），应判为 suspected_oversplit。",
          "必须输出 JSON，且仅输出 JSON：",
          '{"verdict":"valid_multi|suspected_oversplit","reason":"...","confidence":0-1}'
        ].join("\n")
      ),
      new HumanMessage(
        [
          "[User Request]",
          input.userMessage.trim(),
          "",
          "[Candidate Plan]",
          formatIntents(input.intents),
          "",
          "[Task]",
          "判断该候选计划是否疑似过拆。confidence 表示你对该 verdict 的置信度。"
        ].join("\n")
      )
    ])

    const rawText = extractTextContent(response.content)
    const parsedJson = parseJsonObject(rawText)
    const parsed = detectorOutputSchema.parse(parsedJson)
    return normalizeDetectorVerdict(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      verdict: "suspected_oversplit",
      reason: `粒度判定失败，按保守策略进入确认流程：${message}`,
      confidence: 1
    }
  }
}
