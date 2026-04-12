export const OPENAI_COMPATIBLE_IMPLEMENTATIONS = ["openai-native", "ark", "openrouter"] as const

export type OpenAICompatibleImplementation = (typeof OPENAI_COMPATIBLE_IMPLEMENTATIONS)[number]

export type OpenAIReasoningEffort = "low" | "medium" | "high"

export interface OpenAINativeReasoningConfig {
  enabled: boolean
  effort: OpenAIReasoningEffort
  summary: "auto"
}

export interface BooleanReasoningConfig {
  enabled: boolean
}

export type OpenAICompatibleReasoningConfig = OpenAINativeReasoningConfig | BooleanReasoningConfig

export function isOpenAICompatibleImplementation(
  value: unknown
): value is OpenAICompatibleImplementation {
  return (
    typeof value === "string" &&
    OPENAI_COMPATIBLE_IMPLEMENTATIONS.includes(value as OpenAICompatibleImplementation)
  )
}

export function inferOpenAICompatibleImplementationFromUrl(
  url?: string
): OpenAICompatibleImplementation {
  const normalized = url?.trim().toLowerCase() ?? ""
  if (normalized.includes("openrouter.ai")) return "openrouter"
  if (normalized.includes("volces.com") || normalized.includes("/ark")) return "ark"
  return "openai-native"
}

export function getDefaultOpenAICompatibleUrl(
  implementation: OpenAICompatibleImplementation
): string {
  if (implementation === "ark") {
    return "https://ark.cn-beijing.volces.com/api/v3"
  }
  if (implementation === "openrouter") {
    return "https://openrouter.ai/api/v1"
  }
  return "https://api.openai.com/v1"
}

export function isDefaultOpenAICompatibleUrl(
  url: string,
  implementation: OpenAICompatibleImplementation
): boolean {
  return url.trim() === getDefaultOpenAICompatibleUrl(implementation)
}

export function getDefaultOpenAICompatibleReasoning(
  implementation: OpenAICompatibleImplementation
): OpenAICompatibleReasoningConfig {
  if (implementation === "openai-native") {
    return {
      enabled: false,
      effort: "medium",
      summary: "auto"
    }
  }
  return { enabled: false }
}

function isOpenAIReasoningEffort(value: unknown): value is OpenAIReasoningEffort {
  return value === "low" || value === "medium" || value === "high"
}

export function normalizeOpenAICompatibleReasoning(
  value: unknown,
  implementation: OpenAICompatibleImplementation
): OpenAICompatibleReasoningConfig {
  const defaults = getDefaultOpenAICompatibleReasoning(implementation)
  if (!value || typeof value !== "object") {
    return defaults
  }

  const record = value as Record<string, unknown>
  const enabled = record.enabled === true

  if (implementation === "openai-native") {
    return {
      enabled,
      effort: isOpenAIReasoningEffort(record.effort) ? record.effort : "medium",
      summary: "auto"
    }
  }

  return { enabled }
}
