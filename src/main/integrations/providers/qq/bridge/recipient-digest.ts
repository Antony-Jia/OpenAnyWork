import type { ButlerDigestTaskCard, QQExternalSourceInfo, TaskLifecycleNotice } from "../../../../types"
import { resolveTaskIdentityFromLifecycleNotice } from "../../../../notifications/task-identity"
import { getSettings } from "../../../../settings"

interface QQRecipientDigestLogger {
  warn(message: string): void
}

interface QQRecipientDigestServiceDeps {
  summarize: (input: {
    windowStart: string
    windowEnd: string
    tasks: ButlerDigestTaskCard[]
  }) => Promise<string>
  send: (externalSource: QQExternalSourceInfo, text: string) => Promise<void>
  logger: QQRecipientDigestLogger
}

interface QQRecipientDigestBucket {
  externalSource: QQExternalSourceInfo
  windowStart: string | null
  tasksByIdentity: Map<string, ButlerDigestTaskCard>
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

function compact(text: string, max = 220): string {
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}...`
}

function inferTaskStatus(notice: TaskLifecycleNotice): ButlerDigestTaskCard["status"] {
  if (notice.phase === "started") {
    return "running"
  }
  const text = `${notice.resultBrief || ""}\n${notice.resultDetail || ""}`.toLowerCase()
  if (text.includes("任务失败") || text.includes("错误:") || text.includes("failed")) {
    return "failed"
  }
  return "completed"
}

function buildRecipientKey(externalSource: QQExternalSourceInfo): string {
  const target = externalSource.replyTarget
  return [
    externalSource.senderOpenId,
    target.scene,
    target.userId || "",
    target.groupId || "",
    target.channelId || "",
    target.guildId || ""
  ].join(":")
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

function buildDigestText(summaryText: string, tasks: ButlerDigestTaskCard[]): string {
  const lines = [`管家服务总结（${tasks.length} 项更新）`, summaryText, "", "[任务更新清单]"]
  for (const [index, task] of tasks.entries()) {
    lines.push(`${index + 1}. [${task.status}] ${task.title}`)
    lines.push(`模式: ${task.mode} | 来源: ${task.source}`)
    lines.push(`线程: ${task.threadId}`)
    lines.push(`摘要: ${task.resultBrief || "暂无摘要"}`)
  }
  return lines.join("\n")
}

export class QQRecipientDigestService {
  private started = false
  private timer: NodeJS.Timeout | null = null
  private readonly buckets = new Map<string, QQRecipientDigestBucket>()
  private readonly flushingKeys = new Set<string>()
  private readonly pendingKeys = new Set<string>()

  constructor(private readonly deps: QQRecipientDigestServiceDeps) {}

  start(): void {
    if (this.started) return
    this.started = true
    this.refreshInterval()
  }

  stop(): void {
    this.started = false
    this.clearTimer()
    this.buckets.clear()
    this.flushingKeys.clear()
    this.pendingKeys.clear()
  }

  refreshInterval(): void {
    this.clearTimer()
    if (!this.started) return
    const intervalMin = normalizeIntervalMin()
    if (intervalMin === 0) {
      for (const key of this.buckets.keys()) {
        void this.flushKey(key, "realtime")
      }
      return
    }
    this.timer = setInterval(() => {
      for (const key of this.buckets.keys()) {
        void this.flushKey(key, "interval")
      }
    }, intervalMin * 60_000)
  }

  ingest(notice: TaskLifecycleNotice, externalSource: QQExternalSourceInfo): void {
    if (!this.started) return
    const recipientKey = buildRecipientKey(externalSource)
    const bucket =
      this.buckets.get(recipientKey) ??
      ({
        externalSource,
        windowStart: null,
        tasksByIdentity: new Map<string, ButlerDigestTaskCard>()
      } satisfies QQRecipientDigestBucket)

    if (!bucket.windowStart) {
      bucket.windowStart = notice.at || nowIso()
    }
    bucket.externalSource = externalSource

    const taskIdentity = resolveTaskIdentityFromLifecycleNotice(notice)
    const resultBrief =
      notice.resultBrief || (notice.phase === "started" ? "任务已开始执行。" : "任务已完成。")
    bucket.tasksByIdentity.set(taskIdentity, {
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
    this.buckets.set(recipientKey, bucket)

    if (normalizeIntervalMin() === 0) {
      void this.flushKey(recipientKey, "realtime")
    }
  }

  private async flushKey(key: string, reason: "interval" | "realtime"): Promise<void> {
    if (this.flushingKeys.has(key)) {
      this.pendingKeys.add(key)
      return
    }
    const bucket = this.buckets.get(key)
    if (!bucket || bucket.tasksByIdentity.size === 0) return

    this.flushingKeys.add(key)
    try {
      const windowStart = bucket.windowStart || nowIso()
      const windowEnd = nowIso()
      const tasks = Array.from(bucket.tasksByIdentity.values()).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )

      bucket.tasksByIdentity.clear()
      bucket.windowStart = null

      let summaryText = ""
      try {
        summaryText = (
          await this.deps.summarize({
            windowStart,
            windowEnd,
            tasks
          })
        ).trim()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.deps.logger.warn(`qq recipient digest summarize failed (${reason}): ${message}`)
      }
      if (!summaryText) {
        summaryText = buildFallbackSummary(tasks)
      }

      await this.deps.send(bucket.externalSource, buildDigestText(summaryText, tasks))
    } finally {
      this.flushingKeys.delete(key)
      if (this.pendingKeys.has(key)) {
        this.pendingKeys.delete(key)
        const nextBucket = this.buckets.get(key)
        if (nextBucket && nextBucket.tasksByIdentity.size > 0) {
          void this.flushKey(key, "realtime")
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
