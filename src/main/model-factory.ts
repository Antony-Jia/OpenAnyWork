import { ChatOpenAI } from "@langchain/openai"
import { getProxyAgents } from "./proxy-config"
import type { ProviderConfig } from "./types"
import {
  inferOpenAICompatibleImplementationFromUrl,
  normalizeOpenAICompatibleReasoning
} from "../shared/openai-compatible"

export function createChatModelFromProviderConfig(
  config: ProviderConfig,
  modelOverride?: string,
  debugLog?: (message: string) => void
): ChatOpenAI {
  const proxyAgents = getProxyAgents()
  const effectiveModel = modelOverride?.trim() || config.model?.trim()
  if (!effectiveModel) {
    throw new Error(`Provider "${config.type}" has no model configured.`)
  }

  debugLog?.(
    `[ModelFactory] createChatModelFromProviderConfig: ${JSON.stringify({
      providerType: config.type,
      effectiveModel,
      modelOverride: modelOverride?.trim() || "",
      hasApiKey: config.type === "ollama" ? true : !!config.apiKey,
      implementation:
        config.type === "openai-compatible"
          ? (config.implementation ?? inferOpenAICompatibleImplementationFromUrl(config.url))
          : undefined,
      reasoning: config.type === "openai-compatible" ? config.reasoning : undefined
    })}`
  )

  if (config.type === "ollama") {
    const baseURL = config.url.endsWith("/v1") ? config.url : `${config.url}/v1`
    debugLog?.(
      `[ModelFactory] Ollama config: ${JSON.stringify({
        baseURL,
        effectiveModel,
        proxyAgentCount: Object.keys(proxyAgents).length
      })}`
    )
    debugLog?.(
      `[ModelFactory] Ollama request payload: ${JSON.stringify({
        baseURL,
        effectiveModel,
        proxyAgentCount: Object.keys(proxyAgents).length,
        modelKwargs: { think: true },
        reasoning: undefined,
        reasoningEnabled: false
      })}`
    )
    return new ChatOpenAI({
      model: effectiveModel,
      configuration: {
        baseURL,
        ...proxyAgents
      },
      apiKey: "ollama",
      modelKwargs: {
        think: true
      },
      __includeRawResponse: true
    })
  }

  const baseConfig = {
    model: effectiveModel,
    apiKey: config.apiKey.trim(),
    configuration: {
      baseURL: config.url.trim(),
      ...proxyAgents
    },
    modelKwargs: {
      think: true
    }
  }

  debugLog?.(
    `[ModelFactory] Base OpenAI-compatible config: ${JSON.stringify({
      baseURL: config.url.trim(),
      effectiveModel,
      providerType: config.type,
      proxyAgentCount: Object.keys(proxyAgents).length,
      modelKwargs: baseConfig.modelKwargs,
      reasoning: config.type === "openai-compatible" ? config.reasoning : undefined
    })}`
  )

  if (config.type !== "openai-compatible") {
    return new ChatOpenAI({
      ...baseConfig,
      __includeRawResponse: true
    })
  }

  const implementation =
    config.implementation ?? inferOpenAICompatibleImplementationFromUrl(config.url)
  const reasoning = normalizeOpenAICompatibleReasoning(config.reasoning, implementation)

  debugLog?.(
    `[ModelFactory] OpenAI-compatible reasoning normalized: ${JSON.stringify({
      implementation,
      reasoning,
      rawReasoning: config.reasoning,
      reasoningEnabled: reasoning.enabled
    })}`
  )

  if (implementation === "openai-native") {
    if (!reasoning.enabled) {
      debugLog?.("[ModelFactory] Using openai-native without reasoning")
      return new ChatOpenAI(baseConfig)
    }
    const effort = "effort" in reasoning ? reasoning.effort : "medium"
    const summary = "summary" in reasoning ? reasoning.summary : "auto"
    debugLog?.(
      `[ModelFactory] Using openai-native reasoning: ${JSON.stringify({
        effort,
        summary,
        useResponsesApi: true,
        reasoning: {
          effort,
          summary
        }
      })}`
    )
    return new ChatOpenAI({
      ...baseConfig,
      reasoning: {
        effort,
        summary
      },
      useResponsesApi: true
    })
  }

  if (!reasoning.enabled) {
    debugLog?.(`[ModelFactory] Reasoning disabled for implementation ${implementation}`)
    return new ChatOpenAI(baseConfig)
  }

  if (implementation === "ark") {
    debugLog?.("[ModelFactory] Using ark reasoning via modelKwargs.thinking.enabled")
    debugLog?.(
      `[ModelFactory] Ark reasoning request fields: ${JSON.stringify({
        reasoning: { enabled: true },
        modelKwargs: { thinking: { type: "enabled" } }
      })}`
    )
    return new ChatOpenAI({
      ...baseConfig,
      modelKwargs: {
        thinking: { type: "enabled" }
      },
      __includeRawResponse: true
    })
  }

  debugLog?.("[ModelFactory] Using generic reasoning via modelKwargs.reasoning.enabled")
  debugLog?.(
    `[ModelFactory] Generic reasoning request fields: ${JSON.stringify({
      reasoning: { enabled: true },
      modelKwargs: { reasoning: { enabled: true } }
    })}`
  )
  return new ChatOpenAI({
    ...baseConfig,
    modelKwargs: {
      reasoning: { enabled: true }
    },
    __includeRawResponse: true
  })
}
