import { v4 as uuid } from "uuid"
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import Parser from "rss-parser"
import { getSettings } from "../../settings"
import type {
  ButlerMonitorSnapshot,
  ButlerMonitorBusEvent,
  ButlerMonitorPullResult,
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
  RssWatchItem,
  RssWatchSubscription,
  RssWatchSubscriptionCreateInput,
  RssWatchSubscriptionUpdateInput,
  TaskCompletionNotice
} from "../../types"
import type { ButlerPerceptionGateway } from "../perception"
import {
  createCalendarWatchEvent,
  createCountdownWatchItem,
  createMailWatchRule,
  createRssWatchSubscription,
  deleteCalendarWatchEvent,
  deleteCountdownWatchItem,
  deleteMailWatchRule,
  deleteRssWatchSubscription,
  insertMailWatchMessages,
  insertRssWatchItems,
  listCalendarWatchEvents,
  listCountdownWatchItems,
  listMailWatchRules,
  listRecentMailWatchMessages,
  listRecentRssWatchItems,
  listRssWatchSubscriptions,
  updateCalendarWatchEvent,
  updateCountdownWatchItem,
  updateMailWatchRule,
  updateRssWatchSubscription
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

interface NormalizedRssItem {
  itemKey: string
  title: string
  link: string
  summary: string
  publishedAt: string
}

interface MailboxQueryInput {
  mode?: "today" | "latest"
  limit?: number
  unreadOnly?: boolean
  folder?: string
}

const CALENDAR_DUE_SOON_MS = 2 * 60 * 60 * 1000
const MAX_MAIL_FETCH_PER_RULE = 30
const MAX_RSS_FETCH_PER_SUBSCRIPTION = 30

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

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }
  return Math.min(max, Math.max(1, Math.round(value)))
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

function normalizeRssValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized || undefined
}

function toIsoFromUnknownDate(value: unknown): string | undefined {
  const dateText = normalizeRssValue(value)
  if (!dateText) return undefined
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

function toRssItemKey(item: Parser.Item): string | undefined {
  const guid = normalizeRssValue((item as { guid?: unknown }).guid)
  if (guid) return guid

  const id = normalizeRssValue((item as { id?: unknown }).id)
  if (id) return id

  const link = normalizeRssValue(item.link)
  if (link) return link

  const title = normalizeRssValue(item.title)
  const publishedToken =
    normalizeRssValue(item.isoDate) ??
    normalizeRssValue((item as { pubDate?: unknown }).pubDate) ??
    normalizeRssValue((item as { date?: unknown }).date)

  if (title && publishedToken) {
    return `${title}::${publishedToken}`
  }
  return undefined
}

function normalizeRssItem(item: Parser.Item): NormalizedRssItem | null {
  const itemKey = toRssItemKey(item)
  if (!itemKey) return null

  const publishedAt =
    toIsoFromUnknownDate(item.isoDate) ??
    toIsoFromUnknownDate((item as { pubDate?: unknown }).pubDate) ??
    toIsoFromUnknownDate((item as { date?: unknown }).date) ??
    nowIso()

  return {
    itemKey,
    title: normalizeRssValue(item.title) || "(无标题)",
    link: normalizeRssValue(item.link) || "",
    summary:
      normalizeRssValue(item.contentSnippet) ||
      normalizeRssValue((item as { summary?: unknown }).summary) ||
      normalizeRssValue((item as { content?: unknown }).content) ||
      "",
    publishedAt
  }
}

function sortRssItemsNewestFirst(items: NormalizedRssItem[]): NormalizedRssItem[] {
  return items.sort((a, b) => {
    const diff = parseIsoTime(b.publishedAt) - parseIsoTime(a.publishedAt)
    if (Number.isFinite(diff) && diff !== 0) return diff
    return a.itemKey.localeCompare(b.itemKey)
  })
}

export class ButlerMonitorManager {
  private started = false
  private timeScanTimer: NodeJS.Timeout | null = null
  private pullTimer: NodeJS.Timeout | null = null
  private timeScanRunning = false
  private pullRunning = false
  private readonly rssParser = new Parser()

  constructor(private readonly deps: ButlerMonitorManagerDeps) {}

  start(): void {
    if (this.started) return
    this.started = true
    this.scheduleTimeScan()
    this.schedulePulling()
    void this.scanTimeTriggers()
    void this.pullNow("startup")
    this.emitSnapshotChanged()
  }

  stop(): void {
    this.started = false
    if (this.timeScanTimer) {
      clearInterval(this.timeScanTimer)
      this.timeScanTimer = null
    }
    if (this.pullTimer) {
      clearInterval(this.pullTimer)
      this.pullTimer = null
    }
  }

  refreshIntervals(): void {
    if (!this.started) return
    this.scheduleTimeScan()
    this.schedulePulling()
  }

  getSnapshot(): ButlerMonitorSnapshot {
    return {
      calendarEvents: this.listCalendarEvents(),
      countdownTimers: this.listCountdownTimers(),
      mailRules: this.listMailRules(),
      recentMails: this.listRecentMails(20),
      rssSubscriptions: this.listRssSubscriptions(),
      recentRssItems: this.listRecentRssItems(20)
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
    void this.pullNow("rule_update")
    this.emitSnapshotChanged()
    return rule
  }

  updateMailRule(id: string, updates: MailWatchRuleUpdateInput): MailWatchRule {
    const rule = updateMailWatchRule(id, updates)
    void this.pullNow("rule_update")
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

  listRssSubscriptions(): RssWatchSubscription[] {
    return listRssWatchSubscriptions()
  }

  createRssSubscription(input: RssWatchSubscriptionCreateInput): RssWatchSubscription {
    const subscription = createRssWatchSubscription(input)
    void this.pullNow("rule_update")
    this.emitSnapshotChanged()
    return subscription
  }

  updateRssSubscription(
    id: string,
    updates: RssWatchSubscriptionUpdateInput
  ): RssWatchSubscription {
    const subscription = updateRssWatchSubscription(id, updates)
    void this.pullNow("rule_update")
    this.emitSnapshotChanged()
    return subscription
  }

  deleteRssSubscription(id: string): void {
    deleteRssWatchSubscription(id)
    this.emitSnapshotChanged()
  }

  listRecentRssItems(limit = 20): RssWatchItem[] {
    return listRecentRssWatchItems(limit)
  }

  async pullNow(
    source: "manual" | "interval" | "startup" | "rule_update" = "manual"
  ): Promise<ButlerMonitorPullResult> {
    const { mailInserted, rssInserted } = await this.pullNowInternal(source)
    return {
      mailCount: mailInserted.length,
      rssCount: rssInserted.length
    }
  }

  async pullMailNow(
    source: "manual" | "interval" | "startup" | "rule_update" = "manual"
  ): Promise<MailWatchMessage[]> {
    const { mailInserted } = await this.pullNowInternal(source)
    return mailInserted
  }

  async pullRssNow(
    source: "manual" | "interval" | "startup" | "rule_update" = "manual"
  ): Promise<RssWatchItem[]> {
    this.emitBusEvent({
      type: "pull_requested",
      source,
      at: nowIso()
    })

    if (this.pullRunning) {
      return []
    }
    this.pullRunning = true

    try {
      const rssInserted = await this.pullRssInternal()
      await this.dispatchRssPerceptions(rssInserted)
      this.emitSnapshotChanged()
      return rssInserted
    } catch (error) {
      console.warn("[ButlerMonitor] pullRssNow failed:", error)
      this.emitSnapshotChanged()
      return []
    } finally {
      this.pullRunning = false
    }
  }

  async queryMailboxNow(input: MailboxQueryInput): Promise<MailWatchMessage[]> {
    const settings = normalizeMailSettings()
    if (!settings) {
      return []
    }

    const mode = input.mode === "today" ? "today" : "latest"
    const limit = clampLimit(input.limit, 10, 100)
    const unreadOnly = input.unreadOnly === true
    const folder = input.folder?.trim() || "INBOX"
    const createdAt = nowIso()
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

    try {
      await client.connect()
      await client.mailboxOpen(folder, { readOnly: true })

      const searchQuery: Record<string, unknown> = {}
      if (mode === "today") {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        searchQuery.since = today
      }
      if (unreadOnly) {
        searchQuery.seen = false
      }
      if (!("since" in searchQuery) && !("seen" in searchQuery)) {
        searchQuery.all = true
      }

      const rawUids = await client.search(searchQuery)
      const uids = Array.isArray(rawUids) ? rawUids : []
      if (uids.length === 0) {
        return []
      }

      const candidateUids = uids.slice(-limit).sort((a, b) => a - b)
      const rows: MailWatchMessage[] = []
      for await (const message of client.fetch(candidateUids, {
        uid: true,
        source: true
      })) {
        if (!message.uid || !message.source) continue
        const parsed = await simpleParser(message.source)
        const subject = (parsed.subject ?? "").trim()
        const from = (parsed.from?.text ?? "").trim()
        const text = (parsed.text ?? "").trim()
        const receivedAt = parsed.date ? parsed.date.toISOString() : createdAt
        rows.push({
          id: `query:${mode}:${message.uid}`,
          ruleId: "manual-query",
          uid: message.uid,
          subject,
          from,
          text: compact(text, 4_000),
          receivedAt,
          createdAt
        })
      }

      return rows.sort((a, b) => parseIsoTime(b.receivedAt) - parseIsoTime(a.receivedAt))
    } catch (error) {
      console.warn("[ButlerMonitor] queryMailboxNow failed:", error)
      return []
    } finally {
      try {
        await client.logout()
      } catch {
        // noop
      }
    }
  }

  private async pullNowInternal(source: "manual" | "interval" | "startup" | "rule_update"): Promise<{
    mailInserted: MailWatchMessage[]
    rssInserted: RssWatchItem[]
  }> {
    this.emitBusEvent({
      type: "pull_requested",
      source,
      at: nowIso()
    })

    if (this.pullRunning) {
      return { mailInserted: [], rssInserted: [] }
    }
    this.pullRunning = true

    try {
      let mailInserted: MailWatchMessage[] = []
      let rssInserted: RssWatchItem[] = []

      try {
        mailInserted = await this.pullMailInternal()
      } catch (error) {
        console.warn("[ButlerMonitor] pull mail failed:", error)
      }

      try {
        rssInserted = await this.pullRssInternal()
      } catch (error) {
        console.warn("[ButlerMonitor] pull rss failed:", error)
      }

      await this.dispatchMailPerceptions(mailInserted)
      await this.dispatchRssPerceptions(rssInserted)

      this.emitSnapshotChanged()
      return { mailInserted, rssInserted }
    } catch (error) {
      console.warn("[ButlerMonitor] pullNow failed:", error)
      this.emitSnapshotChanged()
      return { mailInserted: [], rssInserted: [] }
    } finally {
      this.pullRunning = false
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

  private schedulePulling(): void {
    if (this.pullTimer) {
      clearInterval(this.pullTimer)
    }
    const intervalMs = normalizeMonitorPullIntervalMs()
    this.pullTimer = setInterval(() => {
      void this.pullNow("interval")
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

  private async pullMailInternal(): Promise<MailWatchMessage[]> {
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
      return []
    }

    return insertMailWatchMessages(fetchedMessages)
  }

  private async pullRssInternal(): Promise<RssWatchItem[]> {
    const subscriptions = this.listRssSubscriptions().filter((subscription) => subscription.enabled)
    if (subscriptions.length === 0) {
      return []
    }

    const fetchedItems: RssWatchItem[] = []
    for (const subscription of subscriptions) {
      try {
        const items = await this.pullSubscriptionItems(subscription)
        fetchedItems.push(...items)
      } catch (error) {
        console.warn(
          `[ButlerMonitor] Failed to pull RSS subscription "${subscription.name}" (${subscription.feedUrl}):`,
          error
        )
      }
    }
    return fetchedItems
  }

  private async pullSubscriptionItems(subscription: RssWatchSubscription): Promise<RssWatchItem[]> {
    const feed = await this.rssParser.parseURL(subscription.feedUrl)
    const rawItems = Array.isArray(feed.items) ? feed.items : []
    const normalizedMap = new Map<string, NormalizedRssItem>()

    for (const rawItem of rawItems) {
      const normalized = normalizeRssItem(rawItem)
      if (!normalized) continue

      const existing = normalizedMap.get(normalized.itemKey)
      if (!existing) {
        normalizedMap.set(normalized.itemKey, normalized)
        continue
      }

      if (parseIsoTime(normalized.publishedAt) > parseIsoTime(existing.publishedAt)) {
        normalizedMap.set(normalized.itemKey, normalized)
      }
    }

    const ordered = sortRssItemsNewestFirst([...normalizedMap.values()])
    const pulledAt = nowIso()
    if (ordered.length === 0) {
      updateRssWatchSubscription(subscription.id, { lastPulledAt: pulledAt })
      return []
    }

    const latest = ordered[0]
    if (!subscription.lastSeenItemKey) {
      updateRssWatchSubscription(subscription.id, {
        lastSeenItemKey: latest.itemKey,
        lastSeenPublishedAt: latest.publishedAt,
        lastPulledAt: pulledAt
      })
      return []
    }

    let newCandidates: NormalizedRssItem[] = []
    const cursorIndex = ordered.findIndex((item) => item.itemKey === subscription.lastSeenItemKey)
    if (cursorIndex >= 0) {
      newCandidates = ordered.slice(0, cursorIndex)
    } else if (subscription.lastSeenPublishedAt) {
      const cursorTime = parseIsoTime(subscription.lastSeenPublishedAt)
      if (Number.isFinite(cursorTime)) {
        newCandidates = ordered.filter((item) => parseIsoTime(item.publishedAt) > cursorTime)
      }
    }

    const limitedCandidates = newCandidates.slice(0, MAX_RSS_FETCH_PER_SUBSCRIPTION)
    const inserted = insertRssWatchItems(
      limitedCandidates.map((item) => ({
        id: uuid(),
        subscriptionId: subscription.id,
        itemKey: item.itemKey,
        title: item.title,
        link: item.link,
        summary: compact(item.summary, 4_000),
        publishedAt: item.publishedAt,
        createdAt: pulledAt
      }))
    )

    updateRssWatchSubscription(subscription.id, {
      lastSeenItemKey: latest.itemKey,
      lastSeenPublishedAt: latest.publishedAt,
      lastPulledAt: pulledAt
    })

    return inserted
  }

  private async pullRuleMessages(
    client: ImapFlow,
    rule: MailWatchRule
  ): Promise<MailWatchMessage[]> {
    const folder = rule.folder?.trim() || "INBOX"
    try {
      await client.mailboxOpen(folder)
    } catch (error) {
      console.warn(
        `[ButlerMonitor] Failed to open mailbox "${folder}" for rule "${rule.name}":`,
        error
      )
      return []
    }

    const rawUids = await client.search({ all: true })
    const uids = Array.isArray(rawUids) ? rawUids : []
    const maxUid =
      uids.length > 0 ? uids.reduce((max, uid) => (uid > max ? uid : max), 0) : undefined
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

  private async dispatchMailPerceptions(mailInserted: MailWatchMessage[]): Promise<void> {
    for (const message of mailInserted) {
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
  }

  private async dispatchRssPerceptions(rssInserted: RssWatchItem[]): Promise<void> {
    const subscriptionMap = new Map(
      this.listRssSubscriptions().map((subscription) => [subscription.id, subscription])
    )
    for (const item of rssInserted) {
      const subscription = subscriptionMap.get(item.subscriptionId)
      await this.dispatchPerception({
        kind: "rss_new",
        title: `RSS更新：${item.title || "(无标题)"}`,
        detail: [
          `订阅: ${subscription?.name || "未知订阅"}`,
          `发布时间: ${new Date(item.publishedAt).toLocaleString()}`,
          item.link ? `链接: ${item.link}` : "",
          `摘要: ${compact(item.summary, 280) || "无摘要"}`
        ]
          .filter(Boolean)
          .join("\n"),
        payload: {
          rssItem: item,
          rssSubscription: subscription
        }
      })
    }
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
