import { isToolEnabled, resolveToolKey, setStoredToolKey, setToolEnabled } from "./config"
import { toolDefinitions, toolInstanceMap } from "./registry"
import { getRunningMcpToolInstanceMap } from "../mcp/service"
import type { CapabilityScope, ToolInfo } from "../types"
import { logEntry, logExit, summarizeList } from "../logging"
import { canSendEmail } from "../email/service"
import { getSettings } from "../settings"
import { getProviderState } from "../provider-config"
import { getMultimodalDisabledReason, isMultimodalConfigured } from "../vision/multimodal"

function computeToolAvailability(toolName: string): {
  available: boolean
  disabledReason?: string
} {
  if (toolName !== "analyze_image") {
    return { available: true }
  }

  const settings = getSettings()
  if (settings.vision?.toolCallingEnabled === false) {
    return { available: false, disabledReason: "Visual tool mode is disabled in Settings." }
  }

  const providerState = getProviderState()
  if (!isMultimodalConfigured(providerState)) {
    return { available: false, disabledReason: getMultimodalDisabledReason(providerState) }
  }

  return { available: true }
}

function toToolInfo(definition: (typeof toolDefinitions)[number]): ToolInfo {
  const availability = computeToolAvailability(definition.name)
  const hasKey =
    definition.name === "analyze_image"
      ? availability.available
      : definition.name === "send_email"
        ? canSendEmail()
        : definition.requiresKey === false
          ? true
          : !!resolveToolKey(definition.name, definition.envVar)
  const enabledClassic = isToolEnabled(definition.name, "classic")
  const enabledButler = isToolEnabled(definition.name, "butler")
  const enabled = enabledClassic
  return {
    ...definition,
    hasKey,
    enabledClassic,
    enabledButler,
    enabled,
    available: availability.available,
    disabledReason: availability.disabledReason
  }
}

export function listTools(): ToolInfo[] {
  logEntry("Tools", "listTools", { definitions: toolDefinitions.length })
  const result = toolDefinitions.map((definition) => toToolInfo(definition))
  logExit("Tools", "listTools", summarizeList(result.map((t) => t.name)))
  return result
}

export function getEnabledToolInstances(scope: CapabilityScope = "classic") {
  const enabled = toolDefinitions
    .filter(
      (definition) =>
        isToolEnabled(definition.name, scope) && computeToolAvailability(definition.name).available
    )
    .map((definition) => toolInstanceMap.get(definition.name))
    .filter((instance): instance is NonNullable<typeof instance> => !!instance)
  logExit("Tools", "getEnabledToolInstances", { count: enabled.length, scope })
  return enabled
}

export function getEnabledToolNames(scope: CapabilityScope = "classic"): string[] {
  const names = toolDefinitions
    .filter(
      (definition) =>
        isToolEnabled(definition.name, scope) && computeToolAvailability(definition.name).available
    )
    .map((definition) => definition.name)
  logExit("Tools", "getEnabledToolNames", { ...summarizeList(names), scope })
  return names
}

export function resolveToolInstancesByName(
  names?: string[],
  scope: CapabilityScope = "classic"
): Array<unknown> | undefined {
  if (!names) {
    logExit("Tools", "resolveToolInstancesByName", { requested: 0, resolved: 0 })
    return undefined
  }
  if (names.length === 0) {
    logExit("Tools", "resolveToolInstancesByName", { requested: 0, resolved: 0 })
    return []
  }

  const mcpToolMap = getRunningMcpToolInstanceMap(scope)
  // For subagents, we resolve tools by name directly without checking global enabled state.
  // The subagent configuration explicitly specifies which tools to use.
  const instances = names
    .map((name) => {
      if (name.startsWith("mcp.")) return mcpToolMap.get(name)
      if (!computeToolAvailability(name).available) return undefined
      return toolInstanceMap.get(name)
    })
    .filter((instance): instance is NonNullable<typeof instance> => !!instance)

  logExit("Tools", "resolveToolInstancesByName", {
    requested: names.length,
    resolved: instances.length
  })
  return instances.length > 0 ? instances : undefined
}

export function updateToolKey(toolName: string, key: string | null): ToolInfo {
  const definition = toolDefinitions.find((tool) => tool.name === toolName)
  if (!definition) {
    throw new Error("Tool not found.")
  }

  logEntry("Tools", "updateToolKey", { toolName, hasKey: !!key })
  setStoredToolKey(toolName, key)
  const result = toToolInfo(definition)
  logExit("Tools", "updateToolKey", { toolName, hasKey: result.hasKey })
  return result
}

export function updateToolEnabled(toolName: string, enabled: boolean): ToolInfo {
  const definition = toolDefinitions.find((tool) => tool.name === toolName)
  if (!definition) {
    throw new Error("Tool not found.")
  }
  const availability = computeToolAvailability(toolName)
  if (enabled && !availability.available) {
    throw new Error(availability.disabledReason || "Tool is unavailable.")
  }

  logEntry("Tools", "updateToolEnabled", { toolName, enabled })
  setToolEnabled(toolName, enabled)
  const result = toToolInfo(definition)
  logExit("Tools", "updateToolEnabled", { toolName, enabled: result.enabled })
  return result
}

export function updateToolEnabledByScope(
  toolName: string,
  enabled: boolean,
  scope: CapabilityScope
): ToolInfo {
  const definition = toolDefinitions.find((tool) => tool.name === toolName)
  if (!definition) {
    throw new Error("Tool not found.")
  }
  const availability = computeToolAvailability(toolName)
  if (enabled && !availability.available) {
    throw new Error(availability.disabledReason || "Tool is unavailable.")
  }

  logEntry("Tools", "updateToolEnabledByScope", { toolName, enabled, scope })
  setToolEnabled(toolName, enabled, scope)
  const result = toToolInfo(definition)
  logExit("Tools", "updateToolEnabledByScope", {
    toolName,
    scope,
    enabledClassic: result.enabledClassic,
    enabledButler: result.enabledButler
  })
  return result
}
