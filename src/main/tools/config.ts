import { getDb, markDbDirty } from "../db"
import type { CapabilityScope } from "../types"

interface ToolConfigStore {
  [toolName: string]: {
    key?: string
    enabledClassic?: boolean
    enabledButler?: boolean
    enabled?: boolean
  }
}

function readToolsConfig(): ToolConfigStore {
  const database = getDb()
  const stmt = database.prepare(
    "SELECT name, enabled, enabled_classic, enabled_butler, key FROM tool_config"
  )
  const config: ToolConfigStore = {}
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      name?: string
      enabled?: number | null
      enabled_classic?: number | null
      enabled_butler?: number | null
      key?: string | null
    }
    const name = row.name
    if (!name) continue
    const legacyEnabled =
      row.enabled === null || row.enabled === undefined ? undefined : Boolean(row.enabled)
    const enabledClassic =
      row.enabled_classic === null || row.enabled_classic === undefined
        ? legacyEnabled
        : Boolean(row.enabled_classic)
    const enabledButler =
      row.enabled_butler === null || row.enabled_butler === undefined
        ? legacyEnabled
        : Boolean(row.enabled_butler)
    const key = row.key ?? undefined
    config[name] = {
      enabled: legacyEnabled ?? enabledClassic,
      enabledClassic,
      enabledButler,
      key
    }
  }
  stmt.free()
  return config
}

function resolveLegacyEnabled(entry: ToolConfigStore[string]): boolean | undefined {
  if (entry.enabledClassic === undefined && entry.enabledButler === undefined) {
    return entry.enabled
  }
  if (entry.enabledClassic !== undefined && entry.enabledButler !== undefined) {
    return entry.enabledClassic === entry.enabledButler
      ? entry.enabledClassic
      : entry.enabledClassic
  }
  return entry.enabledClassic ?? entry.enabledButler ?? entry.enabled
}

function writeToolsConfig(config: ToolConfigStore): void {
  const database = getDb()
  database.run("DELETE FROM tool_config")
  for (const [name, entry] of Object.entries(config)) {
    const enabledLegacy = resolveLegacyEnabled(entry)
    const enabled =
      enabledLegacy === undefined || enabledLegacy === null ? null : enabledLegacy ? 1 : 0
    const enabledClassic =
      entry.enabledClassic === undefined || entry.enabledClassic === null
        ? null
        : entry.enabledClassic
          ? 1
          : 0
    const enabledButler =
      entry.enabledButler === undefined || entry.enabledButler === null
        ? null
        : entry.enabledButler
          ? 1
          : 0
    const key = entry.key ?? null
    database.run(
      `INSERT OR REPLACE INTO tool_config
       (name, enabled, enabled_classic, enabled_butler, key)
       VALUES (?, ?, ?, ?, ?)`,
      [name, enabled, enabledClassic, enabledButler, key]
    )
  }
  markDbDirty()
}

function pruneEntry(config: ToolConfigStore, toolName: string): void {
  const existing = config[toolName]
  if (!existing) return
  if (
    !existing.key &&
    existing.enabled === undefined &&
    existing.enabledClassic === undefined &&
    existing.enabledButler === undefined
  ) {
    delete config[toolName]
  }
}

export function getStoredToolKey(toolName: string): string | undefined {
  const config = readToolsConfig()
  return config[toolName]?.key
}

export function setStoredToolKey(toolName: string, key: string | null): void {
  const config = readToolsConfig()
  const existing = config[toolName] ?? {}
  const trimmed = key?.trim()

  if (!trimmed) {
    delete existing.key
  } else {
    existing.key = trimmed
  }

  config[toolName] = existing
  pruneEntry(config, toolName)

  writeToolsConfig(config)
}

export function getToolEnabledState(toolName: string): { classic: boolean; butler: boolean } {
  const config = readToolsConfig()
  const entry = config[toolName]
  const classic = entry?.enabledClassic ?? entry?.enabled ?? true
  const butler = entry?.enabledButler ?? entry?.enabled ?? true
  return { classic, butler }
}

export function isToolEnabled(toolName: string, scope: CapabilityScope = "classic"): boolean {
  const state = getToolEnabledState(toolName)
  return scope === "butler" ? state.butler : state.classic
}

export function setToolEnabled(toolName: string, enabled: boolean, scope?: CapabilityScope): void {
  const config = readToolsConfig()
  const existing = config[toolName] ?? {}

  if (!scope) {
    existing.enabled = enabled
    existing.enabledClassic = enabled
    existing.enabledButler = enabled
  } else {
    if (scope === "classic") {
      existing.enabledClassic = enabled
    } else {
      existing.enabledButler = enabled
    }
    existing.enabled = existing.enabledClassic ?? existing.enabledButler ?? existing.enabled
  }

  config[toolName] = existing
  pruneEntry(config, toolName)
  writeToolsConfig(config)
}

export function resolveToolKey(toolName: string, envVarName?: string): string | undefined {
  const storedKey = getStoredToolKey(toolName)
  if (storedKey) {
    return storedKey
  }

  if (envVarName) {
    return process.env[envVarName]
  }

  return undefined
}
