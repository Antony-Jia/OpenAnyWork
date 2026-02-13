import { randomUUID } from "node:crypto"
import { closeCheckpointer } from "../agent/runtime"
import { deleteThreadCheckpoint } from "../storage"
import type {
  ExpertAgentConfig,
  ExpertAgentConfigInput,
  ExpertConfig,
  ExpertConfigInput
} from "../types"

const DEFAULT_MAX_CYCLES = 5
const MIN_MAX_CYCLES = 1
const MAX_MAX_CYCLES = 20

function clampCycles(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_CYCLES
  return Math.max(MIN_MAX_CYCLES, Math.min(MAX_MAX_CYCLES, Math.floor(parsed)))
}

function normalizeAgentInput(input: ExpertAgentConfigInput): ExpertAgentConfigInput {
  return {
    id: typeof input.id === "string" ? input.id.trim() : undefined,
    role: typeof input.role === "string" ? input.role.trim() : "",
    prompt: typeof input.prompt === "string" ? input.prompt.trim() : "",
    agentThreadId: typeof input.agentThreadId === "string" ? input.agentThreadId.trim() : undefined
  }
}

function normalizeAgentsInput(input: unknown): ExpertAgentConfigInput[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null
      return normalizeAgentInput(item as ExpertAgentConfigInput)
    })
    .filter((item): item is ExpertAgentConfigInput => !!item)
    .filter((item) => item.role.length > 0 && item.prompt.length > 0)
}

export function normalizeExpertConfigInput(input: unknown): ExpertConfig {
  const source = (input && typeof input === "object" ? input : {}) as Partial<ExpertConfigInput>
  const experts = normalizeAgentsInput(source.experts).map((item) => ({
    id: item.id || randomUUID(),
    role: item.role,
    prompt: item.prompt,
    agentThreadId: item.agentThreadId || randomUUID()
  }))

  if (experts.length === 0) {
    throw new Error("Expert mode requires at least one expert with role and prompt.")
  }

  return {
    experts,
    loop: {
      enabled: source.loop?.enabled === true,
      maxCycles: clampCycles(source.loop?.maxCycles)
    }
  }
}

export function normalizeStoredExpertConfig(input: unknown): ExpertConfig | null {
  try {
    return normalizeExpertConfigInput(input)
  } catch {
    return null
  }
}

function buildExistingById(existing: ExpertConfig | null): Map<string, ExpertAgentConfig> {
  const map = new Map<string, ExpertAgentConfig>()
  if (!existing) return map
  for (const expert of existing.experts) {
    if (!expert?.id) continue
    map.set(expert.id, expert)
  }
  return map
}

function sanitizeAgentThreadId(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function mergeExpertConfig(params: { existing: ExpertConfig | null; nextInput: unknown }): {
  config: ExpertConfig
  resetAgentThreadIds: string[]
  removedAgentThreadIds: string[]
} {
  const normalized = normalizeExpertConfigInput(params.nextInput)
  const existingById = buildExistingById(params.existing)
  const resetAgentThreadIds: string[] = []
  const nextExperts: ExpertAgentConfig[] = []
  const seenIds = new Set<string>()

  for (const inputExpert of normalized.experts) {
    const id = inputExpert.id || randomUUID()
    const existing = existingById.get(id)
    let agentThreadId = inputExpert.agentThreadId || randomUUID()

    if (existing) {
      const roleChanged = existing.role.trim() !== inputExpert.role.trim()
      const promptChanged = existing.prompt.trim() !== inputExpert.prompt.trim()
      if (roleChanged || promptChanged) {
        const oldId = sanitizeAgentThreadId(existing.agentThreadId)
        if (oldId) {
          resetAgentThreadIds.push(oldId)
        }
        agentThreadId = randomUUID()
      } else {
        agentThreadId = existing.agentThreadId || inputExpert.agentThreadId || randomUUID()
      }
    }

    seenIds.add(id)
    nextExperts.push({
      id,
      role: inputExpert.role,
      prompt: inputExpert.prompt,
      agentThreadId
    })
  }

  const removedAgentThreadIds: string[] = []
  for (const existing of existingById.values()) {
    if (seenIds.has(existing.id)) continue
    const oldId = sanitizeAgentThreadId(existing.agentThreadId)
    if (oldId) {
      removedAgentThreadIds.push(oldId)
    }
  }

  return {
    config: {
      experts: nextExperts,
      loop: normalized.loop
    },
    resetAgentThreadIds: Array.from(new Set(resetAgentThreadIds)),
    removedAgentThreadIds: Array.from(new Set(removedAgentThreadIds))
  }
}

export async function cleanupExpertAgentContexts(agentThreadIds: string[]): Promise<void> {
  const unique = Array.from(
    new Set(agentThreadIds.map((item) => item.trim()).filter((item) => item.length > 0))
  )

  for (const agentThreadId of unique) {
    try {
      await closeCheckpointer(agentThreadId)
    } catch (error) {
      console.warn("[ExpertConfig] Failed to close checkpointer:", agentThreadId, error)
    }
    try {
      deleteThreadCheckpoint(agentThreadId)
    } catch (error) {
      console.warn("[ExpertConfig] Failed to delete checkpoint:", agentThreadId, error)
    }
  }
}
