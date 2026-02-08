import { listRunningMcpTools } from "../mcp/service"
import { listAppSkills } from "../skills"
import { listSubagents } from "../subagents"
import { listTools } from "../tools/service"

export interface ButlerCapabilitySnapshot {
  tools: string[]
  mcpTools: string[]
  skills: string[]
  subagents: string[]
}

function compactList(values: string[], limit = 6): string {
  if (values.length === 0) return "none"
  const head = values.slice(0, limit).join(", ")
  if (values.length <= limit) return head
  return `${head}, ... (+${values.length - limit})`
}

export function getButlerCapabilitySnapshot(): ButlerCapabilitySnapshot {
  const tools = listTools()
    .filter((item) => item.enabled && item.hasKey)
    .map((item) => item.name)

  const mcpTools = listRunningMcpTools().map((item) => item.fullName)

  const skills = listAppSkills()
    .filter((item) => item.enabled)
    .map((item) => item.name)

  const subagents = listSubagents()
    .filter((item) => item.enabled !== false)
    .map((item) => item.name)

  return {
    tools,
    mcpTools,
    skills,
    subagents
  }
}

export function buildCapabilityPromptBlock(snapshot: ButlerCapabilitySnapshot): string {
  return [
    "[Butler Capability Catalog]",
    `tools: ${snapshot.tools.join(", ") || "none"}`,
    `mcp_tools: ${snapshot.mcpTools.join(", ") || "none"}`,
    `skills: ${snapshot.skills.join(", ") || "none"}`,
    `subagents: ${snapshot.subagents.join(", ") || "none"}`
  ].join("\n")
}

export function buildCapabilitySummaryLine(snapshot: ButlerCapabilitySnapshot): string {
  return [
    "能力目录已同步",
    `Tools(${snapshot.tools.length}): ${compactList(snapshot.tools)}`,
    `MCP(${snapshot.mcpTools.length}): ${compactList(snapshot.mcpTools)}`,
    `Skills(${snapshot.skills.length}): ${compactList(snapshot.skills)}`,
    `Subagents(${snapshot.subagents.length}): ${compactList(snapshot.subagents)}`
  ].join(" | ")
}

