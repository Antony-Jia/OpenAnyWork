import { v4 as uuid } from "uuid"
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { getSettings } from "../../settings"
import type {
  ButlerMonitorSnapshot,
  ButlerMonitorBusEvent,
  ButlerPerceptionInput,
  CalendarWatchEvent,
  CalendarWatchEventCreateInput,
  CalendarWatchEventUpdateInput,
  CountdownWatchItem,
  CountdownWatchItemCreateInput,
  CountdownWatchItemUpdateInput,
  MailWatchMessage,
  MailWatchRule,
  MailWatchRuleCreateInput,
  MailWatchRuleUpdateInput,
  TaskCompletionNotice
} from "../../types"
import type { ButlerPerceptionGateway } from "../perception"
import {
  createCalendarWatchEvent,
  createCountdownWatchItem,
  createMailWatchRule,
  deleteCalendarWatchEvent,
  deleteCountdownWatchItem,
  deleteMailWatchRule,
  insertMailWatchMessages,
  listCalendarWatchEvents,
  listCountdownWatchItems,
  listMailWatchRules,
  listRecentMailWatchMessages,
  updateCalendarWatchEvent,
  updateCountdownWatchItem,
  updateMailWatchRule
} from "./store"
import { ButlerMonitorBus } from "./bus"

interface ButlerMonitorManagerDeps {
  bus: ButlerMonitorBus
  perceptionGateway: ButlerPerceptionGateway
  onNotice: (notice: TaskCompletionNotice) => void
}

interface MailConnectionSettings {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

const CALENDAR_DUE_SOON_MS = 2 * 60 * 60 * 1000
const MAX_MAIL_FETCH_PER_RULE = 30

function nowIso(): string {
  return new Date().toISOString()
}

function compact(text: string, max = 280): string {
  const normalized = text.trim().replace(/\s+/g, " ")
  if (!normalized) return ""
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

function parseIsoTime(value: string): number {
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : Number.NaN
}

function normalizeMailSettings(): MailConnectionSettings | null {
  const settings = getSettings().email
  if (!settings?.enabled) return null
  if (!settings.imap.host || !settings.imap.user || !settings.imap.pass) return null
  return {
    host: settings.imap.host,
    port: settings.imap.port,
    secure: settings.imap.secure,
    user: settings.imap.user,
    pass: settings.imap.pass
  }
}

function normalizeMonitorScanIntervalMs(): number {
  const sec = getSettings().butler?.monitorScanIntervalSec
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) {
    return 30_000
  }
  return Math.max(1, Math.round(sec)) * 1000
}

function normalizeMonitorPullIntervalMs(): number {
  const sec = getSettings().butler?.monitorPullIntervalSec
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) {
    return 60_000
  }
  return Math.max(1, Math.round(sec)) * 1000
}

export class ButlerMonitorManager {
  private started = false
  private timeScanTimer: NodeJS.Timeout | null = null
  private mailPollTimer: NodeJS.Timeout | null = null
  private timeScanRunning = false
  private mailPollingRunning = false

  constructor(private readonly deps: ButlerMonitorManagerDeps) {}

  start(): void {
    if (this.started) return
    this.started = true
    this.scheduleTimeScan()
    this.scheduleMailPolling()
    void this.scanTimeTriggers()
    void this.pullMailNow("startup")
    this.emitSnapshotChanged()
  }

  stop(): void {
    this.started = false
    if (this.timeScanTimer) {
      clearInterval(this.timeScanTimer)
      this.timeScanTimer = null
    }
    if (this.mailPollTimer) {
      clearInterval(this.mailPollTimer)
      this.mailPollTimer = null
    }
  }

  refreshIntervals(): void {
    if (!this.started) return
    this.scheduleTimeScan()
    this.scheduleMailPolling()
  }

  getSnapshot(): ButlerMonitorSnapshot {
    return {
      calendarEvents: this.listCalendarEvents(),
      countdownTimers: this.listCountdownTimers(),
      mailRules: this.listMailRules(),
      recentMails: this.listRecentMails(20)
    }
  }

  listCalendarEvents(): CalendarWatchEvent[] {
    return listCalendarWatchEvents()
  }

  createCalendarEvent(input: CalendarWatchEventCreateInput): CalendarWatchEvent {
    const event = createCalendarWatchEvent(input)
    void this.scanTimeTriggers()
    this.emitSnapshotChanged()
    return event
  }

  updateCalendarEvent(id: string, updates: CalendarWatchEventUpdateInput): CalendarWatchEvent {
    const event = updateCalendarWatchEvent(id, updates)
    void this.scanTimeTriggers()
    this.emitSnapshotChanged()
    return event
  }

  deleteCalendarEvent(id: string): void {
    deleteCalendarWatchEvent(id)
    this.emitSnapshotChanged()
  }

  listCountdownTimers(): CountdownWatchItem[] {
    return listCountdownWatchItems()
  }

  createCountdownTimer(input: CountdownWatchItemCreateInput): CountdownWatchItem {
    const timer = createCountdownWatchItem(input)
    void this.scanTimeTriggers()
    this.emitSnapshotChanged()
    return timer
  }

  updateCountdownTimer(id: string, updates: CountdownWatchItemUpdateInput): CountdownWatchItem {
    const timer = updateCountdownWatchItem(id, updates)
    void this.scanTimeTriggers()
    this.emitSnapshotChanged()
    return timer
  }

  deleteCountdownTimer(id: string): void {
    deleteCountdownWatchItem(id)
    this.emitSnapshotChanged()
  }

  listMailRules(): MailWatchRule[] {
    return listMailWatchRules()
  }

  createMailRule(input: MailWatchRuleCreateInput): MailWatchRule {
    const rule = createMailWatchRule(input)
    void this.pullMailNow("rule_update")
    this.emitSnapshotChanged()
    return rule
  }

  updateMailRule(id: string, updates: MailWatchRuleUpdateInput): MailWatchRule {
    const rule = updateMailWatchRule(id, updates)
    void this.pullMailNow("rule_update")
    this.emitSnapshotChanged()
    return rule
  }

  deleteMailRule(id: string): void {
    deleteMailWatchRule(id)
    this.emitSnapshotChanged()
  }

  listRecentMails(limit = 20): MailWatchMessage[] {
    return listRecentMailWatchMessages(limit)
  }

  async pullMailNow(
    source: "manual" | "interval" | "startup" | "rule_update" = "manual"
  ): Promise<MailWatchMessage[]> {
    this.emitBusEvent({
      type: "pull_requested",
      source,
      at: nowIso()
    })
    if (this.mailPollingRunning) {
      return []
    }
    this.mailPollingRunning = true

    try {
      const settings = normalizeMailSettings()
      if (!settings) {
        return []
      }
      const rules = this.listMailRules().filter((rule) => rule.enabled)
      if (rules.length === 0) {
        return []
      }

      const client = new ImapFlow({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: {
          user: settings.user,
          pass: settings.pass
        },
        socketTimeout: 30_000,
        logger: false
      })

      const fetchedMessages: MailWatchMessage[] = []
      try {
        await client.connect()
        for (const rule of rules) {
          const messages = await this.pullRuleMessages(client, rule)
          fetchedMessages.push(...messages)
        }
      } finally {
        try {
          await client.logout()
        } catch {
          // noop
        }
      }

      if (fetchedMessages.length === 0) {
        this.emitSnapshotChanged()
        return []
      }

      const inserted = insertMailWatchMessages(fetchedMessages)
      for (const message of inserted) {
        await this.dispatchPerception({
          kind: "mail_new",
          title: `新邮件提醒：${message.subject || "(无主题)"}`,
          detail: [
            `发件人: ${message.from || "未知"}`,
            `主题: ${message.subject || "(无主题)"}`,
            `内容摘要: ${compact(message.text, 280) || "无正文"}`
          ].join("\n"),
          payload: {
            mail: message
          }
        })
      }

      this.emitSnapshotChanged()
      return inserted
    } catch (error) {
      console.warn("[ButlerMonitor] pullMailNow failed:", error)
      return []
    } finally {
      this.mailPollingRunning = false
    }
  }

  private scheduleTimeScan(): void {
    if (this.timeScanTimer) {
      clearInterval(this.timeScanTimer)
    }
    const intervalMs = normalizeMonitorScanIntervalMs()
    this.timeScanTimer = setInterval(() => {
      void this.scanTimeTriggers()
    }, intervalMs)
  }

  private scheduleMailPolling(): void {
    if (this.mailPollTimer) {
      clearInterval(this.mailPollTimer)
    }
    const intervalMs = normalizeMonitorPullIntervalMs()
    this.mailPollTimer = setInterval(() => {
      void this.pullMailNow("interval")
    }, intervalMs)
  }

  private async scanTimeTriggers(): Promise<void> {
    if (this.timeScanRunning) return
    this.timeScanRunning = true

    try {
      await this.scanCalendarDueSoon()
      await this.scanCountdownDue()
      this.emitSnapshotChanged()
    } catch (error) {
      console.warn("[ButlerMonitor] scanTimeTriggers failed:", error)
    } finally {
      this.timeScanRunning = false
    }
  }

  private async scanCalendarDueSoon(): Promise<void> {
    const events = this.listCalendarEvents()
    if (events.length === 0) return

    const currentTs = Date.now()
    const triggerTs = nowIso()

    for (const event of events) {
      if (!event.enabled || event.reminderSentAt) continue
      const startTs = parseIsoTime(event.startAt)
      if (!Number.isFinite(startTs)) continue
      const diff = startTs - currentTs
      if (diff <= 0 || diff > CALENDAR_DUE_SOON_MS) continue

      const updated = this.updateCalendarEvent(event.id, { reminderSentAt: triggerTs })
      await this.dispatchPerception({
        kind: "calendar_due_soon",
        title: `日历提醒：${updated.title}`,
        detail: [
          `开始时间: ${new Date(updated.startAt).toLocaleString()}`,
          updated.endAt ? `结束时间: ${new Date(updated.endAt).toLocaleString()}` : "",
          updated.location ? `地点: ${updated.location}` : "",
          updated.description ? `说明: ${updated.description}` : ""
        ]
          .filter(Boolean)
          .join("\n"),
        payload: {
          calendarEvent: updated
        }
      })
    }
  }

  private async scanCountdownDue(): Promise<void> {
    const timers = this.listCountdownTimers()
    if (timers.length === 0) return

    const currentTs = Date.now()
    const triggerTs = nowIso()

    for (const timer of timers) {
      if (timer.status !== "running" || timer.reminderSentAt) continue
      const dueTs = parseIsoTime(timer.dueAt)
      if (!Number.isFinite(dueTs)) continue
      if (dueTs > currentTs) continue

      const updated = this.updateCountdownTimer(timer.id, {
        status: "completed",
        completedAt: triggerTs,
        reminderSentAt: triggerTs
      })
      await this.dispatchPerception({
        kind: "countdown_due",
        title: `倒计时到点：${updated.title}`,
        detail: [
          `到点时间: ${new Date(updated.dueAt).toLocaleString()}`,
          updated.description ? `说明: ${updated.description}` : ""
        ]
          .filter(Boolean)
          .join("\n"),
        payload: {
          countdown: updated
        }
      })
    }
  }

  private async pullRuleMessages(client: ImapFlow, rule: MailWatchRule): Promise<MailWatchMessage[]> {
    const folder = rule.folder?.trim() || "INBOX"
    try {
      await client.mailboxOpen(folder)
    } catch (error) {
      console.warn(`[ButlerMonitor] Failed to open mailbox "${folder}" for rule "${rule.name}":`, error)
      return []
    }

    const rawUids = await client.search({ all: true })
    const uids = Array.isArray(rawUids) ? rawUids : []
    const maxUid = uids.length > 0 ? uids.reduce((max, uid) => (uid > max ? uid : max), 0) : undefined
    const previousSeenUid = rule.lastSeenUid ?? 0

    if (typeof maxUid === "number" && maxUid > previousSeenUid) {
      updateMailWatchRule(rule.id, { lastSeenUid: maxUid })
    }

    const candidateUids = uids
      .filter((uid) => uid > previousSeenUid)
      .slice(-MAX_MAIL_FETCH_PER_RULE)
    if (candidateUids.length === 0) {
      return []
    }

    const fromFilter = rule.fromContains?.trim().toLowerCase()
    const subjectFilter = rule.subjectContains?.trim().toLowerCase()
    const results: MailWatchMessage[] = []

    for await (const message of client.fetch(candidateUids as number[], {
      uid: true,
      envelope: true,
      source: true
    })) {
      if (!message.uid) continue
      if (!message.source) continue

      const parsed = await simpleParser(message.source)
      const subject = (parsed.subject ?? "").trim()
      const from = (parsed.from?.text ?? "").trim()
      const text = (parsed.text ?? "").trim()

      if (fromFilter && !from.toLowerCase().includes(fromFilter)) {
        continue
      }
      if (subjectFilter && !subject.toLowerCase().includes(subjectFilter)) {
        continue
      }

      const receivedAt = parsed.date ? parsed.date.toISOString() : nowIso()
      results.push({
        id: `${rule.id}:${message.uid}`,
        ruleId: rule.id,
        uid: message.uid,
        subject,
        from,
        text: compact(text, 4_000),
        receivedAt,
        createdAt: nowIso()
      })
    }

    return results
  }

  private async dispatchPerception(params: {
    kind: ButlerPerceptionInput["kind"]
    title: string
    detail: string
    payload: Record<string, unknown>
  }): Promise<void> {
    const input: ButlerPerceptionInput = {
      id: uuid(),
      kind: params.kind,
      triggeredAt: nowIso(),
      title: params.title,
      detail: params.detail,
      payload: params.payload,
      snapshot: this.getSnapshot()
    }

    try {
      const notice = await this.deps.perceptionGateway.ingest(input)
      this.deps.onNotice(notice)
      this.emitBusEvent({
        type: "perception_notice",
        notice,
        at: nowIso()
      })
      this.emitSnapshotChanged()
    } catch (error) {
      console.warn("[ButlerMonitor] dispatchPerception failed:", error)
    }
  }

  private emitSnapshotChanged(): void {
    this.emitBusEvent({
      type: "snapshot_changed",
      snapshot: this.getSnapshot(),
      at: nowIso()
    })
  }

  private emitBusEvent(event: ButlerMonitorBusEvent): void {
    this.deps.bus.emit(event)
  }
}
