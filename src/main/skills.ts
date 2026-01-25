import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { basename, join, resolve } from "node:path"
import { listSkills } from "deepagents"
import type { SkillItem } from "./types"

const SKILLS_ROOT = join(process.cwd(), ".openwork", "skills")

function ensureSkillsDir(): string {
  if (!existsSync(SKILLS_ROOT)) {
    mkdirSync(SKILLS_ROOT, { recursive: true })
  }
  return SKILLS_ROOT
}

function normalizeSkillPath(path: string): string {
  return resolve(path).replace(/\\/g, "/")
}

export function getSkillsRoot(): string {
  return ensureSkillsDir()
}

export function listAppSkills(): SkillItem[] {
  const root = ensureSkillsDir()
  const skills = listSkills({ userSkillsDir: root })
  return skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    path: normalizeSkillPath(skill.path),
    source: skill.source
  }))
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
  const root = ensureSkillsDir()
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

  return {
    name,
    description,
    path: normalizeSkillPath(skillPath),
    source: "user"
  }
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
  const root = ensureSkillsDir()
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

  return {
    name: skillName,
    description,
    path: normalizeSkillPath(skillPath),
    source: "user"
  }
}

function readSkillDescription(skillPath: string): string {
  try {
    const content = readFileSync(skillPath, "utf-8")
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
    if (!match) return ""
    const frontmatter = match[1]
    const descMatch = frontmatter.match(/^description:\s*(.*)$/m)
    return descMatch ? descMatch[1].trim() : ""
  } catch {
    return ""
  }
}

export function deleteSkill(name: string): void {
  const root = ensureSkillsDir()
  const skillDir = join(root, name)
  if (!existsSync(skillDir)) return
  rmSync(skillDir, { recursive: true, force: true })
}

export function getSkillContent(name: string): string {
  const root = ensureSkillsDir()
  const skillPath = join(root, name, "SKILL.md")
  if (!existsSync(skillPath)) {
    throw new Error("Skill not found.")
  }
  return readFileSync(skillPath, "utf-8")
}

export function saveSkillContent(name: string, content: string): SkillItem {
  const root = ensureSkillsDir()
  const skillPath = join(root, name, "SKILL.md")
  if (!existsSync(skillPath)) {
    throw new Error("Skill not found.")
  }
  writeFileSync(skillPath, content)
  const description = readSkillDescription(skillPath)
  return {
    name,
    description,
    path: normalizeSkillPath(skillPath),
    source: "user"
  }
}
