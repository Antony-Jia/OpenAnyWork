import initSqlJs, { Database as SqlJsDatabase } from "sql.js"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { dirname, join } from "path"
import { getDbPath, getOpenworkDir } from "../storage"
import type { AppSettings, McpServerConfig, ProviderConfig, SubagentConfig } from "../types"

let db: SqlJsDatabase | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false

/**
 * Save database to disk (debounced)
 */
function saveToDisk(): void {
  if (!db) return

  dirty = true

  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    if (db && dirty) {
      const data = db.export()
      writeFileSync(getDbPath(), Buffer.from(data))
      dirty = false
    }
  }, 100)
}

export function markDbDirty(): void {
  saveToDisk()
}

/**
 * Force immediate save
 */
export async function flush(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (db && dirty) {
    const data = db.export()
    writeFileSync(getDbPath(), Buffer.from(data))
    dirty = false
  }
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.")
  }
  return db
}

export async function initializeDatabase(): Promise<SqlJsDatabase> {
  const dbPath = getDbPath()
  console.log("Initializing database at:", dbPath)

  const SQL = await initSqlJs()

  // Load existing database if it exists
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    // Ensure directory exists
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    db = new SQL.Database()
  }

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS threads (
      thread_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT,
      status TEXT DEFAULT 'idle',
      thread_values TEXT,
      title TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      thread_id TEXT REFERENCES threads(thread_id) ON DELETE CASCADE,
      assistant_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT,
      metadata TEXT,
      kwargs TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS assistants (
      assistant_id TEXT PRIMARY KEY,
      graph_id TEXT NOT NULL,
      name TEXT,
      model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      data TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS provider_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      data TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS tool_config (
      name TEXT PRIMARY KEY,
      enabled INTEGER,
      enabled_classic INTEGER,
      enabled_butler INTEGER,
      key TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      command TEXT,
      args TEXT,
      env TEXT,
      cwd TEXT,
      url TEXT,
      headers TEXT,
      auto_start INTEGER,
      enabled_classic INTEGER,
      enabled_butler INTEGER,
      enabled INTEGER
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS subagents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      model TEXT,
      model_provider TEXT,
      tools TEXT,
      middleware TEXT,
      skills TEXT,
      interrupt_on INTEGER,
      enabled_classic INTEGER,
      enabled_butler INTEGER,
      enabled INTEGER
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS butler_calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      reminder_sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS butler_countdown_timers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL,
      reminder_sent_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS butler_mail_watch_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder TEXT NOT NULL,
      from_contains TEXT,
      subject_contains TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_seen_uid INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS butler_mail_watch_messages (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      uid INTEGER NOT NULL,
      subject TEXT NOT NULL,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      received_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS butler_rss_watch_subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_seen_item_key TEXT,
      last_seen_published_at TEXT,
      last_pulled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS butler_rss_watch_items (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      summary TEXT NOT NULL,
      published_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)`)
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_prompt_templates_updated_at ON prompt_templates(updated_at)`
  )
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_name ON prompt_templates(name COLLATE NOCASE)`
  )
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_calendar_events_start_at ON butler_calendar_events(start_at)`
  )
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_countdown_timers_due_at ON butler_countdown_timers(due_at)`
  )
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_mail_watch_rules_enabled ON butler_mail_watch_rules(enabled)`
  )
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_mail_watch_messages_rule_created ON butler_mail_watch_messages(rule_id, created_at DESC)`
  )
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_butler_mail_watch_messages_rule_uid ON butler_mail_watch_messages(rule_id, uid)`
  )
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_rss_watch_subscriptions_enabled ON butler_rss_watch_subscriptions(enabled)`
  )
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_rss_watch_items_subscription_created ON butler_rss_watch_items(subscription_id, created_at DESC)`
  )
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_butler_rss_watch_items_subscription_key ON butler_rss_watch_items(subscription_id, item_key)`
  )

  if (!tableHasColumn(db, "subagents", "model_provider")) {
    db.run(`ALTER TABLE subagents ADD COLUMN model_provider TEXT`)
  }
  if (!tableHasColumn(db, "subagents", "skills")) {
    db.run(`ALTER TABLE subagents ADD COLUMN skills TEXT`)
  }
  if (!tableHasColumn(db, "tool_config", "enabled_classic")) {
    db.run(`ALTER TABLE tool_config ADD COLUMN enabled_classic INTEGER`)
  }
  if (!tableHasColumn(db, "tool_config", "enabled_butler")) {
    db.run(`ALTER TABLE tool_config ADD COLUMN enabled_butler INTEGER`)
  }
  if (!tableHasColumn(db, "mcp_servers", "enabled_classic")) {
    db.run(`ALTER TABLE mcp_servers ADD COLUMN enabled_classic INTEGER`)
  }
  if (!tableHasColumn(db, "mcp_servers", "enabled_butler")) {
    db.run(`ALTER TABLE mcp_servers ADD COLUMN enabled_butler INTEGER`)
  }
  if (!tableHasColumn(db, "subagents", "enabled_classic")) {
    db.run(`ALTER TABLE subagents ADD COLUMN enabled_classic INTEGER`)
  }
  if (!tableHasColumn(db, "subagents", "enabled_butler")) {
    db.run(`ALTER TABLE subagents ADD COLUMN enabled_butler INTEGER`)
  }

  // Backward compatibility: if legacy `enabled` exists, copy it to both scope columns.
  db.run(
    `UPDATE tool_config
     SET enabled_classic = COALESCE(enabled_classic, enabled),
         enabled_butler = COALESCE(enabled_butler, enabled)
     WHERE enabled IS NOT NULL`
  )
  db.run(
    `UPDATE mcp_servers
     SET enabled_classic = COALESCE(enabled_classic, enabled),
         enabled_butler = COALESCE(enabled_butler, enabled)
     WHERE enabled IS NOT NULL`
  )
  db.run(
    `UPDATE subagents
     SET enabled_classic = COALESCE(enabled_classic, enabled),
         enabled_butler = COALESCE(enabled_butler, enabled)
     WHERE enabled IS NOT NULL`
  )

  migrateConfigFromJson(db)
  saveToDisk()

  console.log("Database initialized successfully")
  return db
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (db) {
    // Save any pending changes
    if (dirty) {
      const data = db.export()
      writeFileSync(getDbPath(), Buffer.from(data))
    }
    db.close()
    db = null
  }
}

// Helper functions for common operations

function readLegacyJson<T>(filename: string): T | null {
  const filePath = join(getOpenworkDir(), filename)
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, "utf-8")
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function tableHasRows(database: SqlJsDatabase, tableName: string): boolean {
  const stmt = database.prepare(`SELECT 1 FROM ${tableName} LIMIT 1`)
  const has = stmt.step()
  stmt.free()
  return has
}

function tableHasColumn(database: SqlJsDatabase, tableName: string, columnName: string): boolean {
  const stmt = database.prepare(`PRAGMA table_info(${tableName})`)
  let found = false
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name?: string }
    if (row.name === columnName) {
      found = true
      break
    }
  }
  stmt.free()
  return found
}

function getMetaValue(database: SqlJsDatabase, key: string): string | null {
  const stmt = database.prepare("SELECT value FROM meta WHERE key = ?")
  stmt.bind([key])
  const hasRow = stmt.step()
  if (!hasRow) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject() as { value?: string | null }
  stmt.free()
  return row.value ?? null
}

function setMetaValue(database: SqlJsDatabase, key: string, value: string): void {
  database.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [key, value])
}

function migrateConfigFromJson(database: SqlJsDatabase): void {
  const migrated = getMetaValue(database, "json_migrated")
  if (migrated === "1") {
    return
  }

  let wrote = false

  if (!tableHasRows(database, "app_settings")) {
    const settings = readLegacyJson<AppSettings>("settings.json")
    if (settings) {
      database.run("INSERT OR REPLACE INTO app_settings (id, data) VALUES (1, ?)", [
        JSON.stringify(settings)
      ])
      wrote = true
    }
  }

  if (!tableHasRows(database, "provider_config")) {
    const config = readLegacyJson<ProviderConfig>("provider-config.json")
    if (config) {
      database.run("INSERT OR REPLACE INTO provider_config (id, data) VALUES (1, ?)", [
        JSON.stringify(config)
      ])
      wrote = true
    }
  }

  if (!tableHasRows(database, "tool_config")) {
    const tools =
      readLegacyJson<Record<string, { key?: string | null; enabled?: boolean | null }>>(
        "tools.json"
      )
    if (tools && typeof tools === "object") {
      for (const [name, entry] of Object.entries(tools)) {
        if (!name) continue
        const enabled =
          entry?.enabled === undefined || entry?.enabled === null ? null : entry.enabled ? 1 : 0
        const key = entry?.key ?? null
        database.run("INSERT OR REPLACE INTO tool_config (name, enabled, key) VALUES (?, ?, ?)", [
          name,
          enabled,
          key
        ])
        database.run(
          `UPDATE tool_config
           SET enabled_classic = COALESCE(enabled_classic, enabled),
               enabled_butler = COALESCE(enabled_butler, enabled)
           WHERE name = ?`,
          [name]
        )
        wrote = true
      }
    }
  }

  if (!tableHasRows(database, "mcp_servers")) {
    const mcp = readLegacyJson<{ servers?: McpServerConfig[] }>("mcp.json")
    const servers = Array.isArray(mcp?.servers) ? mcp?.servers : []
    for (const server of servers) {
      database.run(
        `INSERT OR REPLACE INTO mcp_servers
         (id, name, mode, command, args, env, cwd, url, headers, auto_start, enabled_classic, enabled_butler, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          server.id,
          server.name,
          server.mode,
          server.command ?? null,
          server.args ? JSON.stringify(server.args) : null,
          server.env ? JSON.stringify(server.env) : null,
          server.cwd ?? null,
          server.url ?? null,
          server.headers ? JSON.stringify(server.headers) : null,
          server.autoStart === undefined ? null : server.autoStart ? 1 : 0,
          server.enabledClassic === undefined
            ? server.enabled === undefined
              ? null
              : server.enabled
                ? 1
                : 0
            : server.enabledClassic
              ? 1
              : 0,
          server.enabledButler === undefined
            ? server.enabled === undefined
              ? null
              : server.enabled
                ? 1
                : 0
            : server.enabledButler
              ? 1
              : 0,
          server.enabled === undefined ? null : server.enabled ? 1 : 0
        ]
      )
      wrote = true
    }
  }

  if (!tableHasRows(database, "subagents")) {
    const subagents = readLegacyJson<SubagentConfig[]>("subagents.json")
    if (Array.isArray(subagents)) {
      for (const subagent of subagents) {
        database.run(
          `INSERT OR REPLACE INTO subagents
           (id, name, description, system_prompt, model, model_provider, tools, middleware, skills, interrupt_on, enabled_classic, enabled_butler, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            subagent.id,
            subagent.name,
            subagent.description,
            subagent.systemPrompt,
            subagent.model ?? null,
            subagent.provider ?? null,
            subagent.tools ? JSON.stringify(subagent.tools) : null,
            subagent.middleware ? JSON.stringify(subagent.middleware) : null,
            subagent.skills ? JSON.stringify(subagent.skills) : null,
            subagent.interruptOn === undefined ? null : subagent.interruptOn ? 1 : 0,
            subagent.enabledClassic === undefined
              ? subagent.enabled === undefined
                ? null
                : subagent.enabled
                  ? 1
                  : 0
              : subagent.enabledClassic
                ? 1
                : 0,
            subagent.enabledButler === undefined
              ? subagent.enabled === undefined
                ? null
                : subagent.enabled
                  ? 1
                  : 0
              : subagent.enabledButler
                ? 1
                : 0,
            subagent.enabled === undefined ? null : subagent.enabled ? 1 : 0
          ]
        )
        wrote = true
      }
    }
  }

  setMetaValue(database, "json_migrated", "1")
  if (wrote) {
    saveToDisk()
  }
}

/** Raw thread row from SQLite database (timestamps as numbers, metadata as JSON string) */
export interface ThreadRow {
  thread_id: string
  created_at: number
  updated_at: number
  metadata: string | null
  status: string
  thread_values: string | null
  title: string | null
}

export function getAllThreads(): ThreadRow[] {
  const database = getDb()
  const stmt = database.prepare("SELECT * FROM threads ORDER BY updated_at DESC")
  const threads: ThreadRow[] = []

  while (stmt.step()) {
    threads.push(stmt.getAsObject() as unknown as ThreadRow)
  }
  stmt.free()

  return threads
}

export function getThread(threadId: string): ThreadRow | null {
  const database = getDb()
  const stmt = database.prepare("SELECT * FROM threads WHERE thread_id = ?")
  stmt.bind([threadId])

  if (!stmt.step()) {
    stmt.free()
    return null
  }

  const thread = stmt.getAsObject() as unknown as ThreadRow
  stmt.free()
  return thread
}

export function createThread(threadId: string, metadata?: Record<string, unknown>): ThreadRow {
  const database = getDb()
  const now = Date.now()

  database.run(
    `INSERT INTO threads (thread_id, created_at, updated_at, metadata, status)
     VALUES (?, ?, ?, ?, ?)`,
    [threadId, now, now, metadata ? JSON.stringify(metadata) : null, "idle"]
  )

  saveToDisk()

  return {
    thread_id: threadId,
    created_at: now,
    updated_at: now,
    metadata: metadata ? JSON.stringify(metadata) : null,
    status: "idle",
    thread_values: null,
    title: null
  }
}

export function updateThread(
  threadId: string,
  updates: Partial<Omit<ThreadRow, "thread_id" | "created_at">>
): ThreadRow | null {
  const database = getDb()
  const existing = getThread(threadId)

  if (!existing) return null

  const now = Date.now()
  const setClauses: string[] = ["updated_at = ?"]
  const values: (string | number | null)[] = [now]

  if (updates.metadata !== undefined) {
    setClauses.push("metadata = ?")
    values.push(
      typeof updates.metadata === "string" ? updates.metadata : JSON.stringify(updates.metadata)
    )
  }
  if (updates.status !== undefined) {
    setClauses.push("status = ?")
    values.push(updates.status)
  }
  if (updates.thread_values !== undefined) {
    setClauses.push("thread_values = ?")
    values.push(updates.thread_values)
  }
  if (updates.title !== undefined) {
    setClauses.push("title = ?")
    values.push(updates.title)
  }

  values.push(threadId)

  database.run(`UPDATE threads SET ${setClauses.join(", ")} WHERE thread_id = ?`, values)

  saveToDisk()

  return getThread(threadId)
}

export function deleteThread(threadId: string): void {
  const database = getDb()
  database.run("DELETE FROM threads WHERE thread_id = ?", [threadId])
  saveToDisk()
}
