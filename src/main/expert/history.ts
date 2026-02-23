import { randomUUID } from "node:crypto"
import { getDb, markDbDirty } from "../db"
import { normalizeExpertConfigInput } from "./config"
import type {
  ExpertHistoryCreateInput,
  ExpertHistoryItem,
  ExpertHistoryKind,
  ExpertHistorySinglePayload
} from "../types"

const MAX_HISTORY_NAME_LENGTH = 120

interface ExpertHistoryRow {
  id: string
  name: string
  kind: string
  payload: string
  created_at: number
  updated_at: number
}

function normalizeHistoryId(id: string): string {
  const normalized = id.trim()
  if (!normalized) {
    throw new Error("Expert history id is required.")
  }
  return normalized
}

function normalizeHistoryName(name: string): string {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error("Expert history name is required.")
  }
  if (normalized.length > MAX_HISTORY_NAME_LENGTH) {
    throw new Error("Expert history name is too long.")
  }
  return normalized
}

function readRows<T>(query: string, params: Array<string | number> = []): T[] {
  const statement = getDb().prepare(query)
  if (params.length > 0) {
    statement.bind(params)
  }

  const rows: T[] = []
  while (statement.step()) {
    rows.push(statement.getAsObject() as unknown as T)
  }
  statement.free()
  return rows
}

function parseSinglePayload(payload: unknown): ExpertHistorySinglePayload {
  const source = payload && typeof payload === "object" ? payload : {}
  const role = typeof (source as { role?: unknown }).role === "string"
    ? (source as { role: string }).role.trim()
    : ""
  const prompt = typeof (source as { prompt?: unknown }).prompt === "string"
    ? (source as { prompt: string }).prompt.trim()
    : ""

  if (!role || !prompt) {
    throw new Error("Expert single history payload requires role and prompt.")
  }

  return { role, prompt }
}

function toHistoryItem(row: ExpertHistoryRow): ExpertHistoryItem {
  const kind = row.kind as ExpertHistoryKind
  const base = {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }

  const payloadJson = JSON.parse(row.payload) as unknown
  if (kind === "bundle") {
    const source = payloadJson && typeof payloadJson === "object" ? payloadJson : {}
    const config = normalizeExpertConfigInput((source as { config?: unknown }).config)
    return {
      ...base,
      kind: "bundle",
      payload: { config }
    }
  }

  if (kind === "single") {
    return {
      ...base,
      kind: "single",
      payload: parseSinglePayload(payloadJson)
    }
  }

  throw new Error(`Unsupported expert history kind: ${row.kind}`)
}

export function listExpertHistory(): ExpertHistoryItem[] {
  const rows = readRows<ExpertHistoryRow>(
    `SELECT id, name, kind, payload, created_at, updated_at
     FROM expert_history
     ORDER BY updated_at DESC`
  )

  const items: ExpertHistoryItem[] = []
  for (const row of rows) {
    try {
      items.push(toHistoryItem(row))
    } catch (error) {
      console.warn("[ExpertHistory] Skipping invalid record:", row.id, error)
    }
  }

  return items
}

export function createExpertHistory(input: ExpertHistoryCreateInput): ExpertHistoryItem {
  const name = normalizeHistoryName(input.name)
  const id = randomUUID()
  const now = Date.now()

  let kind: ExpertHistoryKind
  let payload: string

  if (input.kind === "bundle") {
    kind = "bundle"
    payload = JSON.stringify({
      config: normalizeExpertConfigInput(input.payload?.config)
    })
  } else {
    kind = "single"
    payload = JSON.stringify(parseSinglePayload(input.payload))
  }

  getDb().run(
    `INSERT INTO expert_history (id, name, kind, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, kind, payload, now, now]
  )
  markDbDirty()

  return toHistoryItem({
    id,
    name,
    kind,
    payload,
    created_at: now,
    updated_at: now
  })
}

export function deleteExpertHistory(id: string): void {
  const normalizedId = normalizeHistoryId(id)
  getDb().run("DELETE FROM expert_history WHERE id = ?", [normalizedId])
  markDbDirty()
}
