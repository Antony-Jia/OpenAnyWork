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

function compact(text: string, max = 220): string {
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}...`
}

function buildStartedNotice(payload: TaskStartedPayload): TaskLifecycleNotice {
  const id = `${payload.threadId}:${payload.startedAt}:${payload.source}:started`
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
  private unsubscribeStarted: (() => void) | null = null
  private unsubscribeCompleted: (() => void) | null = null

  constructor(private readonly deps: TaskLifecycleButlerBusDeps) {}

  start(): void {
    if (this.unsubscribeStarted || this.unsubscribeCompleted) return
    this.unsubscribeStarted = onTaskStarted((payload) => {
      this.handleNotice(buildStartedNotice(payload))
    })
    this.unsubscribeCompleted = onTaskCompleted((payload) => {
      this.handleNotice(buildCompletedNotice(payload))
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
}
