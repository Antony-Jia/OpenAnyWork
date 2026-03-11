import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { listSkills } from "deepagents"
import type {
  CapabilityScope,
  SkillBundle,
  SkillCapabilities,
  SkillItem,
  SkillTextFile
} from "./types"
import { logEntry, logExit } from "./logging"
import { getSkillEnabledState, removeSkillConfig, setSkillEnabled } from "./skills/config"
import {
  readSkillsRegistry,
  rebuildSkillsRegistry,
  registerSkillSourceRoot
} from "./skills/registry"
import { getOpenworkDir } from "./storage"

const MANAGED_SKILLS_ROOT = join(getOpenworkDir(), "skills")
const AGENT_USER_SKILLS_ROOT = join(homedir(), ".agents", "skills")
const SKILL_MAIN_FILE = "SKILL.md"
const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".py",
  ".js",
  ".ts",
  ".sh",
  ".ps1"
])

export interface ListAppSkillsOptions {
  workspacePath?: string | null
  scope?: CapabilityScope
}

type SkillSourceType = NonNullable<SkillItem["sourceType"]>

interface SkillFileInput {
  path: string
  content: string
}

interface SkillRecord extends SkillItem {
  sourceType: SkillSourceType
  root: string
  skillPath: string
}

function ensureManagedSkillsDir(): string {
  if (!existsSync(MANAGED_SKILLS_ROOT)) {
    mkdirSync(MANAGED_SKILLS_ROOT, { recursive: true })
  }
  return MANAGED_SKILLS_ROOT
}

function ensureAgentUserSkillsDir(): string {
  if (!existsSync(AGENT_USER_SKILLS_ROOT)) {
    mkdirSync(AGENT_USER_SKILLS_ROOT, { recursive: true })
  }
  return AGENT_USER_SKILLS_ROOT
}

function normalizeSkillPath(path: string): string {
  return resolve(path).replace(/\\/g, "/")
}

function pathKey(path: string): string {
  const normalized = normalizeSkillPath(path)
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

function createSkillId(rootPath: string): string {
  return pathKey(rootPath)
}

function upsertFrontmatterLine(frontmatter: string, key: string, value: string): string {
  const fieldPattern = new RegExp(`^${key}:\\s*.*$`, "m")
  if (fieldPattern.test(frontmatter)) {
    return frontmatter.replace(fieldPattern, `${key}: ${value}`)
  }
  return frontmatter ? `${frontmatter}\n${key}: ${value}` : `${key}: ${value}`
}

function readSkillDescriptionFromContent(content: string): string {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
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
}

function ensureSkillMarkdownContent(params: {
  content: string
  skillName: string
  fallbackDescription: string
}): string {
  const source = params.content.trim()
  const bodyFallback = `# ${params.skillName}\n\nDescribe what this skill does and how to use it.`
  const frontmatterMatch = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)
  const parsedDescription = readSkillDescriptionFromContent(source).trim()
  const description = (parsedDescription || params.fallbackDescription || "").trim()
  const serializedDescription = JSON.stringify(
    description || `Reusable skill for ${params.skillName}.`
  )

  if (!frontmatterMatch) {
    return [
      "---",
      `name: ${params.skillName}`,
      `description: ${serializedDescription}`,
      "---",
      "",
      source || bodyFallback,
      ""
    ].join("\n")
  }

  let frontmatter = frontmatterMatch[1].trim()
  frontmatter = upsertFrontmatterLine(frontmatter, "name", params.skillName)
  frontmatter = upsertFrontmatterLine(frontmatter, "description", serializedDescription)
  const body = frontmatterMatch[2].trim() || bodyFallback

  return ["---", frontmatter, "---", "", body, ""].join("\n")
}

function validateSkillName(name: string): void {
  if (!name) {
    throw new Error("Skill name is required.")
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Skill name must be lowercase alphanumeric with hyphens.")
  }
}

function isTextSkillFile(path: string): boolean {
  if (basename(path).toLowerCase() === "skill.md") {
    return true
  }
  return TEXT_FILE_EXTENSIONS.has(extname(path).toLowerCase())
}

function normalizeRelativeSkillFilePath(path: string): string {
  const normalized = path
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\.\/+/, "")
  if (!normalized) {
    throw new Error("Skill file path is required.")
  }
  if (normalized.startsWith("/") || normalized.startsWith("\\")) {
    throw new Error("Skill file path must be relative.")
  }
  if (/^[a-zA-Z]:\//.test(normalized)) {
    throw new Error("Skill file path must be relative.")
  }

  const segments = normalized.split("/").filter(Boolean)
  if (segments.length === 0) {
    throw new Error("Skill file path is required.")
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Skill file path cannot escape the skill root.")
  }

  return segments.join("/")
}

function ensurePathInsideRoot(rootPath: string, targetPath: string): void {
  const rootResolved = normalizeSkillPath(rootPath)
  const targetResolved = normalizeSkillPath(targetPath)
  const rel = relative(rootResolved, targetResolved).replace(/\\/g, "/")
  if (rel === "" || rel === ".") {
    return
  }
  if (rel.startsWith("../") || rel === "..") {
    throw new Error("Skill file path cannot escape the skill root.")
  }
}

function ensureNoExternalSymlink(rootPath: string, relativePath: string): string {
  const rootResolved = resolve(rootPath)
  const rootReal = existsSync(rootResolved) ? realpathSync(rootResolved) : rootResolved
  let current = rootResolved

  for (const segment of relativePath.split("/")) {
    current = join(current, segment)
    ensurePathInsideRoot(rootResolved, current)
    if (!existsSync(current)) {
      continue
    }
    const stats = lstatSync(current)
    if (!stats.isSymbolicLink()) {
      continue
    }
    const real = realpathSync(current)
    ensurePathInsideRoot(rootReal, real)
  }

  return current
}

function resolveSkillFilePath(
  rootPath: string,
  relativePath: string
): {
  absolutePath: string
  relativePath: string
} {
  const normalizedRelativePath = normalizeRelativeSkillFilePath(relativePath)
  const absolutePath = ensureNoExternalSymlink(rootPath, normalizedRelativePath)
  ensurePathInsideRoot(rootPath, absolutePath)
  return {
    absolutePath,
    relativePath: normalizedRelativePath
  }
}

function pruneEmptyDirectories(rootPath: string, fromPath: string): void {
  let current = dirname(fromPath)
  const stopAt = resolve(rootPath)
  while (
    pathKey(current) !== pathKey(stopAt) &&
    current.startsWith(stopAt) &&
    existsSync(current)
  ) {
    if (readdirSync(current).length > 0) {
      break
    }
    rmSync(current, { recursive: true, force: true })
    current = dirname(current)
  }
}

function getSkillCapabilities(sourceType: SkillSourceType): SkillCapabilities {
  if (sourceType === "managed") {
    return { canEdit: true, canDelete: true, canCliManage: false }
  }
  if (sourceType === "agent-user") {
    return { canEdit: true, canDelete: false, canCliManage: true }
  }
  if (sourceType === "configured-path") {
    return { canEdit: true, canDelete: false, canCliManage: false }
  }
  return { canEdit: true, canDelete: false, canCliManage: false }
}

function readSkillDescription(skillPath: string): string {
  try {
    const content = readFileSync(skillPath, "utf-8")
    return readSkillDescriptionFromContent(content)
  } catch {
    return ""
  }
}

function createSkillRecord(params: {
  name: string
  description: string
  skillPath: string
  root: string
  source?: string
  sourceType: SkillSourceType
}): SkillRecord {
  const state = getSkillEnabledState(params.name)
  const capabilities = getSkillCapabilities(params.sourceType)
  return {
    id: createSkillId(params.root),
    name: params.name,
    description: params.description,
    path: normalizeSkillPath(params.skillPath),
    rootPath: normalizeSkillPath(params.root),
    mainFilePath: normalizeSkillPath(params.skillPath),
    skillPath: resolve(params.skillPath),
    root: resolve(params.root),
    source: params.source,
    sourceType: params.sourceType,
    readOnly: !capabilities.canEdit,
    capabilities,
    enabled: state.classic,
    enabledClassic: state.classic,
    enabledButler: state.butler
  }
}

function listSkillRecordsByRoot(params: {
  root: string
  sourceType: SkillSourceType
  source?: string
  ensureRoot?: boolean
}): SkillRecord[] {
  const { root, sourceType, source, ensureRoot } = params
  if (ensureRoot && !existsSync(root)) {
    mkdirSync(root, { recursive: true })
  }
  if (!existsSync(root)) {
    return []
  }

  const skills = listSkills({ userSkillsDir: root })
  return skills.map((skill) =>
    createSkillRecord({
      name: skill.name,
      description: skill.description,
      skillPath: skill.path,
      root: dirname(resolve(skill.path)),
      source: source ?? skill.source,
      sourceType
    })
  )
}

function listConfiguredSkillRecords(): SkillRecord[] {
  const registry = readSkillsRegistry()
  const records: SkillRecord[] = []
  for (const [name, entry] of Object.entries(registry.skills)) {
    if (!name.trim() || !entry?.skillPath) {
      continue
    }
    const skillPath = resolve(entry.skillPath)
    if (!existsSync(skillPath)) {
      continue
    }
    records.push(
      createSkillRecord({
        name,
        description: readSkillDescription(skillPath),
        skillPath,
        root: dirname(skillPath),
        source: "user",
        sourceType: "configured-path"
      })
    )
  }
  return records
}

function listAppSkillRecords(options?: ListAppSkillsOptions): SkillRecord[] {
  void options
  const agentUserSkills = listSkillRecordsByRoot({
    root: ensureAgentUserSkillsDir(),
    sourceType: "agent-user"
  })
  const managedSkills = listSkillRecordsByRoot({
    root: ensureManagedSkillsDir(),
    sourceType: "managed",
    ensureRoot: true
  })
  const configuredPathSkills = listConfiguredSkillRecords()

  const merged = new Map<string, SkillRecord>()
  for (const item of [...agentUserSkills, ...managedSkills, ...configuredPathSkills]) {
    merged.set(item.name, item)
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function toSkillItem(record: SkillRecord): SkillItem {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    path: normalizeSkillPath(record.skillPath),
    rootPath: normalizeSkillPath(record.root),
    mainFilePath: normalizeSkillPath(record.skillPath),
    source: record.source,
    sourceType: record.sourceType,
    readOnly: !record.capabilities.canEdit,
    capabilities: record.capabilities,
    enabledClassic: record.enabledClassic,
    enabledButler: record.enabledButler,
    enabled: record.enabled
  }
}

function resolveSkillRecord(identifier: string, options?: ListAppSkillsOptions): SkillRecord {
  const normalized = identifier.trim()
  if (!normalized) {
    throw new Error("Skill identifier is required.")
  }

  const records = listAppSkillRecords(options)
  const record = records.find((item) => item.id === normalized || item.name === normalized)
  if (!record) {
    throw new Error("Skill not found.")
  }
  return record
}

function ensureTextFileAllowed(relativePath: string): void {
  if (!isTextSkillFile(relativePath)) {
    throw new Error(`Only text skill files are supported: ${relativePath}`)
  }
}

function writeSkillFile(
  rootPath: string,
  input: SkillFileInput,
  skillName: string,
  description: string
): void {
  const { absolutePath, relativePath } = resolveSkillFilePath(rootPath, input.path)
  ensureTextFileAllowed(relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  const content =
    relativePath.toLowerCase() === "skill.md"
      ? ensureSkillMarkdownContent({
          content: input.content,
          skillName,
          fallbackDescription: description
        })
      : input.content
  writeFileSync(absolutePath, content)
}

function normalizeCreateFiles(params: {
  name: string
  description: string
  content?: string
  files?: SkillFileInput[]
}): SkillFileInput[] {
  const files = params.files?.length
    ? params.files.map((file) => ({
        path: normalizeRelativeSkillFilePath(file.path),
        content: file.content
      }))
    : [
        {
          path: SKILL_MAIN_FILE,
          content:
            params.content?.trim() ||
            `# ${params.name}\n\nDescribe what this skill does and how to use it.\n`
        }
      ]

  const deduped = new Map<string, SkillFileInput>()
  for (const file of files) {
    ensureTextFileAllowed(file.path)
    deduped.set(file.path, { ...file, path: file.path })
  }

  if (!deduped.has(SKILL_MAIN_FILE)) {
    deduped.set(SKILL_MAIN_FILE, {
      path: SKILL_MAIN_FILE,
      content:
        params.content?.trim() ||
        `# ${params.name}\n\nDescribe what this skill does and how to use it.\n`
    })
  }

  const skillFile = deduped.get(SKILL_MAIN_FILE)
  if (skillFile) {
    deduped.set(SKILL_MAIN_FILE, {
      path: SKILL_MAIN_FILE,
      content: ensureSkillMarkdownContent({
        content: skillFile.content,
        skillName: params.name,
        fallbackDescription: params.description
      })
    })
  }

  return Array.from(deduped.values()).sort((a, b) => a.path.localeCompare(b.path))
}

function buildSkillBundle(record: SkillRecord): SkillBundle {
  const files: SkillTextFile[] = []
  const rootPath = resolve(record.root)
  const rootReal = existsSync(rootPath) ? realpathSync(rootPath) : rootPath
  const stack = [rootPath]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || !existsSync(current)) {
      continue
    }
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]
      const absolutePath = join(current, entry.name)
      const normalizedRelative = relative(rootPath, absolutePath).replace(/\\/g, "/")
      if (entry.isDirectory()) {
        stack.push(absolutePath)
        continue
      }

      let isText = false
      let editable = false
      let content: string | undefined
      const size = statSync(absolutePath).size

      try {
        const stats = lstatSync(absolutePath)
        if (stats.isSymbolicLink()) {
          const real = realpathSync(absolutePath)
          ensurePathInsideRoot(rootReal, real)
        }
        isText = isTextSkillFile(normalizedRelative)
        editable = record.capabilities.canEdit && isText
        if (isText) {
          content = readFileSync(absolutePath, "utf-8")
        }
      } catch {
        isText = false
        editable = false
        content = undefined
      }

      files.push({
        path: normalizedRelative,
        content,
        editable,
        isText,
        size
      })
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path))

  return {
    id: record.id,
    name: record.name,
    description: readSkillDescription(record.skillPath) || record.description,
    rootPath: normalizeSkillPath(record.root),
    mainFilePath: normalizeSkillPath(record.skillPath),
    source: record.source,
    sourceType: record.sourceType,
    files,
    capabilities: record.capabilities
  }
}

export function getSkillsRoot(): string {
  return ensureManagedSkillsDir()
}

export function getAgentUserSkillsRoot(): string {
  return ensureAgentUserSkillsDir()
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

export function createSkill(params: {
  name: string
  description: string
  content?: string
  files?: SkillFileInput[]
}): SkillItem {
  logEntry("Skills", "create", {
    name: params.name,
    contentLength: params.content?.length ?? 0,
    files: params.files?.length ?? 0
  })
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
  const files = normalizeCreateFiles(params)
  for (const file of files) {
    writeSkillFile(skillDir, file, name, description)
  }

  const record = createSkillRecord({
    name,
    description: readSkillDescription(join(skillDir, SKILL_MAIN_FILE)) || description,
    skillPath: join(skillDir, SKILL_MAIN_FILE),
    root: skillDir,
    source: "user",
    sourceType: "managed"
  })
  logExit("Skills", "create", { name })
  return toSkillItem(record)
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
    const skillMd = join(inputPath, SKILL_MAIN_FILE)
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

  const record = createSkillRecord({
    name: skillName,
    description: readSkillDescription(registryRecord.skillPath),
    skillPath: registryRecord.skillPath,
    root: dirname(resolve(registryRecord.skillPath)),
    source: "user",
    sourceType: "configured-path"
  })

  logExit("Skills", "install", {
    name: skillName,
    sourceRoot: normalizeSkillPath(sourceRoot),
    scannedRoots: rebuild.scannedRoots,
    added: rebuild.added,
    updated: rebuild.updated,
    removed: rebuild.removed
  })
  return toSkillItem(record)
}

export function deleteSkill(identifier: string): void {
  logEntry("Skills", "delete", { identifier })
  const record = resolveSkillRecord(identifier)
  if (!record.capabilities.canDelete) {
    throw new Error("Skill cannot be deleted directly.")
  }
  const skillDir = resolve(record.root)
  if (!existsSync(skillDir)) {
    logExit("Skills", "delete", { identifier, removed: false })
    return
  }
  rmSync(skillDir, { recursive: true, force: true })
  removeSkillConfig(record.name)
  logExit("Skills", "delete", { name: record.name })
}

export function getSkillBundle(identifier: string): SkillBundle {
  logEntry("Skills", "getBundle", { identifier })
  const record = resolveSkillRecord(identifier)
  const bundle = buildSkillBundle(record)
  logExit("Skills", "getBundle", { identifier: record.id, files: bundle.files.length })
  return bundle
}

export function getSkillContent(identifier: string): string {
  logEntry("Skills", "getContent", { identifier })
  const bundle = getSkillBundle(identifier)
  const mainFile = bundle.files.find((file) => file.path.toLowerCase() === "skill.md")
  if (!mainFile?.content) {
    throw new Error("Skill not found.")
  }
  logExit("Skills", "getContent", { identifier: bundle.id, contentLength: mainFile.content.length })
  return mainFile.content
}

export function updateSkillFiles(input: {
  id: string
  upsert?: SkillFileInput[]
  remove?: string[]
}): SkillBundle {
  logEntry("Skills", "updateFiles", {
    id: input.id,
    upsert: input.upsert?.length ?? 0,
    remove: input.remove?.length ?? 0
  })
  const record = resolveSkillRecord(input.id)
  if (!record.capabilities.canEdit) {
    throw new Error("Skill is not editable.")
  }

  const upsert = (input.upsert ?? []).map((file) => ({
    path: normalizeRelativeSkillFilePath(file.path),
    content: file.content
  }))
  const remove = (input.remove ?? []).map((path) => normalizeRelativeSkillFilePath(path))
  if (remove.some((path) => path.toLowerCase() === "skill.md")) {
    throw new Error("SKILL.md cannot be removed.")
  }

  const currentDescription = readSkillDescription(record.skillPath) || record.description
  for (const file of upsert) {
    writeSkillFile(record.root, file, record.name, currentDescription)
  }

  for (const relativePath of remove) {
    const { absolutePath } = resolveSkillFilePath(record.root, relativePath)
    if (!existsSync(absolutePath)) {
      continue
    }
    const stats = lstatSync(absolutePath)
    if (stats.isDirectory()) {
      throw new Error("Removing directories is not supported.")
    }
    unlinkSync(absolutePath)
    pruneEmptyDirectories(record.root, absolutePath)
  }

  const bundle = buildSkillBundle(resolveSkillRecord(record.id))
  logExit("Skills", "updateFiles", { id: bundle.id, files: bundle.files.length })
  return bundle
}

export function saveSkillContent(name: string, content: string): SkillItem {
  logEntry("Skills", "saveContent", { name, contentLength: content.length })
  const bundle = updateSkillFiles({
    id: name,
    upsert: [{ path: SKILL_MAIN_FILE, content }],
    remove: []
  })
  const record = resolveSkillRecord(bundle.id)
  logExit("Skills", "saveContent", { name: record.name })
  return toSkillItem(record)
}

export function updateSkillEnabled(
  identifier: string,
  enabled: boolean,
  scope?: CapabilityScope
): SkillItem {
  logEntry("Skills", "setEnabled", { identifier, enabled, scope: scope ?? "all" })
  const record = resolveSkillRecord(identifier)
  setSkillEnabled(record.name, enabled, scope)
  const updated = resolveSkillRecord(record.id)
  logExit("Skills", "setEnabled", {
    identifier: updated.id,
    enabledClassic: updated.enabledClassic,
    enabledButler: updated.enabledButler
  })
  return toSkillItem(updated)
}
