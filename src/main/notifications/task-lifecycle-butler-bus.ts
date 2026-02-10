import {
  onTaskCompleted,
  onTaskStarted,
  type TaskCompletionPayload,
  type TaskStartedPayload
} from "../tasks/lifecycle"
import type { TaskLifecycleNotice } from "../types"

export interface TaskLifecycleButlerBusDeps {
  notifyButler: (notice: TaskLifecycleNotice) => void
}

const MAX_SEEN_EVENT_IDS = 10_000
const TASK_DONE_THROTTLE_MS = 60_000
const MAX_THROTTLE_ENTRIES = 10_000

function compact(text: string, max = 220): string {
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}...`
}

function parseTimestampMs(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function resolveStableTaskIdentity(payload: {
  metadata: Record<string, unknown>
}): string | null {
  const butlerTaskId = payload.metadata.butlerTaskId
  if (typeof butlerTaskId === "string" && butlerTaskId.trim().length > 0) {
    return `butlerTask:${butlerTaskId.trim()}`
  }

  const taskKey = payload.metadata.taskKey
  if (typeof taskKey === "string" && taskKey.trim().length > 0) {
    return `taskKey:${taskKey.trim()}`
  }

  return null
}

function resolveTaskIdentity(payload: TaskCompletionPayload): string {
  const stableIdentity = resolveStableTaskIdentity(payload)
  if (stableIdentity) {
    return stableIdentity
  }
  return `thread:${payload.threadId}`
}

function buildThrottleKey(payload: TaskCompletionPayload): string {
  return `${payload.source}:${resolveTaskIdentity(payload)}`
}

function buildStartedNotice(payload: TaskStartedPayload): TaskLifecycleNotice {
  const stableIdentity = resolveStableTaskIdentity(payload)
  const id = stableIdentity
    ? `${payload.source}:${stableIdentity}:started`
    : `${payload.threadId}:${payload.startedAt}:${payload.source}:started`
  return {
    id,
    phase: "started",
    threadId: payload.threadId,
    title: payload.title || "Task Started",
    mode: payload.mode,
    source: payload.source,
    at: payload.startedAt,
    resultBrief: "任务已开始执行。"
  }
}

function buildCompletedNotice(payload: TaskCompletionPayload): TaskLifecycleNotice {
  const id = `${payload.threadId}:${payload.finishedAt}:${payload.source}:completed`
  const content = payload.error ? `任务失败: ${payload.error}` : payload.result || "任务已完成。"
  const resultBrief = compact(content, 260)
  const resultDetail = [
    `任务: ${payload.title || "Task Completed"}`,
    `模式: ${payload.mode}`,
    `来源: ${payload.source}`,
    payload.error ? `错误: ${compact(payload.error, 1200)}` : null,
    payload.result ? `结果: ${compact(payload.result, 2400)}` : null
  ]
    .filter((line): line is string => !!line)
    .join("\n")

  return {
    id,
    phase: "completed",
    threadId: payload.threadId,
    title: payload.title || "Task Completed",
    mode: payload.mode,
    source: payload.source,
    at: payload.finishedAt,
    resultBrief,
    resultDetail
  }
}

export class TaskLifecycleButlerBus {
  private readonly seenEventIds = new Set<string>()
  private readonly seenEventOrder: string[] = []
  private readonly lastReportedAtByTask = new Map<string, number>()
  private readonly throttleOrder: Array<{ taskKey: string; atMs: number }> = []
  private unsubscribeStarted: (() => void) | null = null
  private unsubscribeCompleted: (() => void) | null = null

  constructor(private readonly deps: TaskLifecycleButlerBusDeps) {}

  start(): void {
    if (this.unsubscribeStarted || this.unsubscribeCompleted) return
    this.unsubscribeStarted = onTaskStarted((payload) => {
      this.handleNotice(buildStartedNotice(payload))
    })
    this.unsubscribeCompleted = onTaskCompleted((payload) => {
      const notice = buildCompletedNotice(payload)
      if (this.shouldThrottleCompletion(payload)) {
        this.markSeen(notice.id)
        return
      }
      this.handleNotice(notice)
    })
  }

  stop(): void {
    if (this.unsubscribeStarted) {
      this.unsubscribeStarted()
      this.unsubscribeStarted = null
    }
    if (this.unsubscribeCompleted) {
      this.unsubscribeCompleted()
      this.unsubscribeCompleted = null
    }
    this.seenEventIds.clear()
    this.seenEventOrder.length = 0
    this.lastReportedAtByTask.clear()
    this.throttleOrder.length = 0
  }

  private handleNotice(notice: TaskLifecycleNotice): void {
    if (this.seenEventIds.has(notice.id)) return
    this.markSeen(notice.id)
    this.deps.notifyButler(notice)
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

  private shouldThrottleCompletion(payload: TaskCompletionPayload): boolean {
    const taskKey = buildThrottleKey(payload)
    const finishedAtMs = parseTimestampMs(payload.finishedAt)
    const lastAt = this.lastReportedAtByTask.get(taskKey)
    if (lastAt !== undefined && finishedAtMs - lastAt < TASK_DONE_THROTTLE_MS) {
      return true
    }

    this.lastReportedAtByTask.set(taskKey, finishedAtMs)
    this.throttleOrder.push({ taskKey, atMs: finishedAtMs })

    while (this.throttleOrder.length > MAX_THROTTLE_ENTRIES) {
      const stale = this.throttleOrder.shift()
      if (!stale) return false
      const latest = this.lastReportedAtByTask.get(stale.taskKey)
      if (latest === stale.atMs) {
        this.lastReportedAtByTask.delete(stale.taskKey)
      }
    }
    return false
  }
}
