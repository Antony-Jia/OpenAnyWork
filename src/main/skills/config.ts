import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { getOpenworkDir } from "../storage"
import type { CapabilityScope } from "../types"

const SKILLS_CONFIG_FILE = join(getOpenworkDir(), "skills.json")

interface SkillsConfigStore {
  [skillName: string]: {
    enabledClassic?: boolean
    enabledButler?: boolean
    enabled?: boolean
  }
}

function readSkillsConfig(): SkillsConfigStore {
  if (!existsSync(SKILLS_CONFIG_FILE)) {
    return {}
  }

  try {
    const raw = readFileSync(SKILLS_CONFIG_FILE, "utf-8")
    const parsed = JSON.parse(raw) as SkillsConfigStore
    return typeof parsed === "object" && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function writeSkillsConfig(config: SkillsConfigStore): void {
  const data = JSON.stringify(config, null, 2)
  writeFileSync(SKILLS_CONFIG_FILE, data)
}

export function getSkillEnabledState(skillName: string): { classic: boolean; butler: boolean } {
  const config = readSkillsConfig()
  const entry = config[skillName]
  const classic = entry?.enabledClassic ?? entry?.enabled ?? true
  const butler = entry?.enabledButler ?? entry?.enabled ?? true
  return { classic, butler }
}

export function isSkillEnabled(skillName: string, scope: CapabilityScope = "classic"): boolean {
  const state = getSkillEnabledState(skillName)
  return scope === "butler" ? state.butler : state.classic
}

function pruneSkillConfig(config: SkillsConfigStore, skillName: string): void {
  const entry = config[skillName]
  if (!entry) return
  if (
    entry.enabled === undefined &&
    entry.enabledClassic === undefined &&
    entry.enabledButler === undefined
  ) {
    delete config[skillName]
  }
}

export function setSkillEnabled(
  skillName: string,
  enabled: boolean,
  scope?: CapabilityScope
): void {
  const config = readSkillsConfig()
  const existing = config[skillName] ?? {}

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

  config[skillName] = existing
  pruneSkillConfig(config, skillName)
  writeSkillsConfig(config)
}

export function removeSkillConfig(skillName: string): void {
  const config = readSkillsConfig()
  if (config[skillName]) {
    delete config[skillName]
    writeSkillsConfig(config)
  }
}
