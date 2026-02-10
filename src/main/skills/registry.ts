import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { listSkills } from "deepagents"
import { getOpenworkDir } from "../storage"

const SKILLS_REGISTRY_FILE = join(getOpenworkDir(), "skills-registry.json")

export interface SkillsRegistryEntry {
  skillPath: string
  sourceRoot: string
}

export interface SkillsRegistryStore {
  sourceRoots: string[]
  skills: Record<string, SkillsRegistryEntry>
}

export interface SkillsRegistryRebuildResult {
  registry: SkillsRegistryStore
  added: number
  updated: number
  removed: number
  scannedRoots: number
  discoveredSkills: number
}

interface RawSkillsRegistryStore {
  sourceRoots?: unknown
  skills?: unknown
}

function normalizePath(path: string): string {
  return resolve(path).replace(/\\/g, "/")
}

function pathKey(path: string): string {
  const normalized = normalizePath(path)
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

function dedupeSourceRoots(sourceRoots: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const root of sourceRoots) {
    const trimmed = root.trim()
    if (!trimmed) continue
    const resolved = normalizePath(trimmed)
    const key = pathKey(resolved)
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(resolved)
  }
  return normalized
}

function normalizeSkillEntry(
  sourceRoots: string[],
  skillName: string,
  value: unknown
): SkillsRegistryEntry | null {
  if (!skillName.trim() || typeof value !== "object" || !value) {
    return null
  }
  const entry = value as { skillPath?: unknown; sourceRoot?: unknown }
  if (typeof entry.skillPath !== "string" || !entry.skillPath.trim()) {
    return null
  }
  const skillPath = normalizePath(entry.skillPath)
  const derivedRoot = normalizePath(resolve(dirname(skillPath), ".."))
  const sourceRoot =
    typeof entry.sourceRoot === "string" && entry.sourceRoot.trim()
      ? normalizePath(entry.sourceRoot)
      : (dedupeSourceRoots([derivedRoot, ...sourceRoots]).find((root) => existsSync(root)) ??
        derivedRoot)
  return {
    skillPath,
    sourceRoot
  }
}

function normalizeRegistryStore(raw: RawSkillsRegistryStore): SkillsRegistryStore {
  const sourceRoots = Array.isArray(raw.sourceRoots)
    ? dedupeSourceRoots(raw.sourceRoots.filter((item): item is string => typeof item === "string"))
    : []

  const skills: Record<string, SkillsRegistryEntry> = {}
  if (raw.skills && typeof raw.skills === "object") {
    for (const [name, value] of Object.entries(raw.skills)) {
      const entry = normalizeSkillEntry(sourceRoots, name, value)
      if (!entry) continue
      skills[name] = entry
    }
  }

  return {
    sourceRoots,
    skills
  }
}

function sortSkillsByName(
  skills: Record<string, SkillsRegistryEntry>
): Record<string, SkillsRegistryEntry> {
  return Object.fromEntries(Object.entries(skills).sort(([a], [b]) => a.localeCompare(b)))
}

export function readSkillsRegistry(): SkillsRegistryStore {
  if (!existsSync(SKILLS_REGISTRY_FILE)) {
    return {
      sourceRoots: [],
      skills: {}
    }
  }

  try {
    const raw = readFileSync(SKILLS_REGISTRY_FILE, "utf-8")
    const parsed = JSON.parse(raw) as RawSkillsRegistryStore
    return normalizeRegistryStore(parsed)
  } catch {
    return {
      sourceRoots: [],
      skills: {}
    }
  }
}

export function writeSkillsRegistry(registry: SkillsRegistryStore): SkillsRegistryStore {
  const normalized: SkillsRegistryStore = {
    sourceRoots: dedupeSourceRoots(registry.sourceRoots),
    skills: sortSkillsByName(registry.skills)
  }
  writeFileSync(SKILLS_REGISTRY_FILE, `${JSON.stringify(normalized, null, 2)}\n`)
  return normalized
}

export function registerSkillSourceRoot(sourceRoot: string): SkillsRegistryStore {
  const normalizedRoot = normalizePath(sourceRoot)
  const current = readSkillsRegistry()
  const nextRoots = current.sourceRoots.filter((root) => pathKey(root) !== pathKey(normalizedRoot))
  nextRoots.push(normalizedRoot)
  return writeSkillsRegistry({
    sourceRoots: nextRoots,
    skills: current.skills
  })
}

export function rebuildSkillsRegistry(): SkillsRegistryRebuildResult {
  const current = readSkillsRegistry()
  const sourceRoots = dedupeSourceRoots(current.sourceRoots)
  const nextSkills: Record<string, SkillsRegistryEntry> = {}
  let discoveredSkills = 0

  for (const sourceRoot of sourceRoots) {
    const discovered = listSkills({ userSkillsDir: sourceRoot })
    discoveredSkills += discovered.length
    for (const skill of discovered) {
      if (!skill?.name || !skill?.path) continue
      nextSkills[skill.name] = {
        skillPath: normalizePath(skill.path),
        sourceRoot
      }
    }
  }

  let added = 0
  let updated = 0
  let removed = 0

  for (const [name, entry] of Object.entries(nextSkills)) {
    const previous = current.skills[name]
    if (!previous) {
      added += 1
      continue
    }
    if (
      pathKey(previous.skillPath) !== pathKey(entry.skillPath) ||
      pathKey(previous.sourceRoot) !== pathKey(entry.sourceRoot)
    ) {
      updated += 1
    }
  }

  for (const name of Object.keys(current.skills)) {
    if (!nextSkills[name]) {
      removed += 1
    }
  }

  const registry = writeSkillsRegistry({
    sourceRoots,
    skills: nextSkills
  })

  return {
    registry,
    added,
    updated,
    removed,
    scannedRoots: sourceRoots.length,
    discoveredSkills
  }
}
