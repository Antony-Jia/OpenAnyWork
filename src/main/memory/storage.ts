import initSqlJs, { Database as SqlJsDatabase } from "sql.js"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { dirname } from "path"
import { randomUUID } from "crypto"
import { getMemoryDbPath } from "../storage"
import type { ButlerTask, MemoryEntityType, MemoryRangePreset, ThreadMode } from "../types"
import type {
  ButlerMessageInput,
  ButlerMessageRow,
  ButlerTaskRow,
  DailyProfileInput,
  DailyProfileRow,
  MemoryEntityRow,
  MemoryEntityUpsertInput,
  MemoryEventInput,
  MemoryEventRow,
  MemoryRangeSummaryInput,
  MemoryRangeSummaryRow,
  MemoryTaskSummaryInput,
  MemoryTaskSummaryRow,
  WorkingMemorySnapshotInput,
  WorkingMemorySnapshotRow
} from "./types"

let db: SqlJsDatabase | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false

function scheduleSave(): void {
  if (!db) return
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!db || !dirty) return
    writeFileSync(getMemoryDbPath(), Buffer.from(db.export()))
    dirty = false
  }, 100)
}

export async function flushMemoryDatabase(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!db || !dirty) return
  writeFileSync(getMemoryDbPath(), Buffer.from(db.export()))
  dirty = false
}

function getMemoryDb(): SqlJsDatabase {
  if (!db) throw new Error("Memory database not initialized.")
  return db
}

function readRows<T>(query: string, params: Array<string | number | null> = []): T[] {
  const statement = getMemoryDb().prepare(query)
  if (params.length > 0) statement.bind(params)
  const rows: T[] = []
  while (statement.step()) rows.push(statement.getAsObject() as unknown as T)
  statement.free()
  return rows
}

function readSingleRow<T>(query: string, params: Array<string | number | null> = []): T | null {
  return readRows<T>(query, params)[0] ?? null
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function normalizeMode(mode: string): ThreadMode {
  return mode === "ralph" || mode === "email" || mode === "loop" || mode === "expert" || mode === "butler"
    ? mode
    : "default"
}

function columnExists(table: string, column: string): boolean {
  return readRows<{ name?: string }>(`PRAGMA table_info(${table})`).some((row) => row.name === column)
}

function ensureColumn(table: string, column: string, definition: string): void {
  if (!columnExists(table, column)) getMemoryDb().run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function mapTaskSummaryRow(row: {
  id: string
  thread_id: string
  mode: string
  title?: string | null
  summary_brief: string
  summary_detail: string
  task_direction?: string | null
  usage_habits?: string | null
  hobbies?: string | null
  research_process?: string | null
  report_preference?: string | null
  created_at: string
}): MemoryTaskSummaryRow {
  return {
    id: row.id,
    threadId: row.thread_id,
    mode: normalizeMode(row.mode),
    title: row.title ?? undefined,
    summaryBrief: row.summary_brief,
    summaryDetail: row.summary_detail,
    taskDirection: row.task_direction ?? undefined,
    usageHabits: row.usage_habits ?? undefined,
    hobbies: row.hobbies ?? undefined,
    researchProcess: row.research_process ?? undefined,
    reportPreference: row.report_preference ?? undefined,
    createdAt: row.created_at
  }
}

function mapMemoryEventRow(row: {
  id: string
  source_type: MemoryEventRow["sourceType"]
  source_id: string
  occurred_at: string
  day: string
  category: string
  title: string
  summary: string
  detail: string
  thread_id?: string | null
  task_id?: string | null
  keywords_json: string
  metadata_json?: string | null
}): MemoryEventRow {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    occurredAt: row.occurred_at,
    day: row.day,
    category: row.category,
    title: row.title,
    summary: row.summary,
    detail: row.detail,
    threadId: row.thread_id ?? undefined,
    taskId: row.task_id ?? undefined,
    keywords: parseJsonArray(row.keywords_json),
    metadata: parseJsonObject(row.metadata_json)
  }
}

function mapMemoryEntityRow(row: {
  id: string
  type: MemoryEntityType
  name: string
  value: string
  confidence: number
  first_seen_at: string
  last_seen_at: string
  evidence_count: number
  source_refs_json: string
  metadata_json?: string | null
}): MemoryEntityRow {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    value: row.value,
    confidence: Number(row.confidence) || 0,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    evidenceCount: Number(row.evidence_count) || 0,
    sourceRefs: parseJsonArray(row.source_refs_json),
    metadata: parseJsonObject(row.metadata_json)
  }
}

function mapRangeSummaryRow(row: {
  id: string
  range_key: string
  from_ts: string
  to_ts: string
  preset?: MemoryRangePreset | null
  categories_json: string
  summary_text: string
  highlights_json: string
  event_count: number
  generated_at: string
}): MemoryRangeSummaryRow {
  return {
    id: row.id,
    rangeKey: row.range_key,
    from: row.from_ts,
    to: row.to_ts,
    preset: row.preset ?? undefined,
    categories: parseJsonArray(row.categories_json),
    summaryText: row.summary_text,
    highlights: parseJsonArray(row.highlights_json),
    eventCount: Number(row.event_count) || 0,
    generatedAt: row.generated_at
  }
}

function mapWorkingRow(row: {
  id: string
  updated_at: string
  budget_chars: number
  recent_overview: string
  last_24h_messages: string
  habits: string
  preferences: string
  facts: string
  open_loops: string
  tooling_learnings: string
  recent_task_outcomes: string
  text_blob: string
}): WorkingMemorySnapshotRow {
  return {
    id: row.id,
    updatedAt: row.updated_at,
    budgetChars: Number(row.budget_chars) || 0,
    recentOverview: row.recent_overview,
    last24hMessages: row.last_24h_messages,
    habits: row.habits,
    preferences: row.preferences,
    facts: row.facts,
    openLoops: row.open_loops,
    toolingLearnings: row.tooling_learnings,
    recentTaskOutcomes: row.recent_task_outcomes,
    text: row.text_blob
  }
}

export async function initializeMemoryDatabase(): Promise<void> {
  if (db) return
  const SQL = await initSqlJs()
  const dbPath = getMemoryDbPath()
  if (existsSync(dbPath)) {
    db = new SQL.Database(readFileSync(dbPath))
  } else {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    db = new SQL.Database()
  }

  const database = getMemoryDb()
  database.run(`CREATE TABLE IF NOT EXISTS memory_task_summaries (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, mode TEXT NOT NULL, title TEXT, summary_brief TEXT NOT NULL, summary_detail TEXT NOT NULL, task_direction TEXT, usage_habits TEXT, hobbies TEXT, research_process TEXT, report_preference TEXT, created_at TEXT NOT NULL)`)
  database.run(`CREATE TABLE IF NOT EXISTS memory_daily_profiles (day TEXT PRIMARY KEY, profile_text TEXT NOT NULL, comparison_text TEXT NOT NULL, previous_profile_day TEXT, created_at TEXT NOT NULL)`)
  database.run(`CREATE TABLE IF NOT EXISTS memory_runs (run_key TEXT PRIMARY KEY, run_value TEXT, created_at TEXT NOT NULL)`)
  database.run(`CREATE TABLE IF NOT EXISTS butler_messages (id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL, ts TEXT NOT NULL)`)
  ensureColumn("butler_messages", "kind", "TEXT")
  ensureColumn("butler_messages", "source_type", "TEXT")
  ensureColumn("butler_messages", "related_thread_id", "TEXT")
  ensureColumn("butler_messages", "related_task_id", "TEXT")
  ensureColumn("butler_messages", "notice_type", "TEXT")
  ensureColumn("butler_messages", "metadata_json", "TEXT")
  database.run(`CREATE TABLE IF NOT EXISTS butler_tasks (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  database.run(`CREATE TABLE IF NOT EXISTS working_memory_snapshots (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, budget_chars INTEGER NOT NULL, recent_overview TEXT NOT NULL, last_24h_messages TEXT NOT NULL, habits TEXT NOT NULL, preferences TEXT NOT NULL, facts TEXT NOT NULL, open_loops TEXT NOT NULL, tooling_learnings TEXT NOT NULL, recent_task_outcomes TEXT NOT NULL, text_blob TEXT NOT NULL)`)
  database.run(`CREATE TABLE IF NOT EXISTS memory_events (id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL, thread_id TEXT, task_id TEXT, category TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, detail TEXT NOT NULL, keywords_json TEXT NOT NULL, metadata_json TEXT, occurred_at TEXT NOT NULL, day TEXT NOT NULL, created_at TEXT NOT NULL)`)
  database.run(`CREATE TABLE IF NOT EXISTS memory_entities (id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, confidence REAL NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, evidence_count INTEGER NOT NULL, source_refs_json TEXT NOT NULL, metadata_json TEXT)`)
  database.run(`CREATE TABLE IF NOT EXISTS memory_range_summaries (id TEXT PRIMARY KEY, range_key TEXT NOT NULL, from_ts TEXT NOT NULL, to_ts TEXT NOT NULL, preset TEXT, categories_json TEXT NOT NULL, summary_text TEXT NOT NULL, highlights_json TEXT NOT NULL, event_count INTEGER NOT NULL, generated_at TEXT NOT NULL)`)
  database.run("CREATE INDEX IF NOT EXISTS idx_memory_task_summaries_thread_id ON memory_task_summaries(thread_id)")
  database.run("CREATE INDEX IF NOT EXISTS idx_memory_task_summaries_created_at ON memory_task_summaries(created_at)")
  database.run("CREATE INDEX IF NOT EXISTS idx_butler_messages_ts ON butler_messages(ts)")
  database.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_events_source ON memory_events(source_type, source_id)")
  database.run("CREATE INDEX IF NOT EXISTS idx_memory_events_occurred_at ON memory_events(occurred_at DESC)")
  database.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_entities_type_value ON memory_entities(type, value)")
  database.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_range_summaries_key ON memory_range_summaries(range_key)")
  scheduleSave()
}

export function insertTaskSummary(input: MemoryTaskSummaryInput): MemoryTaskSummaryRow {
  const row: MemoryTaskSummaryRow = { id: randomUUID(), threadId: input.threadId, mode: input.mode, title: input.title, summaryBrief: input.summaryBrief, summaryDetail: input.summaryDetail, taskDirection: input.taskDirection, usageHabits: input.usageHabits, hobbies: input.hobbies, researchProcess: input.researchProcess, reportPreference: input.reportPreference, createdAt: input.createdAt ?? new Date().toISOString() }
  getMemoryDb().run(`INSERT INTO memory_task_summaries (id, thread_id, mode, title, summary_brief, summary_detail, task_direction, usage_habits, hobbies, research_process, report_preference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.id, row.threadId, row.mode, row.title ?? null, row.summaryBrief, row.summaryDetail, row.taskDirection ?? null, row.usageHabits ?? null, row.hobbies ?? null, row.researchProcess ?? null, row.reportPreference ?? null, row.createdAt])
  scheduleSave()
  return row
}

export function listTaskSummaries(limit = 200): MemoryTaskSummaryRow[] {
  return readRows<any>("SELECT * FROM memory_task_summaries ORDER BY created_at DESC LIMIT ?", [limit]).map(mapTaskSummaryRow)
}

export function deleteTaskSummariesByThread(threadId: string): void {
  getMemoryDb().run("DELETE FROM memory_task_summaries WHERE thread_id = ?", [threadId])
  scheduleSave()
}

export function clearAllTaskSummaries(): void {
  getMemoryDb().run("DELETE FROM memory_task_summaries")
  scheduleSave()
}

export function listTaskSummariesByThread(threadId: string): MemoryTaskSummaryRow[] {
  return readRows<any>("SELECT * FROM memory_task_summaries WHERE thread_id = ? ORDER BY created_at DESC", [threadId]).map(mapTaskSummaryRow)
}

export function searchTaskSummaries(query: string, limit = 20): MemoryTaskSummaryRow[] {
  const keyword = `%${query.trim()}%`
  return readRows<any>(`SELECT * FROM memory_task_summaries WHERE title LIKE ? OR summary_brief LIKE ? OR summary_detail LIKE ? ORDER BY created_at DESC LIMIT ?`, [keyword, keyword, keyword, limit]).map(mapTaskSummaryRow)
}

export function listTaskSummariesByDay(day: string): MemoryTaskSummaryRow[] {
  const begin = new Date(`${day}T00:00:00.000`).toISOString()
  const end = new Date(`${day}T23:59:59.999`).toISOString()
  return readRows<any>(`SELECT * FROM memory_task_summaries WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`, [begin, end]).map(mapTaskSummaryRow)
}

export function getDailyProfile(day: string): DailyProfileRow | null {
  const row = readSingleRow<any>("SELECT * FROM memory_daily_profiles WHERE day = ? LIMIT 1", [day])
  return row ? { day: row.day, profileText: row.profile_text, comparisonText: row.comparison_text, previousProfileDay: row.previous_profile_day ?? undefined, createdAt: row.created_at } : null
}

export function listDailyProfiles(limit = 60): DailyProfileRow[] {
  return readRows<any>("SELECT * FROM memory_daily_profiles ORDER BY day DESC LIMIT ?", [limit]).map((row) => ({ day: row.day, profileText: row.profile_text, comparisonText: row.comparison_text, previousProfileDay: row.previous_profile_day ?? undefined, createdAt: row.created_at }))
}

export function getPreviousDailyProfile(beforeDay: string): DailyProfileRow | null {
  const row = readSingleRow<any>("SELECT * FROM memory_daily_profiles WHERE day < ? ORDER BY day DESC LIMIT 1", [beforeDay])
  return row ? { day: row.day, profileText: row.profile_text, comparisonText: row.comparison_text, previousProfileDay: row.previous_profile_day ?? undefined, createdAt: row.created_at } : null
}

export function upsertDailyProfile(input: DailyProfileInput): DailyProfileRow {
  const row: DailyProfileRow = { day: input.day, profileText: input.profileText, comparisonText: input.comparisonText, previousProfileDay: input.previousProfileDay, createdAt: input.createdAt ?? new Date().toISOString() }
  getMemoryDb().run(`INSERT OR REPLACE INTO memory_daily_profiles (day, profile_text, comparison_text, previous_profile_day, created_at) VALUES (?, ?, ?, ?, ?)`, [row.day, row.profileText, row.comparisonText, row.previousProfileDay ?? null, row.createdAt])
  scheduleSave()
  return row
}

export function hasRunMarker(key: string): boolean {
  return !!readSingleRow("SELECT run_key FROM memory_runs WHERE run_key = ? LIMIT 1", [key])
}

export function setRunMarker(key: string, value = ""): void {
  getMemoryDb().run("INSERT OR REPLACE INTO memory_runs (run_key, run_value, created_at) VALUES (?, ?, ?)", [key, value, new Date().toISOString()])
  scheduleSave()
}

export function clearRunMarkers(): void {
  getMemoryDb().run("DELETE FROM memory_runs")
  scheduleSave()
}

export function appendButlerMessage(input: ButlerMessageInput): void {
  getMemoryDb().run(`INSERT OR REPLACE INTO butler_messages (id, role, content, ts, kind, source_type, related_thread_id, related_task_id, notice_type, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [input.id, input.role, input.content, input.ts, input.kind ?? null, input.sourceType ?? null, input.relatedThreadId ?? null, input.relatedTaskId ?? null, input.noticeType ?? null, input.metadata ? JSON.stringify(input.metadata) : null])
  scheduleSave()
}

export function listButlerMessages(): ButlerMessageRow[] {
  return readRows<any>(`SELECT id, role, content, ts, kind, source_type, related_thread_id, related_task_id, notice_type, metadata_json FROM butler_messages ORDER BY ts ASC`).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    ts: row.ts,
    kind: row.kind ?? undefined,
    sourceType: row.source_type ?? undefined,
    relatedThreadId: row.related_thread_id ?? undefined,
    relatedTaskId: row.related_task_id ?? undefined,
    noticeType: row.notice_type ?? undefined,
    metadata: parseJsonObject(row.metadata_json)
  }))
}

export function clearButlerMessages(): void {
  getMemoryDb().run("DELETE FROM butler_messages")
  scheduleSave()
}

export function upsertButlerTask(task: ButlerTask): void {
  getMemoryDb().run("INSERT OR REPLACE INTO butler_tasks (id, payload, updated_at) VALUES (?, ?, ?)", [task.id, JSON.stringify(task), new Date().toISOString()])
  scheduleSave()
}

export function listButlerTasks(): ButlerTaskRow[] {
  return readRows<{ id: string; payload: string }>("SELECT id, payload FROM butler_tasks ORDER BY updated_at DESC").flatMap((row) => {
    try {
      return [{ id: row.id, payload: JSON.parse(row.payload) as ButlerTask }]
    } catch {
      return []
    }
  })
}

export function deleteButlerTasksByIds(taskIds: string[]): void {
  if (taskIds.length === 0) return
  getMemoryDb().run(`DELETE FROM butler_tasks WHERE id IN (${taskIds.map(() => "?").join(", ")})`, taskIds)
  scheduleSave()
}

export function clearDailyProfiles(): void {
  getMemoryDb().run("DELETE FROM memory_daily_profiles")
  scheduleSave()
}

export function getWorkingMemorySnapshotRow(id = "default"): WorkingMemorySnapshotRow | null {
  const row = readSingleRow<any>("SELECT * FROM working_memory_snapshots WHERE id = ? LIMIT 1", [id])
  return row ? mapWorkingRow(row) : null
}

export function upsertWorkingMemorySnapshot(input: WorkingMemorySnapshotInput): WorkingMemorySnapshotRow {
  const row: WorkingMemorySnapshotRow = { id: input.id ?? "default", updatedAt: input.updatedAt ?? new Date().toISOString(), budgetChars: input.budgetChars, recentOverview: input.recentOverview, last24hMessages: input.last24hMessages, habits: input.habits, preferences: input.preferences, facts: input.facts, openLoops: input.openLoops, toolingLearnings: input.toolingLearnings, recentTaskOutcomes: input.recentTaskOutcomes, text: input.text }
  getMemoryDb().run(`INSERT OR REPLACE INTO working_memory_snapshots (id, updated_at, budget_chars, recent_overview, last_24h_messages, habits, preferences, facts, open_loops, tooling_learnings, recent_task_outcomes, text_blob) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.id, row.updatedAt, row.budgetChars, row.recentOverview, row.last24hMessages, row.habits, row.preferences, row.facts, row.openLoops, row.toolingLearnings, row.recentTaskOutcomes, row.text])
  scheduleSave()
  return row
}

export function clearWorkingMemorySnapshot(id = "default"): void {
  getMemoryDb().run("DELETE FROM working_memory_snapshots WHERE id = ?", [id])
  scheduleSave()
}

function toEventDay(occurredAt: string): string {
  return occurredAt.slice(0, 10)
}

export function insertMemoryEvent(input: MemoryEventInput): {
  row: MemoryEventRow
  inserted: boolean
} {
  const existing = readSingleRow<any>("SELECT * FROM memory_events WHERE source_type = ? AND source_id = ? LIMIT 1", [input.sourceType, input.sourceId])
  if (existing) {
    return { row: mapMemoryEventRow(existing), inserted: false }
  }
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const row: MemoryEventRow = { id: randomUUID(), sourceType: input.sourceType, sourceId: input.sourceId, occurredAt, day: toEventDay(occurredAt), category: input.category, title: input.title, summary: input.summary, detail: input.detail ?? input.summary, threadId: input.threadId, taskId: input.taskId, keywords: input.keywords ?? [], metadata: input.metadata }
  getMemoryDb().run(`INSERT INTO memory_events (id, source_type, source_id, thread_id, task_id, category, title, summary, detail, keywords_json, metadata_json, occurred_at, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.id, row.sourceType, row.sourceId, row.threadId ?? null, row.taskId ?? null, row.category, row.title, row.summary, row.detail, JSON.stringify(row.keywords), row.metadata ? JSON.stringify(row.metadata) : null, row.occurredAt, row.day, new Date().toISOString()])
  scheduleSave()
  return { row, inserted: true }
}

export function listMemoryEvents(limit = 200): MemoryEventRow[] {
  return readRows<any>("SELECT * FROM memory_events ORDER BY occurred_at DESC LIMIT ?", [limit]).map(mapMemoryEventRow)
}

export function searchMemoryEvents(params: { text?: string; from?: string; to?: string; categories?: string[]; sourceTypes?: string[]; limit?: number }): MemoryEventRow[] {
  const clauses: string[] = []
  const values: Array<string | number | null> = []
  if (params.text?.trim()) {
    const keyword = `%${params.text.trim()}%`
    clauses.push("(title LIKE ? OR summary LIKE ? OR detail LIKE ? OR keywords_json LIKE ? OR metadata_json LIKE ?)")
    values.push(keyword, keyword, keyword, keyword, keyword)
  }
  if (params.from) {
    clauses.push("occurred_at >= ?")
    values.push(params.from)
  }
  if (params.to) {
    clauses.push("occurred_at <= ?")
    values.push(params.to)
  }
  if (params.categories && params.categories.length > 0) {
    clauses.push(`category IN (${params.categories.map(() => "?").join(", ")})`)
    values.push(...params.categories)
  }
  if (params.sourceTypes && params.sourceTypes.length > 0) {
    clauses.push(`source_type IN (${params.sourceTypes.map(() => "?").join(", ")})`)
    values.push(...params.sourceTypes)
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""
  return readRows<any>(`SELECT * FROM memory_events ${where} ORDER BY occurred_at DESC LIMIT ?`, [...values, Math.max(1, Math.min(1000, Math.round(params.limit ?? 50)))]).map(mapMemoryEventRow)
}

export function listMemoryEventsByRange(from: string, to: string, categories: string[] = [], limit = 1000): MemoryEventRow[] {
  const values: Array<string | number | null> = [from, to]
  let where = "occurred_at >= ? AND occurred_at <= ?"
  if (categories.length > 0) {
    where += ` AND category IN (${categories.map(() => "?").join(", ")})`
    values.push(...categories)
  }
  values.push(limit)
  return readRows<any>(`SELECT * FROM memory_events WHERE ${where} ORDER BY occurred_at DESC LIMIT ?`, values).map(mapMemoryEventRow)
}

export function clearMemoryEvents(): void {
  getMemoryDb().run("DELETE FROM memory_events")
  scheduleSave()
}

export function upsertMemoryEntity(input: MemoryEntityUpsertInput): MemoryEntityRow {
  const seenAt = input.seenAt ?? new Date().toISOString()
  const existing = readSingleRow<any>("SELECT * FROM memory_entities WHERE type = ? AND value = ? LIMIT 1", [input.type, input.value])
  if (!existing) {
    const row: MemoryEntityRow = { id: randomUUID(), type: input.type, name: input.name, value: input.value, confidence: input.confidence, firstSeenAt: seenAt, lastSeenAt: seenAt, evidenceCount: 1, sourceRefs: [input.sourceRef], metadata: input.metadata }
    getMemoryDb().run(`INSERT INTO memory_entities (id, type, name, value, confidence, first_seen_at, last_seen_at, evidence_count, source_refs_json, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.id, row.type, row.name, row.value, row.confidence, row.firstSeenAt, row.lastSeenAt, row.evidenceCount, JSON.stringify(row.sourceRefs), row.metadata ? JSON.stringify(row.metadata) : null])
    scheduleSave()
    return row
  }
  const sourceRefs = Array.from(new Set([...parseJsonArray(existing.source_refs_json), input.sourceRef])).slice(-20)
  const row: MemoryEntityRow = { id: existing.id, type: existing.type, name: input.name || existing.name, value: existing.value, confidence: Math.max(Number(existing.confidence) || 0, input.confidence), firstSeenAt: existing.first_seen_at, lastSeenAt: seenAt, evidenceCount: (Number(existing.evidence_count) || 0) + 1, sourceRefs, metadata: { ...(parseJsonObject(existing.metadata_json) ?? {}), ...(input.metadata ?? {}) } }
  getMemoryDb().run(`UPDATE memory_entities SET name = ?, confidence = ?, last_seen_at = ?, evidence_count = ?, source_refs_json = ?, metadata_json = ? WHERE id = ?`, [row.name, row.confidence, row.lastSeenAt, row.evidenceCount, JSON.stringify(row.sourceRefs), JSON.stringify(row.metadata ?? {}), row.id])
  scheduleSave()
  return row
}

export function listMemoryEntities(type?: MemoryEntityType, filters?: { text?: string; limit?: number }): MemoryEntityRow[] {
  const clauses: string[] = []
  const values: Array<string | number | null> = []
  if (type) {
    clauses.push("type = ?")
    values.push(type)
  }
  if (filters?.text?.trim()) {
    const keyword = `%${filters.text.trim()}%`
    clauses.push("(name LIKE ? OR value LIKE ? OR metadata_json LIKE ?)")
    values.push(keyword, keyword, keyword)
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""
  return readRows<any>(`SELECT * FROM memory_entities ${where} ORDER BY last_seen_at DESC, confidence DESC LIMIT ?`, [...values, Math.max(1, Math.min(500, Math.round(filters?.limit ?? 200)))]).map(mapMemoryEntityRow)
}

export function clearMemoryEntities(): void {
  getMemoryDb().run("DELETE FROM memory_entities")
  scheduleSave()
}

export function getMemoryRangeSummary(rangeKey: string): MemoryRangeSummaryRow | null {
  const row = readSingleRow<any>("SELECT * FROM memory_range_summaries WHERE range_key = ? LIMIT 1", [rangeKey])
  return row ? mapRangeSummaryRow(row) : null
}

export function upsertMemoryRangeSummary(input: MemoryRangeSummaryInput): MemoryRangeSummaryRow {
  const row: MemoryRangeSummaryRow = { id: getMemoryRangeSummary(input.rangeKey)?.id ?? randomUUID(), rangeKey: input.rangeKey, from: input.from, to: input.to, preset: input.preset, categories: input.categories, summaryText: input.summaryText, highlights: input.highlights, eventCount: input.eventCount, generatedAt: input.generatedAt ?? new Date().toISOString() }
  getMemoryDb().run(`INSERT OR REPLACE INTO memory_range_summaries (id, range_key, from_ts, to_ts, preset, categories_json, summary_text, highlights_json, event_count, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.id, row.rangeKey, row.from, row.to, row.preset ?? null, JSON.stringify(row.categories), row.summaryText, JSON.stringify(row.highlights), row.eventCount, row.generatedAt])
  scheduleSave()
  return row
}

export function clearMemoryRangeSummaries(): void {
  getMemoryDb().run("DELETE FROM memory_range_summaries")
  scheduleSave()
}
