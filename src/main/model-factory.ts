import { ChatOpenAI } from "@langchain/openai"
import { getProxyAgents } from "./proxy-config"
import type { ProviderConfig } from "./types"
import {
  inferOpenAICompatibleImplementationFromUrl,
  normalizeOpenAICompatibleReasoning
} from "../shared/openai-compatible"

export function createChatModelFromProviderConfig(
  config: ProviderConfig,
  modelOverride?: string
): ChatOpenAI {
  const proxyAgents = getProxyAgents()
  const effectiveModel = modelOverride?.trim() || config.model?.trim()
  if (!effectiveModel) {
    throw new Error(`Provider "${config.type}" has no model configured.`)
  }

  if (config.type === "ollama") {
    const baseURL = config.url.endsWith("/v1") ? config.url : `${config.url}/v1`
    return new ChatOpenAI({
      model: effectiveModel,
      configuration: {
        baseURL,
        ...proxyAgents
      },
      apiKey: "ollama"
    })
  }

  const baseConfig = {
    model: effectiveModel,
    apiKey: config.apiKey.trim(),
    configuration: {
      baseURL: config.url.trim(),
      ...proxyAgents
    },
    extra_body: {
      think: true
    }
  }

  if (config.type !== "openai-compatible") {
    return new ChatOpenAI(baseConfig)
  }

  const implementation =
    config.implementation ?? inferOpenAICompatibleImplementationFromUrl(config.url)
  const reasoning = normalizeOpenAICompatibleReasoning(config.reasoning, implementation)

  if (implementation === "openai-native") {
    if (!reasoning.enabled) {
      return new ChatOpenAI(baseConfig)
    }
    const effort = "effort" in reasoning ? reasoning.effort : "medium"
    const summary = "summary" in reasoning ? reasoning.summary : "auto"
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
    return new ChatOpenAI(baseConfig)
  }

  if (implementation === "ark") {
    return new ChatOpenAI({
      ...baseConfig,
      modelKwargs: {
        thinking: { type: "enabled" }
      }
    })
  }

  return new ChatOpenAI({
    ...baseConfig,
    modelKwargs: {
      reasoning: { enabled: true }
    }
  })
}
