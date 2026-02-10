/* eslint-disable @typescript-eslint/no-unused-vars */
import { existsSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { createDeepAgent } from "deepagents"
import { toolRetryMiddleware, createMiddleware } from "langchain"
import { getThreadCheckpointPath } from "../storage"
import { getProviderState } from "../provider-config"
import { ChatOpenAI } from "@langchain/openai"
import { ToolMessage } from "@langchain/core/messages"
import { SqlJsSaver } from "../checkpointer/sqljs-saver"
import { LocalSandbox } from "./local-sandbox"
import { SKILL_OVERLAY_PREFIX, SkillOverlayBackend } from "./skill-overlay-backend"
import { listSubagentsByScope } from "../subagents"
import { listAppSkills } from "../skills"
import {
  getEnabledToolInstances,
  getEnabledToolNames,
  resolveToolInstancesByName
} from "../tools/service"
import { getRunningMcpToolInstances, listRunningMcpTools } from "../mcp/service"
import { resolveMiddlewareById } from "../middleware/registry"
import { createDockerTools } from "../tools/docker-tools"
import type {
  CapabilityScope,
  ContentBlock,
  DockerConfig,
  ProviderConfig,
  ProviderState,
  SkillItem,
  SimpleProviderId
} from "../types"
import { logEntry, logExit, summarizeList } from "../logging"

import type * as _lcTypes from "langchain"
import type * as _lcMessages from "@langchain/core/messages"
import type * as _lcLanggraph from "@langchain/langgraph"
import type * as _lcZodTypes from "@langchain/core/utils/types"

import { getBaseSystemPrompt } from "./system-prompt"

/**
 * Generate the full system prompt for the agent.
 *
 * @param workspacePath - The workspace path the agent is operating in
 * @returns The complete system prompt
 */
function getSystemPrompt(
  workspacePath: string,
  dockerConfig?: DockerConfig,
  isWindows?: boolean
): string {
  const baseSystemPrompt = getBaseSystemPrompt({ isWindows })
  const workingDirSection = `
### File System and Paths

**IMPORTANT - Path Handling:**
- All file paths use fully qualified absolute system paths
- The workspace root is: \`${workspacePath}\`
- Example: \`${workspacePath}/src/index.ts\`, \`${workspacePath}/README.md\`
- To list the workspace root, use \`ls("${workspacePath}")\`
- Always use full absolute paths for all file operations
`

  const dockerSection = dockerConfig?.enabled
    ? `
### Docker Mode

- Use Docker tools for container operations: execute_bash, upload_file, download_file, edit_file, cat_file
- Container working directory is /workspace
- Local filesystem tools operate on the host, not inside the container
`
    : ""

  return workingDirSection + dockerSection + baseSystemPrompt
}

function normalizeDockerWorkspace(config: DockerConfig): string {
  const mount = config.mounts?.[0]
  if (mount?.containerPath) {
    const normalized = mount.containerPath.replace(/\\/g, "/")
    return normalized.startsWith("/") ? normalized : `/${normalized}`
  }
  return "/workspace"
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error
  }

  if (error instanceof Error) {
    return error.message || error.name
  }

  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message
    }

    try {
      return JSON.stringify(error)
    } catch {
      return Object.prototype.toString.call(error)
    }
  }

  return String(error)
}

function normalizeSkillSourcePath(path: string): string {
  return path.replace(/\\/g, "/")
}

function resolveSkillRoot(path: string): string {
  const resolved = resolve(path)
  if (basename(resolved).toLowerCase() === "skill.md") {
    return dirname(resolved)
  }
  return resolved
}

function buildSkillPathMap(skills: SkillItem[]): Map<string, string> {
  const skillPathByName = new Map<string, string>()
  for (const skill of skills) {
    if (!skill?.name || !skill?.path) continue
    skillPathByName.set(skill.name, resolveSkillRoot(skill.path))
  }
  return skillPathByName
}

function toOverlaySegment(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return "unknown"
  return encodeURIComponent(trimmed)
}

function createSkillOverlaySource(params: {
  overlayBackend: SkillOverlayBackend
  sourceRoot: string
  selectedSkillNames?: string[]
  skillPathByName: Map<string, string>
  agentName: string
}): string[] | undefined {
  const { overlayBackend, sourceRoot, selectedSkillNames, skillPathByName, agentName } = params
  const uniqueSkillNames = Array.from(new Set(selectedSkillNames ?? []))
  logEntry("Runtime", "skills.overlay.prepare", {
    agentName,
    sourceRoot: normalizeSkillSourcePath(sourceRoot),
    ...summarizeList(uniqueSkillNames)
  })
  if (uniqueSkillNames.length === 0) {
    logExit("Runtime", "skills.overlay.prepare", {
      agentName,
      sourceCount: 0,
      reason: "no_selection"
    })
    return undefined
  }

  const skillsByName: Record<string, string> = {}
  for (const skillName of uniqueSkillNames) {
    const sourceDir = skillPathByName.get(skillName)
    if (!sourceDir) {
      logEntry("Runtime", "skills.missing", { agentName, skillName, reason: "not_in_registry" })
      continue
    }
    if (!existsSync(sourceDir)) {
      logEntry("Runtime", "skills.missing", { agentName, skillName, reason: "file_missing" })
      continue
    }

    skillsByName[skillName] = sourceDir
  }

  if (Object.keys(skillsByName).length === 0) {
    logExit("Runtime", "skills.overlay.prepare", {
      agentName,
      sourceCount: 0,
      reason: "no_valid_paths"
    })
    return undefined
  }
  overlayBackend.registerSkillSource(sourceRoot, skillsByName)
  const sources = [normalizeSkillSourcePath(sourceRoot)]
  logExit("Runtime", "skills.overlay.prepare", {
    agentName,
    sourceCount: sources.length,
    sources,
    registeredCount: Object.keys(skillsByName).length,
    registeredSkills: Object.keys(skillsByName).slice(0, 10)
  })
  return sources
}

export function createToolErrorHandlingMiddleware() {
  return createMiddleware({
    name: "toolErrorHandlingMiddleware",
    wrapToolCall: async (request, handler) => {
      try {
        // Execute the tool through the provided handler
        const result = await handler(request)
        return result
      } catch (error) {
        // Safely extract the tool name
        const toolName = String(request.tool?.name || "unknown")
        const toolCallId = request.toolCall.id || "unknown"

        // Convert the caught error into a readable string
        const errorMessage = getErrorMessage(error)

        // Return a ToolMessage with error details instead of throwing an exception
        // This prevents the agent execution from being interrupted by the error
        return new ToolMessage({
          content: `TOOL_ERROR: The tool "${toolName}" failed with the following error:\n\nERROR_MESSAGE: ${errorMessage}\n\nINSTRUCTIONS: Please review the error and retry the operation with corrected parameters or try an alternative approach.`,
          tool_call_id: toolCallId,
          name: toolName
        })
      }
    }
  })
}

// Per-thread checkpointer cache
const checkpointers = new Map<string, SqlJsSaver>()

export async function getCheckpointer(threadId: string): Promise<SqlJsSaver> {
  let checkpointer = checkpointers.get(threadId)
  if (!checkpointer) {
    const dbPath = getThreadCheckpointPath(threadId)
    checkpointer = new SqlJsSaver(dbPath)
    await checkpointer.initialize()
    checkpointers.set(threadId, checkpointer)
  }
  return checkpointer
}

export async function closeCheckpointer(threadId: string): Promise<void> {
  const checkpointer = checkpointers.get(threadId)
  if (checkpointer) {
    await checkpointer.close()
    checkpointers.delete(threadId)
  }
}

function hasImageBlocks(content?: string | ContentBlock[]): boolean {
  if (!Array.isArray(content)) return false
  return content.some((block) => block?.type === "image" || block?.type === "image_url")
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

// Get the appropriate model instance based on new simplified provider configuration
function getModelInstance(
  providerOverride?: SimpleProviderId,
  modelOverride?: string,
  messageContent?: string | ContentBlock[]
): ChatOpenAI {
  const state = requireProviderState()
  const requestedProvider = providerOverride ?? state.active
  const config = resolveProviderConfig(state, requestedProvider)

  // 使用 Provider 配置中的 model（简化配置模式下忽略传入的 modelId）
  const effectiveModel = modelOverride?.trim() || config.model
  if (!effectiveModel) {
    throw new Error(`Provider "${requestedProvider}" has no model configured.`)
  }

  console.log("[Runtime] Using provider:", requestedProvider)
  console.log("[Runtime] Configured model:", config.model)
  if (modelOverride) {
    console.log("[Runtime] Model override:", modelOverride)
  }
  if (hasImageBlocks(messageContent)) {
    console.log("[Runtime] Detected image content in message")
  }

  if (config.type === "ollama") {
    // Ollama uses OpenAI-compatible API at /v1 endpoint
    const baseURL = config.url.endsWith("/v1") ? config.url : `${config.url}/v1`
    console.log("[Runtime] Ollama baseURL:", baseURL)

    return new ChatOpenAI({
      model: effectiveModel,
      configuration: {
        baseURL: baseURL
      },
      // Ollama doesn't need an API key, but ChatOpenAI requires one
      // Use a placeholder value
      apiKey: "ollama"
    })
  }

  if (!config.apiKey) {
    throw new Error(`Provider "${requestedProvider}" is missing an API key.`)
  }

  // OpenAI-compatible / Multimodal provider
  console.log("[Runtime] OpenAI-compatible baseURL:", config.url)

  return new ChatOpenAI({
    model: effectiveModel,
    apiKey: config.apiKey,
    configuration: {
      baseURL: config.url
    }
  })
}

// ============================================================================
// Legacy provider selection logic (kept for reference, not used)
// ============================================================================
/*
function getModelInstanceLegacy(
  modelId?: string
): ChatAnthropic | ChatOpenAI | ChatGoogleGenerativeAI | string {
  const model = modelId || getDefaultModel()
  console.log("[Runtime] Using model:", model)

  // Determine provider from model ID
  if (model.startsWith("claude")) {
    const apiKey = getApiKey("anthropic")
    console.log("[Runtime] Anthropic API key present:", !!apiKey)
    if (!apiKey) {
      throw new Error("Anthropic API key not configured")
    }
    return new ChatAnthropic({
      model,
      anthropicApiKey: apiKey
    })
  } else if (
    model.startsWith("gpt") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  ) {
    const apiKey = getApiKey("openai")
    console.log("[Runtime] OpenAI API key present:", !!apiKey)
    if (!apiKey) {
      throw new Error("OpenAI API key not configured")
    }
    return new ChatOpenAI({
      model,
      openAIApiKey: apiKey
    })
  } else if (model.startsWith("gemini")) {
    const apiKey = getApiKey("google")
    console.log("[Runtime] Google API key present:", !!apiKey)
    if (!apiKey) {
      throw new Error("Google API key not configured")
    }
    return new ChatGoogleGenerativeAI({
      model,
      apiKey: apiKey
    })
  }

  // Default to model string (let deepagents handle it)
  return model
}
*/

export interface CreateAgentRuntimeOptions {
  /** Thread ID - REQUIRED for per-thread checkpointing */
  threadId: string
  /** Model ID to use (defaults to configured default model) */
  modelId?: string
  /** Optional message content for multimodal detection */
  messageContent?: string | ContentBlock[]
  /** Workspace path - REQUIRED for agent to operate on files */
  workspacePath: string
  /** Optional docker configuration for container mode */
  dockerConfig?: DockerConfig | null
  /** Optional docker container ID for shared container mode */
  dockerContainerId?: string | null
  /** Disable human-in-the-loop approvals */
  disableApprovals?: boolean
  /** Optional extra system prompt to append */
  extraSystemPrompt?: string
  /** Optional tools to force-inject by name */
  forceToolNames?: string[]
  /** Capability scope used for tools/MCP/skills/subagents selection */
  capabilityScope?: CapabilityScope
}

// Create agent runtime with configured model and checkpointer
export type AgentRuntime = ReturnType<typeof createDeepAgent>

export async function createAgentRuntime(options: CreateAgentRuntimeOptions) {
  const {
    threadId,
    modelId,
    messageContent,
    workspacePath,
    dockerConfig,
    dockerContainerId,
    disableApprovals,
    extraSystemPrompt,
    forceToolNames,
    capabilityScope = "classic"
  } = options
  void modelId

  if (!threadId) {
    throw new Error("Thread ID is required for checkpointing.")
  }

  if (!workspacePath) {
    throw new Error(
      "Workspace path is required. Please select a workspace folder before running the agent."
    )
  }

  logEntry("Runtime", "createAgentRuntime", {
    threadId,
    hasWorkspace: !!workspacePath,
    dockerEnabled: !!dockerConfig?.enabled
  })

  console.log("[Runtime] Creating agent runtime...")
  console.log("[Runtime] Thread ID:", threadId)
  console.log("[Runtime] Workspace path:", workspacePath)
  if (dockerConfig?.enabled) {
    console.log("[Runtime] Docker mode enabled with image:", dockerConfig.image)
  }

  const requiresMultimodal = hasImageBlocks(messageContent)
  const model = getModelInstance(
    requiresMultimodal ? "multimodal" : undefined,
    undefined,
    messageContent
  )
  console.log("[Runtime] Model instance created:", typeof model)

  const checkpointer = await getCheckpointer(threadId)
  console.log("[Runtime] Checkpointer ready for thread:", threadId)

  const baseBackend = new LocalSandbox({
    rootDir: workspacePath || process.cwd(),
    virtualMode: false, // Use absolute system paths for consistency with shell commands
    timeout: 120_000, // 2 minutes
    maxOutputBytes: 100_000 // ~100KB
  })
  const overlayBackend = new SkillOverlayBackend(baseBackend)

  const effectiveWorkspace = dockerConfig?.enabled
    ? normalizeDockerWorkspace(dockerConfig)
    : workspacePath
  const isWindows = process.platform === "win32"
  const now = new Date()
  const currentTimePrompt = `Current time: ${now.toISOString()}\nCurrent year: ${now.getFullYear()}`
  const systemPrompt =
    getSystemPrompt(effectiveWorkspace, dockerConfig || undefined, isWindows) +
    `\n\n${currentTimePrompt}` +
    (extraSystemPrompt ? `\n\n${extraSystemPrompt}` : "")

  const allSkills = listAppSkills({ workspacePath })
  const enabledSkills = allSkills.filter((skill) =>
    capabilityScope === "butler" ? skill.enabledButler : skill.enabledClassic
  )
  logEntry("Runtime", "skills.registry_snapshot", {
    totalCount: allSkills.length,
    enabledCount: enabledSkills.length,
    enabledSkills: enabledSkills.map((skill) => ({
      name: skill.name,
      path: normalizeSkillSourcePath(skill.path)
    }))
  })
  const skillPathByName = buildSkillPathMap(allSkills)
  const runtimeSkillsRoot = `${SKILL_OVERLAY_PREFIX}/${toOverlaySegment(threadId)}`
  const mainSkillSources = createSkillOverlaySource({
    overlayBackend,
    sourceRoot: `${runtimeSkillsRoot}/main-agent`,
    selectedSkillNames: enabledSkills.map((skill) => skill.name),
    skillPathByName,
    agentName: "main-agent"
  })
  logEntry("Runtime", "skills.runtime_root", { path: runtimeSkillsRoot })
  logEntry("Runtime", "skills.enabled", summarizeList(enabledSkills.map((skill) => skill.name)))
  logEntry("Runtime", "skills.main_sources", {
    sourceCount: mainSkillSources?.length ?? 0,
    sources: mainSkillSources ?? []
  })

  const subagents = listSubagentsByScope(capabilityScope).map((agent) => {
    const resolvedTools = resolveToolInstancesByName(agent.tools, capabilityScope) ?? []
    logEntry("Runtime", "subagent.tools", {
      name: agent.name,
      ...summarizeList(agent.tools ?? [])
    })
    logExit("Runtime", "subagent.tools", {
      name: agent.name,
      resolvedCount: resolvedTools.length
    })
    const subagentSkillSources = createSkillOverlaySource({
      overlayBackend,
      sourceRoot: `${runtimeSkillsRoot}/${toOverlaySegment(agent.id)}`,
      selectedSkillNames: agent.skills,
      skillPathByName,
      agentName: agent.name
    })
    logEntry("Runtime", "subagent.skills", {
      name: agent.name,
      ...summarizeList(agent.skills ?? [])
    })
    logExit("Runtime", "subagent.skills", {
      name: agent.name,
      sourceCount: subagentSkillSources?.length ?? 0,
      sources: subagentSkillSources ?? []
    })
    const subagentModel = getModelInstance(agent.provider, agent.model, undefined)
    return {
      name: agent.name,
      description: agent.description,
      systemPrompt: `${agent.systemPrompt}\n\n${currentTimePrompt}`,
      model: subagentModel,
      tools: resolvedTools,
      middleware: resolveMiddlewareById(agent.middleware),
      skills: subagentSkillSources,
      interruptOn: disableApprovals ? undefined : agent.interruptOn ? { execute: true } : undefined
    }
  })

  // Custom filesystem prompt for absolute paths (matches virtualMode: false)
  const filesystemSystemPrompt = `You have access to a filesystem. All file paths use fully qualified absolute system paths.

- ls(path): list files in a directory (e.g., ls("${effectiveWorkspace}"))
- read_file(file_path, offset?, limit?): read a file from the filesystem. IMPORTANT: use "file_path" as parameter name, not "filearg"
- write_file(file_path, content): write to a file in the filesystem
- edit_file(file_path, old_str, new_str): edit a file in the filesystem
- glob(pattern): find files matching a pattern (e.g., "**/*.py")
- grep(pattern, path): search for text within files

The workspace root is: ${effectiveWorkspace}`

  const dockerTools = dockerConfig?.enabled
    ? createDockerTools(dockerConfig, dockerContainerId || null)
    : []
  const enabledToolNames = getEnabledToolNames(capabilityScope)
  const mcpToolInfos = listRunningMcpTools(capabilityScope)
  const mcpToolNames = mcpToolInfos.map((toolInfo) => toolInfo.fullName)
  const mcpTools = await getRunningMcpToolInstances(capabilityScope)
  const forcedTools = resolveToolInstancesByName(forceToolNames, capabilityScope) ?? []
  const enabledTools = [...getEnabledToolInstances(capabilityScope), ...mcpTools, ...dockerTools]
  const tools = [...enabledTools]
  for (const tool of forcedTools) {
    if (!tools.includes(tool)) tools.push(tool)
  }

  logEntry("Runtime", "tools.inject", {
    ...summarizeList(enabledToolNames),
    mcpCount: mcpToolNames.length,
    dockerCount: dockerTools.length,
    scope: capabilityScope
  })
  if (mcpToolNames.length > 0) {
    logEntry("Runtime", "tools.inject.mcp", summarizeList(mcpToolNames))
  }

  // Tool retry middleware for handling tool call failures
  const retryMiddleware = toolRetryMiddleware({
    maxRetries: 3,
    onFailure: "continue",
    initialDelayMs: 500,
    backoffFactor: 2.0
  })
  const toolErrorHandlingMiddleware = createToolErrorHandlingMiddleware()

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend: overlayBackend,
    systemPrompt: systemPrompt + "\n\n" + filesystemSystemPrompt,
    tools,
    // Custom filesystem prompt for absolute paths (requires deepagents update)
    // filesystemSystemPrompt,
    subagents,
    skills: mainSkillSources,
    // Require human approval for all shell commands
    interruptOn: disableApprovals ? undefined : { execute: true },
    // Add retry + error handling middleware for tool call failures
    middleware: [toolErrorHandlingMiddleware, retryMiddleware]
  } as Parameters<typeof createDeepAgent>[0])

  console.log("[Runtime] Deep agent created with LocalSandbox at:", workspacePath)
  logExit("Runtime", "createAgentRuntime", { threadId })
  return agent
}

export type DeepAgent = ReturnType<typeof createDeepAgent>

// Clean up all checkpointer resources
export async function closeRuntime(): Promise<void> {
  const closePromises = Array.from(checkpointers.values()).map((cp) => cp.close())
  await Promise.all(closePromises)
  checkpointers.clear()
}
