import type { PresetPluginId, PresetPluginItem } from "./contracts"

export interface PresetPluginDefinition {
  id: PresetPluginId
  name: string
  description: string
}

export const PRESET_PLUGIN_DEFINITIONS: PresetPluginDefinition[] = [
  {
    id: "actionbook",
    name: "Actionbook",
    description:
      "Browser automation plugin with extension bridge, runtime checks, and guided setup."
  },
  {
    id: "knowledgebase",
    name: "Knowledge Base",
    description: "Local RAG daemon plugin with runtime management and indexed data visibility."
  }
]

export function buildPresetPluginItems(
  enabledById: Partial<Record<PresetPluginId, boolean>>
): PresetPluginItem[] {
  return PRESET_PLUGIN_DEFINITIONS.map((plugin) => ({
    ...plugin,
    enabled: !!enabledById[plugin.id]
  }))
}
