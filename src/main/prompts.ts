import { randomUUID } from "node:crypto"
import { getDb, markDbDirty } from "./db"
import type { PromptCreateInput, PromptTemplate, PromptUpdateInput } from "./types"

interface PromptTemplateRow {
  id: string
  name: string
  content: string
  created_at: number
  updated_at: number
}

function normalizeId(id: string): string {
  const normalized = id.trim()
  if (!normalized) {
    throw new Error("Prompt id is required.")
  }
  return normalized
}

function normalizeName(name: string): string {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error("Prompt name is required.")
  }
  if (normalized.length > 200) {
    throw new Error("Prompt name is too long.")
  }
  return normalized
}

function normalizeContent(content: string): string {
  const normalized = content.trim()
  if (!normalized) {
    throw new Error("Prompt content is required.")
  }
  return normalized
}

function toPromptTemplate(row: PromptTemplateRow): PromptTemplate {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }
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

function readSingleRow<T>(query: string, params: Array<string | number> = []): T | null {
  const rows = readRows<T>(query, params)
  return rows.length > 0 ? rows[0] : null
}

function mapConstraintError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("UNIQUE constraint failed") && message.includes("prompt_templates.name")) {
    throw new Error("Prompt name already exists.")
  }
  throw error instanceof Error ? error : new Error(message)
}

export function listPromptTemplates(query?: string): PromptTemplate[] {
  const trimmed = query?.trim() ?? ""
  const rows =
    trimmed.length === 0
      ? readRows<PromptTemplateRow>(
          "SELECT id, name, content, created_at, updated_at FROM prompt_templates ORDER BY updated_at DESC"
        )
      : readRows<PromptTemplateRow>(
          `SELECT id, name, content, created_at, updated_at
           FROM prompt_templates
           WHERE name LIKE ? OR content LIKE ?
           ORDER BY updated_at DESC`,
          [`%${trimmed}%`, `%${trimmed}%`]
        )

  return rows.map(toPromptTemplate)
}

export function getPromptTemplate(id: string): PromptTemplate | null {
  const normalizedId = normalizeId(id)
  const row = readSingleRow<PromptTemplateRow>(
    "SELECT id, name, content, created_at, updated_at FROM prompt_templates WHERE id = ? LIMIT 1",
    [normalizedId]
  )

  if (!row) return null
  return toPromptTemplate(row)
}

export function createPromptTemplate(input: PromptCreateInput): PromptTemplate {
  const now = Date.now()
  const next: PromptTemplate = {
    id: randomUUID(),
    name: normalizeName(input.name),
    content: normalizeContent(input.content),
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  }

  try {
    getDb().run(
      `INSERT INTO prompt_templates (id, name, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [next.id, next.name, next.content, now, now]
    )
  } catch (error) {
    mapConstraintError(error)
  }

  markDbDirty()
  return next
}

export function updatePromptTemplate(id: string, updates: PromptUpdateInput): PromptTemplate {
  const normalizedId = normalizeId(id)
  const existing = getPromptTemplate(normalizedId)
  if (!existing) {
    throw new Error("Prompt not found.")
  }

  const hasName = updates.name !== undefined
  const hasContent = updates.content !== undefined
  if (!hasName && !hasContent) {
    return existing
  }

  const nextName = hasName ? normalizeName(updates.name ?? "") : existing.name
  const nextContent = hasContent ? normalizeContent(updates.content ?? "") : existing.content
  const now = Date.now()

  try {
    getDb().run(
      `UPDATE prompt_templates
       SET name = ?, content = ?, updated_at = ?
       WHERE id = ?`,
      [nextName, nextContent, now, normalizedId]
    )
  } catch (error) {
    mapConstraintError(error)
  }

  markDbDirty()

  return {
    id: existing.id,
    name: nextName,
    content: nextContent,
    createdAt: existing.createdAt,
    updatedAt: new Date(now).toISOString()
  }
}

export function deletePromptTemplate(id: string): void {
  const normalizedId = normalizeId(id)
  getDb().run("DELETE FROM prompt_templates WHERE id = ?", [normalizedId])
  markDbDirty()
}
