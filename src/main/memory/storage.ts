import initSqlJs, { Database as SqlJsDatabase } from "sql.js"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { dirname } from "path"
import { randomUUID } from "crypto"
import { getMemoryDbPath } from "../storage"
import type {
  ButlerMessageInput,
  ButlerMessageRow,
  ButlerTaskRow,
  DailyProfileInput,
  DailyProfileRow,
  MemoryTaskSummaryInput,
  MemoryTaskSummaryRow
} from "./types"
import type { ButlerTask, ThreadMode } from "../types"

let db: SqlJsDatabase | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false

function scheduleSave(): void {
  if (!db) return
  dirty = true

  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    if (!db || !dirty) return
    const data = db.export()
    writeFileSync(getMemoryDbPath(), Buffer.from(data))
    dirty = false
  }, 100)
}

export async function flushMemoryDatabase(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!db || !dirty) return
  const data = db.export()
  writeFileSync(getMemoryDbPath(), Buffer.from(data))
  dirty = false
}

export async function initializeMemoryDatabase(): Promise<void> {
  if (db) return

  const SQL = await initSqlJs()
  const dbPath = getMemoryDbPath()
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    db = new SQL.Database()
  }

  const database = getMemoryDb()

  database.run(`
    CREATE TABLE IF NOT EXISTS memory_task_summaries (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      title TEXT,
      summary_brief TEXT NOT NULL,
      summary_detail TEXT NOT NULL,
      task_direction TEXT,
      usage_habits TEXT,
      hobbies TEXT,
      research_process TEXT,
      report_preference TEXT,
      created_at TEXT NOT NULL
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS memory_daily_profiles (
      day TEXT PRIMARY KEY,
      profile_text TEXT NOT NULL,
      comparison_text TEXT NOT NULL,
      previous_profile_day TEXT,
      created_at TEXT NOT NULL
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS memory_runs (
      run_key TEXT PRIMARY KEY,
      run_value TEXT,
      created_at TEXT NOT NULL
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS butler_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      ts TEXT NOT NULL
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS butler_tasks (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  database.run(
    "CREATE INDEX IF NOT EXISTS idx_memory_task_summaries_thread_id ON memory_task_summaries(thread_id)"
  )
  database.run(
    "CREATE INDEX IF NOT EXISTS idx_memory_task_summaries_created_at ON memory_task_summaries(created_at)"
  )
  database.run(
    "CREATE INDEX IF NOT EXISTS idx_memory_task_summaries_report_preference ON memory_task_summaries(report_preference)"
  )
  database.run("CREATE INDEX IF NOT EXISTS idx_butler_messages_ts ON butler_messages(ts)")

  scheduleSave()
}

function getMemoryDb(): SqlJsDatabase {
  if (!db) {
    throw new Error("Memory database not initialized.")
  }
  return db
}

function readRows<T>(query: string, params: Array<string | number | null> = []): T[] {
  const statement = getMemoryDb().prepare(query)
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

function readSingleRow<T>(query: string, params: Array<string | number | null> = []): T | null {
  const rows = readRows<T>(query, params)
  return rows.length > 0 ? rows[0] : null
}

function normalizeMode(mode: string): ThreadMode {
  if (mode === "ralph" || mode === "email" || mode === "loop" || mode === "butler") {
    return mode
  }
  return "default"
}

interface TaskSummaryDbRow {
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
}

function mapTaskSummaryRow(row: TaskSummaryDbRow): MemoryTaskSummaryRow {
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

export function insertTaskSummary(input: MemoryTaskSummaryInput): MemoryTaskSummaryRow {
  const row: MemoryTaskSummaryRow = {
    id: randomUUID(),
    threadId: input.threadId,
    mode: input.mode,
    title: input.title,
    summaryBrief: input.summaryBrief,
    summaryDetail: input.summaryDetail,
    taskDirection: input.taskDirection,
    usageHabits: input.usageHabits,
    hobbies: input.hobbies,
    researchProcess: input.researchProcess,
    reportPreference: input.reportPreference,
    createdAt: input.createdAt ?? new Date().toISOString()
  }

  getMemoryDb().run(
    `INSERT INTO memory_task_summaries
      (id, thread_id, mode, title, summary_brief, summary_detail, task_direction, usage_habits, hobbies, research_process, report_preference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.threadId,
      row.mode,
      row.title ?? null,
      row.summaryBrief,
      row.summaryDetail,
      row.taskDirection ?? null,
      row.usageHabits ?? null,
      row.hobbies ?? null,
      row.researchProcess ?? null,
      row.reportPreference ?? null,
      row.createdAt
    ]
  )
  scheduleSave()
  return row
}

export function listTaskSummaries(limit = 200): MemoryTaskSummaryRow[] {
  const rows = readRows<TaskSummaryDbRow>(
    `SELECT * FROM memory_task_summaries
      ORDER BY created_at DESC
      LIMIT ?`,
    [limit]
  )

  return rows.map(mapTaskSummaryRow)
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
  const rows = readRows<{
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
  }>("SELECT * FROM memory_task_summaries WHERE thread_id = ? ORDER BY created_at DESC", [threadId])

  return rows.map((row) => ({
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
  }))
}

export function searchTaskSummaries(query: string, limit = 20): MemoryTaskSummaryRow[] {
  const keyword = `%${query.trim()}%`
  const rows = readRows<{
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
  }>(
    `SELECT * FROM memory_task_summaries
      WHERE title LIKE ? OR summary_brief LIKE ? OR summary_detail LIKE ?
      ORDER BY created_at DESC
      LIMIT ?`,
    [keyword, keyword, keyword, limit]
  )

  return rows.map((row) => ({
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
  }))
}

export function listTaskSummariesByDay(day: string): MemoryTaskSummaryRow[] {
  const begin = new Date(`${day}T00:00:00.000`).toISOString()
  const end = new Date(`${day}T23:59:59.999`).toISOString()
  const rows = readRows<{
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
  }>(
    `SELECT * FROM memory_task_summaries
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC`,
    [begin, end]
  )

  return rows.map((row) => ({
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
  }))
}

export function getDailyProfile(day: string): DailyProfileRow | null {
  const row = readSingleRow<{
    day: string
    profile_text: string
    comparison_text: string
    previous_profile_day?: string | null
    created_at: string
  }>("SELECT * FROM memory_daily_profiles WHERE day = ? LIMIT 1", [day])

  if (!row) return null
  return {
    day: row.day,
    profileText: row.profile_text,
    comparisonText: row.comparison_text,
    previousProfileDay: row.previous_profile_day ?? undefined,
    createdAt: row.created_at
  }
}

export function listDailyProfiles(limit = 60): DailyProfileRow[] {
  const rows = readRows<{
    day: string
    profile_text: string
    comparison_text: string
    previous_profile_day?: string | null
    created_at: string
  }>(
    `SELECT * FROM memory_daily_profiles
      ORDER BY day DESC
      LIMIT ?`,
    [limit]
  )

  return rows.map((row) => ({
    day: row.day,
    profileText: row.profile_text,
    comparisonText: row.comparison_text,
    previousProfileDay: row.previous_profile_day ?? undefined,
    createdAt: row.created_at
  }))
}

export function getPreviousDailyProfile(beforeDay: string): DailyProfileRow | null {
  const row = readSingleRow<{
    day: string
    profile_text: string
    comparison_text: string
    previous_profile_day?: string | null
    created_at: string
  }>(
    `SELECT * FROM memory_daily_profiles
      WHERE day < ?
      ORDER BY day DESC
      LIMIT 1`,
    [beforeDay]
  )

  if (!row) return null
  return {
    day: row.day,
    profileText: row.profile_text,
    comparisonText: row.comparison_text,
    previousProfileDay: row.previous_profile_day ?? undefined,
    createdAt: row.created_at
  }
}

export function upsertDailyProfile(input: DailyProfileInput): DailyProfileRow {
  const row: DailyProfileRow = {
    day: input.day,
    profileText: input.profileText,
    comparisonText: input.comparisonText,
    previousProfileDay: input.previousProfileDay,
    createdAt: input.createdAt ?? new Date().toISOString()
  }

  getMemoryDb().run(
    `INSERT OR REPLACE INTO memory_daily_profiles
      (day, profile_text, comparison_text, previous_profile_day, created_at)
      VALUES (?, ?, ?, ?, ?)`,
    [row.day, row.profileText, row.comparisonText, row.previousProfileDay ?? null, row.createdAt]
  )

  scheduleSave()
  return row
}

export function hasRunMarker(key: string): boolean {
  const row = readSingleRow<{ run_key: string }>(
    "SELECT run_key FROM memory_runs WHERE run_key = ? LIMIT 1",
    [key]
  )
  return !!row
}

export function setRunMarker(key: string, value = ""): void {
  getMemoryDb().run(
    "INSERT OR REPLACE INTO memory_runs (run_key, run_value, created_at) VALUES (?, ?, ?)",
    [key, value, new Date().toISOString()]
  )
  scheduleSave()
}

export function clearRunMarkers(): void {
  getMemoryDb().run("DELETE FROM memory_runs")
  scheduleSave()
}

export function appendButlerMessage(input: ButlerMessageInput): void {
  getMemoryDb().run(
    "INSERT OR REPLACE INTO butler_messages (id, role, content, ts) VALUES (?, ?, ?, ?)",
    [input.id, input.role, input.content, input.ts]
  )
  scheduleSave()
}

export function listButlerMessages(): ButlerMessageRow[] {
  return readRows<ButlerMessageRow>(
    "SELECT id, role, content, ts FROM butler_messages ORDER BY ts ASC"
  )
}

export function clearButlerMessages(): void {
  getMemoryDb().run("DELETE FROM butler_messages")
  scheduleSave()
}

export function upsertButlerTask(task: ButlerTask): void {
  getMemoryDb().run(
    "INSERT OR REPLACE INTO butler_tasks (id, payload, updated_at) VALUES (?, ?, ?)",
    [task.id, JSON.stringify(task), new Date().toISOString()]
  )
  scheduleSave()
}

export function listButlerTasks(): ButlerTaskRow[] {
  const rows = readRows<{ id: string; payload: string }>(
    "SELECT id, payload FROM butler_tasks ORDER BY updated_at DESC"
  )
  return rows.flatMap((row) => {
    try {
      const payload = JSON.parse(row.payload) as ButlerTask
      return [{ id: row.id, payload }]
    } catch {
      return []
    }
  })
}

export function deleteButlerTasksByIds(taskIds: string[]): void {
  if (taskIds.length === 0) return
  const placeholders = taskIds.map(() => "?").join(", ")
  getMemoryDb().run(`DELETE FROM butler_tasks WHERE id IN (${placeholders})`, taskIds)
  scheduleSave()
}

export function clearDailyProfiles(): void {
  getMemoryDb().run("DELETE FROM memory_daily_profiles")
  scheduleSave()
}
