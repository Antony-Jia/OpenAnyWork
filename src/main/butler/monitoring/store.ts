import { v4 as uuid } from "uuid"
import { getDb, markDbDirty } from "../../db"
import type {
  CalendarWatchEvent,
  CalendarWatchEventCreateInput,
  CalendarWatchEventUpdateInput,
  CountdownWatchItem,
  CountdownWatchItemCreateInput,
  CountdownWatchItemUpdateInput,
  CountdownWatchStatus,
  MailWatchMessage,
  MailWatchRule,
  MailWatchRuleCreateInput,
  MailWatchRuleUpdateInput
} from "../../types"

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeIsoTime(input: string, fieldName: string): string {
  const value = input.trim()
  if (!value) {
    throw new Error(`${fieldName} is required.`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}.`)
  }
  return date.toISOString()
}

function normalizeOptionalText(input?: string | null): string | undefined {
  const value = input?.trim()
  return value ? value : undefined
}

function normalizeRequiredText(input: string, fieldName: string): string {
  const value = input.trim()
  if (!value) {
    throw new Error(`${fieldName} is required.`)
  }
  return value
}

function mapCalendarEventRow(row: Record<string, unknown>): CalendarWatchEvent {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: normalizeOptionalText((row.description as string | null | undefined) ?? undefined),
    location: normalizeOptionalText((row.location as string | null | undefined) ?? undefined),
    startAt: String(row.start_at ?? ""),
    endAt: normalizeOptionalText((row.end_at as string | null | undefined) ?? undefined),
    enabled: Boolean(row.enabled),
    reminderSentAt: normalizeOptionalText(
      (row.reminder_sent_at as string | null | undefined) ?? undefined
    ),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  }
}

function mapCountdownRow(row: Record<string, unknown>): CountdownWatchItem {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: normalizeOptionalText((row.description as string | null | undefined) ?? undefined),
    dueAt: String(row.due_at ?? ""),
    status: String(row.status ?? "running") as CountdownWatchStatus,
    reminderSentAt: normalizeOptionalText(
      (row.reminder_sent_at as string | null | undefined) ?? undefined
    ),
    completedAt: normalizeOptionalText(
      (row.completed_at as string | null | undefined) ?? undefined
    ),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  }
}

function mapMailRuleRow(row: Record<string, unknown>): MailWatchRule {
  const rawLastSeenUid = row.last_seen_uid
  const lastSeenUid =
    typeof rawLastSeenUid === "number" && Number.isFinite(rawLastSeenUid)
      ? rawLastSeenUid
      : undefined

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    folder: String(row.folder ?? "INBOX"),
    fromContains: normalizeOptionalText(
      (row.from_contains as string | null | undefined) ?? undefined
    ),
    subjectContains: normalizeOptionalText(
      (row.subject_contains as string | null | undefined) ?? undefined
    ),
    enabled: Boolean(row.enabled),
    lastSeenUid,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  }
}

function mapMailMessageRow(row: Record<string, unknown>): MailWatchMessage {
  return {
    id: String(row.id ?? ""),
    ruleId: String(row.rule_id ?? ""),
    uid: Number(row.uid ?? 0),
    subject: String(row.subject ?? ""),
    from: String(row.sender ?? ""),
    text: String(row.text ?? ""),
    receivedAt: String(row.received_at ?? ""),
    createdAt: String(row.created_at ?? "")
  }
}

function findCalendarEventById(id: string): CalendarWatchEvent | null {
  const database = getDb()
  const stmt = database.prepare(
    `SELECT id, title, description, location, start_at, end_at, enabled, reminder_sent_at, created_at, updated_at
     FROM butler_calendar_events WHERE id = ? LIMIT 1`
  )
  stmt.bind([id])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject() as Record<string, unknown>
  stmt.free()
  return mapCalendarEventRow(row)
}

function findCountdownById(id: string): CountdownWatchItem | null {
  const database = getDb()
  const stmt = database.prepare(
    `SELECT id, title, description, due_at, status, reminder_sent_at, completed_at, created_at, updated_at
     FROM butler_countdown_timers WHERE id = ? LIMIT 1`
  )
  stmt.bind([id])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject() as Record<string, unknown>
  stmt.free()
  return mapCountdownRow(row)
}

function findMailRuleById(id: string): MailWatchRule | null {
  const database = getDb()
  const stmt = database.prepare(
    `SELECT id, name, folder, from_contains, subject_contains, enabled, last_seen_uid, created_at, updated_at
     FROM butler_mail_watch_rules WHERE id = ? LIMIT 1`
  )
  stmt.bind([id])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject() as Record<string, unknown>
  stmt.free()
  return mapMailRuleRow(row)
}

export function listCalendarWatchEvents(): CalendarWatchEvent[] {
  const database = getDb()
  const stmt = database.prepare(
    `SELECT id, title, description, location, start_at, end_at, enabled, reminder_sent_at, created_at, updated_at
     FROM butler_calendar_events
     ORDER BY start_at ASC`
  )
  const rows: CalendarWatchEvent[] = []
  while (stmt.step()) {
    rows.push(mapCalendarEventRow(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return rows
}

export function createCalendarWatchEvent(input: CalendarWatchEventCreateInput): CalendarWatchEvent {
  const database = getDb()
  const now = nowIso()
  const id = uuid()
  const event: CalendarWatchEvent = {
    id,
    title: normalizeRequiredText(input.title, "title"),
    description: normalizeOptionalText(input.description),
    location: normalizeOptionalText(input.location),
    startAt: normalizeIsoTime(input.startAt, "startAt"),
    endAt: input.endAt ? normalizeIsoTime(input.endAt, "endAt") : undefined,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now
  }

  database.run(
    `INSERT INTO butler_calendar_events (
      id, title, description, location, start_at, end_at, enabled, reminder_sent_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.title,
      event.description ?? null,
      event.location ?? null,
      event.startAt,
      event.endAt ?? null,
      event.enabled ? 1 : 0,
      null,
      event.createdAt,
      event.updatedAt
    ]
  )
  markDbDirty()
  return event
}

export function updateCalendarWatchEvent(
  id: string,
  updates: CalendarWatchEventUpdateInput
): CalendarWatchEvent {
  const existing = findCalendarEventById(id)
  if (!existing) {
    throw new Error("Calendar event not found.")
  }

  const next: CalendarWatchEvent = {
    ...existing,
    title:
      updates.title === undefined ? existing.title : normalizeRequiredText(updates.title, "title"),
    description:
      updates.description === undefined
        ? existing.description
        : normalizeOptionalText(updates.description),
    location:
      updates.location === undefined ? existing.location : normalizeOptionalText(updates.location),
    startAt:
      updates.startAt === undefined
        ? existing.startAt
        : normalizeIsoTime(updates.startAt, "startAt"),
    endAt:
      updates.endAt === undefined
        ? existing.endAt
        : updates.endAt
          ? normalizeIsoTime(updates.endAt, "endAt")
          : undefined,
    enabled: updates.enabled ?? existing.enabled,
    reminderSentAt:
      updates.reminderSentAt === undefined
        ? existing.reminderSentAt
        : updates.reminderSentAt
          ? normalizeIsoTime(updates.reminderSentAt, "reminderSentAt")
          : undefined,
    updatedAt: nowIso()
  }

  const database = getDb()
  database.run(
    `UPDATE butler_calendar_events
     SET title = ?, description = ?, location = ?, start_at = ?, end_at = ?, enabled = ?, reminder_sent_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.title,
      next.description ?? null,
      next.location ?? null,
      next.startAt,
      next.endAt ?? null,
      next.enabled ? 1 : 0,
      next.reminderSentAt ?? null,
      next.updatedAt,
      id
    ]
  )
  markDbDirty()
  return next
}

export function deleteCalendarWatchEvent(id: string): void {
  const database = getDb()
  database.run("DELETE FROM butler_calendar_events WHERE id = ?", [id])
  markDbDirty()
}

export function listCountdownWatchItems(): CountdownWatchItem[] {
  const database = getDb()
  const stmt = database.prepare(
    `SELECT id, title, description, due_at, status, reminder_sent_at, completed_at, created_at, updated_at
     FROM butler_countdown_timers
     ORDER BY due_at ASC`
  )
  const rows: CountdownWatchItem[] = []
  while (stmt.step()) {
    rows.push(mapCountdownRow(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return rows
}

export function createCountdownWatchItem(input: CountdownWatchItemCreateInput): CountdownWatchItem {
  const database = getDb()
  const now = nowIso()
  const id = uuid()
  const item: CountdownWatchItem = {
    id,
    title: normalizeRequiredText(input.title, "title"),
    description: normalizeOptionalText(input.description),
    dueAt: normalizeIsoTime(input.dueAt, "dueAt"),
    status: "running",
    createdAt: now,
    updatedAt: now
  }

  database.run(
    `INSERT INTO butler_countdown_timers (
      id, title, description, due_at, status, reminder_sent_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.title,
      item.description ?? null,
      item.dueAt,
      item.status,
      null,
      null,
      item.createdAt,
      item.updatedAt
    ]
  )
  markDbDirty()
  return item
}

export function updateCountdownWatchItem(
  id: string,
  updates: CountdownWatchItemUpdateInput
): CountdownWatchItem {
  const existing = findCountdownById(id)
  if (!existing) {
    throw new Error("Countdown timer not found.")
  }

  const nextStatus = updates.status ?? existing.status
  const nextCompletedAt =
    updates.completedAt === undefined
      ? existing.completedAt
      : updates.completedAt
        ? normalizeIsoTime(updates.completedAt, "completedAt")
        : undefined

  const next: CountdownWatchItem = {
    ...existing,
    title:
      updates.title === undefined ? existing.title : normalizeRequiredText(updates.title, "title"),
    description:
      updates.description === undefined
        ? existing.description
        : normalizeOptionalText(updates.description),
    dueAt: updates.dueAt === undefined ? existing.dueAt : normalizeIsoTime(updates.dueAt, "dueAt"),
    status: nextStatus,
    reminderSentAt:
      updates.reminderSentAt === undefined
        ? existing.reminderSentAt
        : updates.reminderSentAt
          ? normalizeIsoTime(updates.reminderSentAt, "reminderSentAt")
          : undefined,
    completedAt: nextCompletedAt,
    updatedAt: nowIso()
  }

  const database = getDb()
  database.run(
    `UPDATE butler_countdown_timers
     SET title = ?, description = ?, due_at = ?, status = ?, reminder_sent_at = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.title,
      next.description ?? null,
      next.dueAt,
      next.status,
      next.reminderSentAt ?? null,
      next.completedAt ?? null,
      next.updatedAt,
      id
    ]
  )
  markDbDirty()
  return next
}

export function deleteCountdownWatchItem(id: string): void {
  const database = getDb()
  database.run("DELETE FROM butler_countdown_timers WHERE id = ?", [id])
  markDbDirty()
}

export function listMailWatchRules(): MailWatchRule[] {
  const database = getDb()
  const stmt = database.prepare(
    `SELECT id, name, folder, from_contains, subject_contains, enabled, last_seen_uid, created_at, updated_at
     FROM butler_mail_watch_rules
     ORDER BY created_at DESC`
  )
  const rows: MailWatchRule[] = []
  while (stmt.step()) {
    rows.push(mapMailRuleRow(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return rows
}

export function createMailWatchRule(input: MailWatchRuleCreateInput): MailWatchRule {
  const database = getDb()
  const now = nowIso()
  const id = uuid()
  const rule: MailWatchRule = {
    id,
    name: normalizeRequiredText(input.name, "name"),
    folder: normalizeOptionalText(input.folder) || "INBOX",
    fromContains: normalizeOptionalText(input.fromContains),
    subjectContains: normalizeOptionalText(input.subjectContains),
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now
  }

  database.run(
    `INSERT INTO butler_mail_watch_rules (
      id, name, folder, from_contains, subject_contains, enabled, last_seen_uid, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rule.id,
      rule.name,
      rule.folder,
      rule.fromContains ?? null,
      rule.subjectContains ?? null,
      rule.enabled ? 1 : 0,
      null,
      rule.createdAt,
      rule.updatedAt
    ]
  )
  markDbDirty()
  return rule
}

export function updateMailWatchRule(id: string, updates: MailWatchRuleUpdateInput): MailWatchRule {
  const existing = findMailRuleById(id)
  if (!existing) {
    throw new Error("Mail watch rule not found.")
  }

  const next: MailWatchRule = {
    ...existing,
    name: updates.name === undefined ? existing.name : normalizeRequiredText(updates.name, "name"),
    folder:
      updates.folder === undefined
        ? existing.folder
        : normalizeOptionalText(updates.folder) || "INBOX",
    fromContains:
      updates.fromContains === undefined
        ? existing.fromContains
        : normalizeOptionalText(updates.fromContains),
    subjectContains:
      updates.subjectContains === undefined
        ? existing.subjectContains
        : normalizeOptionalText(updates.subjectContains),
    enabled: updates.enabled ?? existing.enabled,
    lastSeenUid:
      updates.lastSeenUid === undefined
        ? existing.lastSeenUid
        : updates.lastSeenUid === null
          ? undefined
          : Math.max(0, Math.floor(updates.lastSeenUid)),
    updatedAt: nowIso()
  }

  const database = getDb()
  database.run(
    `UPDATE butler_mail_watch_rules
     SET name = ?, folder = ?, from_contains = ?, subject_contains = ?, enabled = ?, last_seen_uid = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.name,
      next.folder,
      next.fromContains ?? null,
      next.subjectContains ?? null,
      next.enabled ? 1 : 0,
      next.lastSeenUid ?? null,
      next.updatedAt,
      id
    ]
  )
  markDbDirty()
  return next
}

export function deleteMailWatchRule(id: string): void {
  const database = getDb()
  database.run("DELETE FROM butler_mail_watch_rules WHERE id = ?", [id])
  database.run("DELETE FROM butler_mail_watch_messages WHERE rule_id = ?", [id])
  markDbDirty()
}

export function listRecentMailWatchMessages(limit = 20): MailWatchMessage[] {
  const normalizedLimit = Math.max(1, Math.min(200, Math.floor(limit)))
  const database = getDb()
  const stmt = database.prepare(
    `SELECT id, rule_id, uid, subject, sender, text, received_at, created_at
     FROM butler_mail_watch_messages
     ORDER BY created_at DESC
     LIMIT ?`
  )
  stmt.bind([normalizedLimit])
  const rows: MailWatchMessage[] = []
  while (stmt.step()) {
    rows.push(mapMailMessageRow(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return rows
}

export function insertMailWatchMessages(messages: MailWatchMessage[]): MailWatchMessage[] {
  if (messages.length === 0) return []

  const database = getDb()
  const inserted: MailWatchMessage[] = []
  const checkStmt = database.prepare(
    "SELECT 1 FROM butler_mail_watch_messages WHERE id = ? LIMIT 1"
  )

  for (const message of messages) {
    checkStmt.bind([message.id])
    const exists = checkStmt.step()
    checkStmt.reset()
    if (exists) {
      continue
    }

    database.run(
      `INSERT INTO butler_mail_watch_messages (
        id, rule_id, uid, subject, sender, text, received_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.ruleId,
        message.uid,
        message.subject,
        message.from,
        message.text,
        message.receivedAt,
        message.createdAt
      ]
    )
    inserted.push(message)
  }
  checkStmt.free()

  if (inserted.length > 0) {
    markDbDirty()
  }
  return inserted
}
