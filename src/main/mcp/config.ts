import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { getOpenworkDir } from "../storage"
import type { McpServerConfig } from "../types"

const MCP_CONFIG_FILE = join(getOpenworkDir(), "mcp.json")

interface McpConfigStore {
  servers: McpServerConfig[]
}

function readConfig(): McpConfigStore {
  if (!existsSync(MCP_CONFIG_FILE)) {
    return { servers: [] }
  }

  try {
    const raw = readFileSync(MCP_CONFIG_FILE, "utf-8")
    const parsed = JSON.parse(raw) as McpConfigStore
    if (!parsed || !Array.isArray(parsed.servers)) {
      return { servers: [] }
    }
    return parsed
  } catch {
    return { servers: [] }
  }
}

function writeConfig(config: McpConfigStore): void {
  const data = JSON.stringify(config, null, 2)
  writeFileSync(MCP_CONFIG_FILE, data)
}

export function listMcpConfigs(): McpServerConfig[] {
  return readConfig().servers
}

export function saveMcpConfigs(servers: McpServerConfig[]): void {
  writeConfig({ servers })
}
