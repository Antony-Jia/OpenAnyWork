import { v4 as uuid } from "uuid"
import type {
  ButlerDigestPayload,
  ButlerDigestTaskCard,
  ButlerTaskStatus,
  TaskCompletionNotice,
  TaskLifecycleNotice
} from "../types"
import { getSettings } from "../settings"
import { resolveTaskIdentityFromLifecycleNotice } from "./task-identity"

interface ButlerDigestServiceDeps {
  notifyButler: (notice: TaskCompletionNotice) => void
  notifyInAppCard: (notice: TaskCompletionNotice) => void
  isTaskMuted: (taskIdentity: string) => boolean
  getButlerMainThreadId: () => string
  summarize: (input: {
    windowStart: string
    windowEnd: string
    tasks: ButlerDigestTaskCard[]
  }) => Promise<string>
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeIntervalMin(): number {
  const raw = getSettings().butler?.serviceDigestIntervalMin
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 1
  }
  if (raw <= 0) {
    return 0
  }
  return Math.max(1, Math.round(raw))
}

function inferTaskStatus(notice: TaskLifecycleNotice): ButlerTaskStatus {
  if (notice.phase === "started") {
    return "running"
  }
  const text = `${notice.resultBrief || ""}\n${notice.resultDetail || ""}`.toLowerCase()
  if (text.includes("任务失败") || text.includes("错误:") || text.includes("failed")) {
    return "failed"
  }
  return "completed"
}

function compact(text: string, max = 220): string {
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}

function buildFallbackSummary(tasks: ButlerDigestTaskCard[]): string {
  const running = tasks.filter((task) => task.status === "running").length
  const completed = tasks.filter((task) => task.status === "completed").length
  const failed = tasks.filter((task) => task.status === "failed").length
  const cancelled = tasks.filter((task) => task.status === "cancelled").length
  const keyTitles = tasks
    .slice(0, 5)
    .map((task, index) => `${index + 1}. ${task.title}（${task.status}）`)
    .join("；")
  const parts = [
    `本时段任务更新 ${tasks.length} 项`,
    `完成 ${completed} 项`,
    `运行中 ${running} 项`,
    failed > 0 ? `失败 ${failed} 项` : "",
    cancelled > 0 ? `取消 ${cancelled} 项` : "",
    keyTitles ? `重点任务：${keyTitles}` : ""
  ].filter(Boolean)

  return `${parts.join("，")}。`
}

function buildResultDetail(payload: ButlerDigestPayload): string {
  const taskLines = payload.tasks.map(
    (task, index) =>
      `${index + 1}. [${task.status}] ${task.title}\n` +
      `模式: ${task.mode} | 来源: ${task.source}\n` +
      `线程: ${task.threadId}\n` +
      `摘要: ${task.resultBrief || "暂无摘要"}`
  )

  return [
    `时间窗: ${new Date(payload.windowStart).toLocaleString()} - ${new Date(payload.windowEnd).toLocaleString()}`,
    `任务数: ${payload.tasks.length}`,
    "",
    payload.summaryText,
    "",
    "[任务更新清单]",
    ...taskLines
  ].join("\n")
}

export class ButlerDigestService {
  private started = false
  private timer: NodeJS.Timeout | null = null
  private windowStart: string | null = null
  private readonly tasksByIdentity = new Map<string, ButlerDigestTaskCard>()
  private flushing = false
  private flushPending = false

  constructor(private readonly deps: ButlerDigestServiceDeps) {}

  start(): void {
    if (this.started) return
    this.started = true
    this.refreshInterval()
  }

  stop(): void {
    this.started = false
    this.clearTimer()
    this.tasksByIdentity.clear()
    this.windowStart = null
    this.flushing = false
    this.flushPending = false
  }

  refreshInterval(): void {
    this.clearTimer()
    if (!this.started) return
    const intervalMin = normalizeIntervalMin()
    if (intervalMin === 0) {
      if (this.tasksByIdentity.size > 0) {
        void this.flush("realtime")
      }
      return
    }
    this.timer = setInterval(() => {
      void this.flush("interval")
    }, intervalMin * 60_000)
  }

  ingest(notice: TaskLifecycleNotice): void {
    if (!this.started) return
    const taskIdentity = resolveTaskIdentityFromLifecycleNotice(notice)
    if (!taskIdentity || this.deps.isTaskMuted(taskIdentity)) {
      return
    }

    if (!this.windowStart) {
      this.windowStart = notice.at || nowIso()
    }

    const resultBrief =
      notice.resultBrief || (notice.phase === "started" ? "任务已开始执行。" : "任务已完成。")
    this.tasksByIdentity.set(taskIdentity, {
      taskIdentity,
      threadId: notice.threadId,
      title: notice.title,
      status: inferTaskStatus(notice),
      mode: notice.mode,
      source: notice.source,
      updatedAt: notice.at || nowIso(),
      resultBrief: compact(resultBrief, 260),
      resultDetail: notice.resultDetail
    })

    if (normalizeIntervalMin() === 0) {
      void this.flush("realtime")
    }
  }

  removeTaskIdentity(taskIdentity: string): void {
    const normalized = taskIdentity.trim()
    if (!normalized) return
    this.tasksByIdentity.delete(normalized)
  }

  private async flush(reason: "interval" | "realtime"): Promise<void> {
    if (this.flushing) {
      this.flushPending = true
      return
    }
    if (this.tasksByIdentity.size === 0) return

    this.flushing = true
    try {
      const windowStart = this.windowStart || nowIso()
      const windowEnd = nowIso()
      const tasks = Array.from(this.tasksByIdentity.values()).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )

      this.tasksByIdentity.clear()
      this.windowStart = null

      let summaryText = ""
      try {
        summaryText = (await this.deps.summarize({ windowStart, windowEnd, tasks })).trim()
      } catch (error) {
        console.warn(`[ButlerDigest] summarize failed (${reason}):`, error)
      }

      if (!summaryText) {
        summaryText = buildFallbackSummary(tasks)
      }

      const payload: ButlerDigestPayload = {
        id: `digest:${uuid()}`,
        windowStart,
        windowEnd,
        summaryText,
        tasks
      }

      const title = `管家服务总结（${tasks.length} 项更新）`
      const notice: TaskCompletionNotice = {
        id: payload.id,
        threadId: this.deps.getButlerMainThreadId() || tasks[0]?.threadId || "",
        title,
        resultBrief: summaryText,
        resultDetail: buildResultDetail(payload),
        completedAt: payload.windowEnd,
        mode: "butler",
        source: "butler",
        noticeType: "digest",
        digest: payload
      }

      this.deps.notifyButler(notice)
      this.deps.notifyInAppCard(notice)
    } finally {
      this.flushing = false
      if (this.flushPending) {
        this.flushPending = false
        if (this.tasksByIdentity.size > 0) {
          void this.flush("realtime")
        }
      }
    }
  }

  private clearTimer(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }
}
