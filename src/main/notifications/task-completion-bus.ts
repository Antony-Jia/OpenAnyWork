import { onTaskCompleted, type TaskCompletionPayload } from "../tasks/lifecycle"
import type { TaskCompletionNotice } from "../types"
import { resolveTaskIdentityFromCompletionPayload } from "./task-identity"

export interface TaskCompletionBusDeps {
  notifyButler: (notice: TaskCompletionNotice) => void
  notifyInAppCard: (notice: TaskCompletionNotice) => void
  notifyThreadHistoryUpdated: (threadId: string) => void
  shouldShowDesktopPopup: () => boolean
  enqueueDesktopPopup: (notice: TaskCompletionNotice) => void
  isTaskMuted: (taskIdentity: string) => boolean
}

const MAX_SEEN_EVENT_IDS = 5000
const TASK_DONE_THROTTLE_MS = 60_000
const MAX_THROTTLE_ENTRIES = 5000

function compact(text: string, max = 220): string {
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}

function buildEventId(payload: TaskCompletionPayload): string {
  return `${payload.threadId}:${payload.finishedAt}:${payload.source}`
}

function parseTimestampMs(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function buildThrottleKey(payload: TaskCompletionPayload): string {
  return `${payload.source}:${resolveTaskIdentityFromCompletionPayload(payload)}`
}

function buildNotice(payload: TaskCompletionPayload, taskIdentity: string): TaskCompletionNotice {
  const id = buildEventId(payload)
  const title = payload.title || "Task Completed"
  const content = payload.error ? `任务失败: ${payload.error}` : payload.result || "任务已完成。"
  const resultBrief = compact(content, 260)
  const resultDetail = [
    `任务: ${title}`,
    `模式: ${payload.mode}`,
    `来源: ${payload.source}`,
    payload.error ? `错误: ${compact(payload.error, 1200)}` : null,
    payload.result ? `结果: ${compact(payload.result, 2400)}` : null
  ]
    .filter((line): line is string => !!line)
    .join("\n")

  return {
    id,
    threadId: payload.threadId,
    title,
    resultBrief,
    resultDetail,
    completedAt: payload.finishedAt,
    mode: payload.mode,
    source: payload.source,
    noticeType: "task",
    taskIdentity
  }
}

export class TaskCompletionBus {
  private readonly seenEventIds = new Set<string>()
  private readonly seenEventOrder: string[] = []
  private readonly lastReportedAtByTask = new Map<string, number>()
  private readonly throttleOrder: Array<{ taskKey: string; atMs: number }> = []
  private unsubscribe: (() => void) | null = null

  constructor(private readonly deps: TaskCompletionBusDeps) {}

  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = onTaskCompleted((payload) => {
      this.handleCompletion(payload)
    })
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.seenEventIds.clear()
    this.seenEventOrder.length = 0
    this.lastReportedAtByTask.clear()
    this.throttleOrder.length = 0
  }

  private handleCompletion(payload: TaskCompletionPayload): void {
    const eventId = buildEventId(payload)
    if (this.seenEventIds.has(eventId)) {
      return
    }

    const throttleKey = buildThrottleKey(payload)
    const finishedAtMs = parseTimestampMs(payload.finishedAt)
    if (this.shouldThrottle(throttleKey, finishedAtMs)) {
      this.markSeen(eventId)
      return
    }

    this.markSeen(eventId)
    this.markReported(throttleKey, finishedAtMs)
    const taskIdentity = resolveTaskIdentityFromCompletionPayload(payload)
    const notice = buildNotice(payload, taskIdentity)
    const isMuted = this.deps.isTaskMuted(taskIdentity)
    if (!isMuted) {
      this.deps.notifyButler(notice)
      this.deps.notifyInAppCard(notice)
    }
    if (payload.source !== "agent") {
      this.deps.notifyThreadHistoryUpdated(payload.threadId)
    }

    if (!isMuted && this.deps.shouldShowDesktopPopup()) {
      this.deps.enqueueDesktopPopup(notice)
    }
  }

  private markSeen(eventId: string): void {
    this.seenEventIds.add(eventId)
    this.seenEventOrder.push(eventId)

    if (this.seenEventOrder.length <= MAX_SEEN_EVENT_IDS) {
      return
    }

    const staleId = this.seenEventOrder.shift()
    if (!staleId) return
    this.seenEventIds.delete(staleId)
  }

  private shouldThrottle(taskKey: string, atMs: number): boolean {
    const lastAt = this.lastReportedAtByTask.get(taskKey)
    if (lastAt === undefined) return false
    return atMs - lastAt < TASK_DONE_THROTTLE_MS
  }

  private markReported(taskKey: string, atMs: number): void {
    this.lastReportedAtByTask.set(taskKey, atMs)
    this.throttleOrder.push({ taskKey, atMs })

    while (this.throttleOrder.length > MAX_THROTTLE_ENTRIES) {
      const stale = this.throttleOrder.shift()
      if (!stale) return
      const latest = this.lastReportedAtByTask.get(stale.taskKey)
      if (latest === stale.atMs) {
        this.lastReportedAtByTask.delete(stale.taskKey)
      }
    }
  }
}
