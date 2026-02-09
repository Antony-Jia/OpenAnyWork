import { onTaskCompleted, type TaskCompletionPayload } from "../tasks/lifecycle"
import type { TaskCompletionNotice } from "../types"

export interface TaskCompletionBusDeps {
  notifyButler: (notice: TaskCompletionNotice) => void
  notifyInAppCard: (notice: TaskCompletionNotice) => void
  notifyThreadHistoryUpdated: (threadId: string) => void
  shouldShowDesktopPopup: () => boolean
  enqueueDesktopPopup: (notice: TaskCompletionNotice) => void
}

const MAX_SEEN_EVENT_IDS = 5000

function compact(text: string, max = 220): string {
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}

function buildEventId(payload: TaskCompletionPayload): string {
  return `${payload.threadId}:${payload.finishedAt}:${payload.source}`
}

function buildNotice(payload: TaskCompletionPayload): TaskCompletionNotice {
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
    source: payload.source
  }
}

export class TaskCompletionBus {
  private readonly seenEventIds = new Set<string>()
  private readonly seenEventOrder: string[] = []
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
  }

  private handleCompletion(payload: TaskCompletionPayload): void {
    const eventId = buildEventId(payload)
    if (this.seenEventIds.has(eventId)) {
      return
    }

    this.markSeen(eventId)
    const notice = buildNotice(payload)
    this.deps.notifyButler(notice)
    this.deps.notifyInAppCard(notice)
    if (payload.source !== "agent") {
      this.deps.notifyThreadHistoryUpdated(payload.threadId)
    }

    if (this.deps.shouldShowDesktopPopup()) {
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
}
