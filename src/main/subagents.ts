import { randomUUID } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { SubagentConfig } from "./types"
import { getOpenworkDir } from "./storage"

const SUBAGENTS_FILE = join(getOpenworkDir(), "subagents.json")

function readSubagentsFile(): SubagentConfig[] {
  if (!existsSync(SUBAGENTS_FILE)) {
    return []
  }
  try {
    const raw = readFileSync(SUBAGENTS_FILE, "utf-8")
    const parsed = JSON.parse(raw) as SubagentConfig[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSubagentsFile(subagents: SubagentConfig[]): void {
  const data = JSON.stringify(subagents, null, 2)
  writeFileSync(SUBAGENTS_FILE, data)
}

export function listSubagents(): SubagentConfig[] {
  return readSubagentsFile()
}

export function createSubagent(input: Omit<SubagentConfig, "id">): SubagentConfig {
  if (!input.name?.trim()) {
    throw new Error("Subagent name is required.")
  }
  if (!input.description?.trim()) {
    throw new Error("Subagent description is required.")
  }
  if (!input.systemPrompt?.trim()) {
    throw new Error("Subagent system prompt is required.")
  }

  const subagents = readSubagentsFile()
  const nameExists = subagents.some(
    (agent) => agent.name.toLowerCase() === input.name.toLowerCase()
  )
  if (nameExists) {
    throw new Error(`Subagent name "${input.name}" already exists.`)
  }

  const created: SubagentConfig = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    systemPrompt: input.systemPrompt.trim(),
    model: input.model,
    tools: input.tools,
    middleware: input.middleware,
    interruptOn: input.interruptOn ?? false
  }

  writeSubagentsFile([...subagents, created])
  return created
}

export function updateSubagent(
  id: string,
  updates: Partial<Omit<SubagentConfig, "id">>
): SubagentConfig {
  const subagents = readSubagentsFile()
  const index = subagents.findIndex((agent) => agent.id === id)
  if (index < 0) {
    throw new Error("Subagent not found.")
  }

  const nextName = updates.name?.trim()
  if (nextName) {
    const nameExists = subagents.some(
      (agent) => agent.id !== id && agent.name.toLowerCase() === nextName.toLowerCase()
    )
    if (nameExists) {
      throw new Error(`Subagent name "${nextName}" already exists.`)
    }
  }

  const current = subagents[index]
  const updated: SubagentConfig = {
    ...current,
    ...updates,
    name: nextName ?? current.name,
    description: updates.description?.trim() ?? current.description,
    systemPrompt: updates.systemPrompt?.trim() ?? current.systemPrompt
  }

  subagents[index] = updated
  writeSubagentsFile(subagents)
  return updated
}

export function deleteSubagent(id: string): void {
  const subagents = readSubagentsFile()
  const next = subagents.filter((agent) => agent.id !== id)
  writeSubagentsFile(next)
}
