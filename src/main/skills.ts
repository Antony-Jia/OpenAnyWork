import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { listSkills } from "deepagents"
import type { CapabilityScope, SkillItem } from "./types"
import { logEntry, logExit } from "./logging"
import {
  getSkillEnabledState,
  isSkillEnabled,
  removeSkillConfig,
  setSkillEnabled
} from "./skills/config"
import {
  readSkillsRegistry,
  rebuildSkillsRegistry,
  registerSkillSourceRoot
} from "./skills/registry"
import { getOpenworkDir } from "./storage"

const MANAGED_SKILLS_ROOT = join(getOpenworkDir(), "skills")
const AGENT_USER_SKILLS_ROOT = join(homedir(), ".agents", "skills")

export interface ListAppSkillsOptions {
  workspacePath?: string | null
  scope?: CapabilityScope
}

type SkillSourceType = NonNullable<SkillItem["sourceType"]>

interface SkillRecord extends SkillItem {
  sourceType: SkillSourceType
  readOnly: boolean
  skillPath: string
  root: string
}

function ensureManagedSkillsDir(): string {
  if (!existsSync(MANAGED_SKILLS_ROOT)) {
    mkdirSync(MANAGED_SKILLS_ROOT, { recursive: true })
  }
  return MANAGED_SKILLS_ROOT
}

function normalizeSkillPath(path: string): string {
  return resolve(path).replace(/\\/g, "/")
}

export function getSkillsRoot(): string {
  return ensureManagedSkillsDir()
}

function listSkillRecordsByRoot(params: {
  root: string
  sourceType: SkillSourceType
  readOnly: boolean
  ensureRoot?: boolean
}): SkillRecord[] {
  const { root, sourceType, readOnly, ensureRoot } = params
  if (ensureRoot && !existsSync(root)) {
    mkdirSync(root, { recursive: true })
  }
  if (!existsSync(root)) {
    return []
  }

  const skills = listSkills({ userSkillsDir: root })
  return skills.map((skill) => {
    const state = getSkillEnabledState(skill.name)
    return {
      name: skill.name,
      description: skill.description,
      path: normalizeSkillPath(skill.path),
      skillPath: resolve(skill.path),
      root: resolve(root),
      source: skill.source,
      sourceType,
      readOnly,
      enabled: state.classic,
      enabledClassic: state.classic,
      enabledButler: state.butler
    }
  })
}

function listConfiguredSkillRecords(): SkillRecord[] {
  const registry = readSkillsRegistry()
  const records: SkillRecord[] = []
  for (const [name, entry] of Object.entries(registry.skills)) {
    if (!name.trim()) continue
    if (!entry?.skillPath) continue
    const skillPath = resolve(entry.skillPath)
    if (!existsSync(skillPath)) {
      continue
    }
    const state = getSkillEnabledState(name)
    records.push({
      name,
      description: readSkillDescription(skillPath),
      path: normalizeSkillPath(skillPath),
      skillPath,
      root: resolve(entry.sourceRoot),
      source: "user",
      sourceType: "configured-path",
      readOnly: true,
      enabled: state.classic,
      enabledClassic: state.classic,
      enabledButler: state.butler
    })
  }
  return records
}

function listAppSkillRecords(options?: ListAppSkillsOptions): SkillRecord[] {
  void options
  const agentUserSkills = listSkillRecordsByRoot({
    root: AGENT_USER_SKILLS_ROOT,
    sourceType: "agent-user",
    readOnly: true
  })
  const managedSkills = listSkillRecordsByRoot({
    root: ensureManagedSkillsDir(),
    sourceType: "managed",
    readOnly: false,
    ensureRoot: true
  })
  const configuredPathSkills = listConfiguredSkillRecords()

  // Source priority: agent-user < managed < configured-path.
  const merged = new Map<string, SkillRecord>()
  for (const item of [...agentUserSkills, ...managedSkills, ...configuredPathSkills]) {
    merged.set(item.name, item)
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function toSkillItem(record: SkillRecord): SkillItem {
  return {
    name: record.name,
    description: record.description,
    path: normalizeSkillPath(record.skillPath),
    source: record.source,
    sourceType: record.sourceType,
    readOnly: record.readOnly,
    enabledClassic: record.enabledClassic,
    enabledButler: record.enabledButler,
    enabled: record.enabled
  }
}

function resolveSkillRecord(name: string, options?: ListAppSkillsOptions): SkillRecord {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error("Skill name is required.")
  }

  const record = listAppSkillRecords(options).find((item) => item.name === normalized)
  if (!record) {
    throw new Error("Skill not found.")
  }
  return record
}

export function listAppSkills(options?: ListAppSkillsOptions): SkillItem[] {
  logEntry("Skills", "list")
  const all = listAppSkillRecords(options).map((record) => toSkillItem(record))
  const result =
    options?.scope === undefined
      ? all
      : all.filter((item) =>
          options.scope === "butler" ? item.enabledButler : item.enabledClassic
        )
  logExit("Skills", "list", { count: result.length })
  return result
}

export function scanAndImportAgentUserSkills(): SkillItem[] {
  logEntry("Skills", "scan")
  const rebuild = rebuildSkillsRegistry()
  const result = listAppSkills()
  logExit("Skills", "scan", {
    scannedRoots: rebuild.scannedRoots,
    discoveredSkills: rebuild.discoveredSkills,
    added: rebuild.added,
    updated: rebuild.updated,
    removed: rebuild.removed,
    count: result.length
  })
  return result
}

function validateSkillName(name: string): void {
  if (!name) {
    throw new Error("Skill name is required.")
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Skill name must be lowercase alphanumeric with hyphens.")
  }
}

export function createSkill(params: {
  name: string
  description: string
  content?: string
}): SkillItem {
  logEntry("Skills", "create", { name: params.name, contentLength: params.content?.length ?? 0 })
  const root = ensureManagedSkillsDir()
  const name = params.name.trim()
  const description = params.description.trim()

  validateSkillName(name)
  if (!description) {
    throw new Error("Skill description is required.")
  }

  const skillDir = join(root, name)
  if (existsSync(skillDir)) {
    throw new Error(`Skill "${name}" already exists.`)
  }

  mkdirSync(skillDir, { recursive: true })

  const content =
    params.content?.trim() ||
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nDescribe what this skill does and how to use it.\n`

  const skillPath = join(skillDir, "SKILL.md")
  writeFileSync(skillPath, content)

  const result = {
    name,
    description,
    path: normalizeSkillPath(skillPath),
    source: "user",
    sourceType: "managed" as const,
    readOnly: false,
    enabledClassic: true,
    enabledButler: true,
    enabled: true
  }
  logExit("Skills", "create", { name })
  return result
}

function resolveSkillSourcePath(inputPath: string): string {
  if (!existsSync(inputPath)) {
    throw new Error("Skill path does not exist.")
  }

  const stats = statSync(inputPath)
  if (stats.isFile()) {
    if (basename(inputPath).toLowerCase() !== "skill.md") {
      throw new Error("Skill path must point to a SKILL.md file or its directory.")
    }
    return resolve(join(inputPath, ".."))
  }

  if (stats.isDirectory()) {
    const skillMd = join(inputPath, "SKILL.md")
    if (!existsSync(skillMd)) {
      throw new Error("No SKILL.md found in the selected directory.")
    }
    return resolve(inputPath)
  }

  throw new Error("Skill path must be a file or directory.")
}

export function installSkillFromPath(inputPath: string): SkillItem {
  logEntry("Skills", "install", { inputPath })
  const sourceDir = resolveSkillSourcePath(inputPath)
  const sourceRoot = resolve(dirname(sourceDir))
  const skillName = basename(sourceDir)

  registerSkillSourceRoot(sourceRoot)
  const rebuild = rebuildSkillsRegistry()
  const registryRecord = rebuild.registry.skills[skillName]
  if (!registryRecord || !existsSync(registryRecord.skillPath)) {
    throw new Error(`Skill "${skillName}" was not found after scanning configured paths.`)
  }

  const state = getSkillEnabledState(skillName)
  const description = readSkillDescription(registryRecord.skillPath)

  const result = {
    name: skillName,
    description,
    path: normalizeSkillPath(registryRecord.skillPath),
    source: "user",
    sourceType: "configured-path" as const,
    readOnly: true,
    enabledClassic: state.classic,
    enabledButler: state.butler,
    enabled: state.classic
  }
  logExit("Skills", "install", {
    name: skillName,
    sourceRoot: normalizeSkillPath(sourceRoot),
    scannedRoots: rebuild.scannedRoots,
    added: rebuild.added,
    updated: rebuild.updated,
    removed: rebuild.removed
  })
  return result
}

function readSkillDescription(skillPath: string): string {
  try {
    const content = readFileSync(skillPath, "utf-8")
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
    if (!match) return ""
    const frontmatter = match[1]
    const descMatch = frontmatter.match(/^description:\s*(.*)$/m)
    if (!descMatch) return ""
    const raw = descMatch[1].trim()
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      try {
        if (raw.startsWith('"')) {
          return JSON.parse(raw)
        }
        return raw.slice(1, -1)
      } catch {
        return raw.slice(1, -1)
      }
    }
    return raw
  } catch {
    return ""
  }
}

export function deleteSkill(name: string): void {
  logEntry("Skills", "delete", { name })
  const record = resolveSkillRecord(name)
  if (record.readOnly) {
    throw new Error("Skill is read-only.")
  }
  const skillDir = resolve(record.skillPath, "..")
  if (!existsSync(skillDir)) {
    logExit("Skills", "delete", { name, removed: false })
    return
  }
  rmSync(skillDir, { recursive: true, force: true })
  removeSkillConfig(record.name)
  logExit("Skills", "delete", { name: record.name })
}

export function getSkillContent(name: string): string {
  logEntry("Skills", "getContent", { name })
  const record = resolveSkillRecord(name)
  if (!existsSync(record.skillPath)) {
    throw new Error("Skill not found.")
  }
  const content = readFileSync(record.skillPath, "utf-8")
  logExit("Skills", "getContent", { name: record.name, contentLength: content.length })
  return content
}

export function saveSkillContent(name: string, content: string): SkillItem {
  logEntry("Skills", "saveContent", { name, contentLength: content.length })
  const record = resolveSkillRecord(name)
  if (record.readOnly) {
    throw new Error("Skill is read-only.")
  }
  if (!existsSync(record.skillPath)) {
    throw new Error("Skill not found.")
  }
  writeFileSync(record.skillPath, content)
  const description = readSkillDescription(record.skillPath)
  const result = {
    name: record.name,
    description,
    path: normalizeSkillPath(record.skillPath),
    source: record.source,
    sourceType: record.sourceType,
    readOnly: false,
    enabledClassic: isSkillEnabled(record.name, "classic"),
    enabledButler: isSkillEnabled(record.name, "butler"),
    enabled: isSkillEnabled(record.name, "classic")
  }
  logExit("Skills", "saveContent", { name: record.name })
  return result
}

export function updateSkillEnabled(
  name: string,
  enabled: boolean,
  scope?: CapabilityScope
): SkillItem {
  logEntry("Skills", "setEnabled", { name, enabled, scope: scope ?? "all" })
  const record = resolveSkillRecord(name)
  setSkillEnabled(record.name, enabled, scope)
  const state = getSkillEnabledState(record.name)
  const description = readSkillDescription(record.skillPath)
  const result = {
    name: record.name,
    description,
    path: normalizeSkillPath(record.skillPath),
    source: record.source,
    sourceType: record.sourceType,
    readOnly: record.readOnly,
    enabledClassic: state.classic,
    enabledButler: state.butler,
    enabled: state.classic
  }
  logExit("Skills", "setEnabled", {
    name: record.name,
    enabledClassic: result.enabledClassic,
    enabledButler: result.enabledButler
  })
  return result
}
