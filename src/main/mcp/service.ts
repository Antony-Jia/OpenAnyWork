import { randomUUID } from "node:crypto"
import { tool } from "langchain"
import { z } from "zod"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { listMcpConfigs, saveMcpConfigs } from "./config"
import type {
  McpServerConfig,
  McpServerCreateParams,
  McpServerListItem,
  McpServerStatus,
  McpServerUpdateParams,
  McpToolInfo
} from "../types"

type McpToolDefinition = {
  name: string
  description?: string
}

type RunningMcpServer = {
  config: McpServerConfig
  client: Client
  transport: unknown
  tools: McpToolDefinition[]
  toolInstances: Array<unknown>
}

const runningServers = new Map<string, RunningMcpServer>()
const lastErrors = new Map<string, string | null>()

const clientInfo = {
  name: "openwork",
  version: "0.1.0"
}

function getConfigById(id: string): McpServerConfig | undefined {
  return listMcpConfigs().find((item) => item.id === id)
}

function updateConfig(id: string, updates: Partial<Omit<McpServerConfig, "id">>): McpServerConfig {
  const servers = listMcpConfigs()
  const index = servers.findIndex((item) => item.id === id)
  if (index < 0) {
    throw new Error("MCP server not found.")
  }

  const next = {
    ...servers[index],
    ...updates
  }
  servers[index] = next
  saveMcpConfigs(servers)
  return next
}

function parseToolDefinitions(raw: unknown): McpToolDefinition[] {
  const tools = (raw as { tools?: McpToolDefinition[] } | undefined)?.tools
  if (!Array.isArray(tools)) {
    return []
  }
  return tools.filter((item) => item && typeof item.name === "string")
}

function buildToolInstances(serverId: string, tools: McpToolDefinition[]): Array<unknown> {
  return tools.map((toolDef) => {
    const toolName = `mcp.${serverId}.${toolDef.name}`
    const description =
      toolDef.description || `Call MCP tool "${toolDef.name}" from server ${serverId}.`

    return tool(
      async (args: Record<string, unknown>) => {
        const running = runningServers.get(serverId)
        if (!running) {
          throw new Error(`MCP server ${serverId} is not running.`)
        }
        return running.client.callTool({
          name: toolDef.name,
          arguments: args ?? {}
        })
      },
      {
        name: toolName,
        description,
        schema: z.record(z.any()).describe("Arguments for the MCP tool")
      }
    )
  })
}

function toMcpToolInfo(
  server: McpServerConfig,
  toolDef: McpToolDefinition
): McpToolInfo {
  const fullName = `mcp.${server.id}.${toolDef.name}`
  return {
    serverId: server.id,
    serverName: server.name,
    toolName: toolDef.name,
    fullName,
    description: toolDef.description
  }
}

export function listMcpServers(): McpServerListItem[] {
  const servers = listMcpConfigs()
  return servers.map((config) => {
    const running = runningServers.get(config.id)
    const status: McpServerStatus = {
      running: !!running,
      toolsCount: running?.tools?.length ?? 0,
      lastError: lastErrors.get(config.id) ?? null
    }
    return { config, status }
  })
}

export function createMcpServer(input: McpServerCreateParams): McpServerConfig {
  if (!input.name?.trim()) {
    throw new Error("MCP server name is required.")
  }
  if (input.mode === "local" && !input.command?.trim()) {
    throw new Error("Command is required for local MCP servers.")
  }
  if (input.mode === "remote" && !input.url?.trim()) {
    throw new Error("URL is required for remote MCP servers.")
  }

  const servers = listMcpConfigs()
  const created: McpServerConfig = {
    ...input,
    id: randomUUID(),
    name: input.name.trim(),
    command: input.command?.trim(),
    url: input.url?.trim(),
    autoStart: input.autoStart ?? false
  }
  saveMcpConfigs([...servers, created])
  return created
}

export async function updateMcpServer({
  id,
  updates
}: McpServerUpdateParams): Promise<McpServerConfig> {
  const next = updateConfig(id, updates)
  const running = runningServers.has(id)
  if (running && updates.autoStart === false) {
    await stopMcpServer(id)
    return next
  }

  if (running) {
    await stopMcpServer(id)
    await startMcpServer(id)
  } else if (updates.autoStart) {
    await startMcpServer(id)
  }
  return next
}

export async function deleteMcpServer(id: string): Promise<void> {
  await stopMcpServer(id)
  const servers = listMcpConfigs().filter((item) => item.id !== id)
  saveMcpConfigs(servers)
  lastErrors.delete(id)
}

export async function startMcpServer(id: string): Promise<McpServerStatus> {
  const existing = runningServers.get(id)
  if (existing) {
    return { running: true, toolsCount: existing.tools.length, lastError: null }
  }

  const config = getConfigById(id)
  if (!config) {
    throw new Error("MCP server not found.")
  }

  try {
    const client = new Client(clientInfo, { capabilities: {} })
    let transport: unknown

    if (config.mode === "local") {
      transport = new StdioClientTransport({
        command: config.command || "",
        args: config.args || [],
        env: { ...process.env, ...(config.env ?? {}) },
        cwd: config.cwd
      })
    } else {
      const url = new URL(config.url || "")
      transport = new SSEClientTransport(url, {
        headers: config.headers
      })
    }

    await client.connect(transport)

    const toolList = await client.listTools()
    const tools = parseToolDefinitions(toolList)
    const toolInstances = buildToolInstances(config.id, tools)

    runningServers.set(config.id, {
      config,
      client,
      transport,
      tools,
      toolInstances
    })
    lastErrors.set(config.id, null)
    updateConfig(config.id, { autoStart: true })

    return { running: true, toolsCount: tools.length, lastError: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start MCP server."
    lastErrors.set(id, message)
    throw new Error(message)
  }
}

export async function stopMcpServer(id: string): Promise<McpServerStatus> {
  const running = runningServers.get(id)
  if (running) {
    try {
      await running.client.close()
    } catch {
      // ignore close errors
    }

    const maybeTransport = running.transport as { close?: () => Promise<void> | void }
    if (maybeTransport?.close) {
      try {
        await maybeTransport.close()
      } catch {
        // ignore close errors
      }
    }

    runningServers.delete(id)
  }

  updateConfig(id, { autoStart: false })
  lastErrors.set(id, null)
  return { running: false, toolsCount: 0, lastError: null }
}

export async function startAutoMcpServers(): Promise<void> {
  const servers = listMcpConfigs().filter((item) => item.autoStart)
  for (const server of servers) {
    try {
      await startMcpServer(server.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start MCP server."
      lastErrors.set(server.id, message)
    }
  }
}

export async function getRunningMcpToolInstances(): Promise<Array<unknown>> {
  return Array.from(runningServers.values()).flatMap((server) => server.toolInstances)
}

export function listRunningMcpTools(): McpToolInfo[] {
  return Array.from(runningServers.values()).flatMap((server) =>
    server.tools.map((toolDef) => toMcpToolInfo(server.config, toolDef))
  )
}

export function getRunningMcpToolInstanceMap(): Map<string, unknown> {
  const entries = Array.from(runningServers.values()).flatMap((server) =>
    server.tools.map((toolDef, index) => {
      const fullName = `mcp.${server.config.id}.${toolDef.name}`
      const instance = server.toolInstances[index]
      return [fullName, instance] as const
    })
  )
  return new Map(entries)
}
