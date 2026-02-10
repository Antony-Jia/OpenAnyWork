import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import { listSkills } from "deepagents"
import type { CapabilityScope, SkillItem } from "./types"
import { logEntry, logExit } from "./logging"
import {
  getSkillEnabledState,
  isSkillEnabled,
  removeSkillConfig,
  setSkillEnabled
} from "./skills/config"
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

  // Source priority: agent-user < managed.
  const merged = new Map<string, SkillRecord>()
  for (const item of [...agentUserSkills, ...managedSkills]) {
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
  logEntry("Skills", "scan", {
    sourceRoot: normalizeSkillPath(AGENT_USER_SKILLS_ROOT)
  })

  const managedRoot = ensureManagedSkillsDir()
  if (!existsSync(AGENT_USER_SKILLS_ROOT)) {
    const result = listAppSkills()
    logExit("Skills", "scan", {
      sourceExists: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      count: result.length
    })
    return result
  }

  const discovered = listSkills({ userSkillsDir: AGENT_USER_SKILLS_ROOT })
  let imported = 0
  let skipped = 0
  let failed = 0

  for (const skill of discovered) {
    const sourceDir = resolve(skill.path, "..")
    const targetDir = join(managedRoot, skill.name)
    if (existsSync(targetDir)) {
      skipped += 1
      continue
    }

    try {
      cpSync(sourceDir, targetDir, { recursive: true })
      imported += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[Skills] Failed to import skill "${skill.name}": ${message}`)
    }
  }

  const result = listAppSkills()
  logExit("Skills", "scan", {
    sourceExists: true,
    sourceCount: discovered.length,
    imported,
    skipped,
    failed,
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
  const root = ensureManagedSkillsDir()
  const sourceDir = resolveSkillSourcePath(inputPath)
  const skillName = basename(sourceDir)
  const targetDir = join(root, skillName)

  if (existsSync(targetDir)) {
    throw new Error(`Skill "${skillName}" already exists.`)
  }

  mkdirSync(targetDir, { recursive: true })

  cpSync(sourceDir, targetDir, { recursive: true })

  const skillPath = join(targetDir, "SKILL.md")
  const description = readSkillDescription(skillPath)

  const result = {
    name: skillName,
    description,
    path: normalizeSkillPath(skillPath),
    source: "user",
    sourceType: "managed" as const,
    readOnly: false,
    enabledClassic: true,
    enabledButler: true,
    enabled: true
  }
  logExit("Skills", "install", { name: skillName })
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
