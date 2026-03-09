import { BrowserWindow } from "electron"
import { existsSync, mkdirSync, statSync, writeFileSync } from "fs"
import { isAbsolute, join, resolve } from "path"
import { v4 as uuid } from "uuid"
import {
  createThread as dbCreateThread,
  getAllThreads,
  updateThread as dbUpdateThread
} from "../db"
import { getSettings } from "../settings"
import {
  emitTaskCompleted,
  emitTaskStarted,
  onTaskCompleted,
  type TaskCompletionPayload
} from "../tasks/lifecycle"
import {
  appendButlerHistoryMessage,
  clearButlerHistoryMessages,
  getRangeSummary,
  getWorkingMemorySnapshot,
  getLatestDailyProfile,
  loadButlerMessages,
  loadButlerTasks,
  persistButlerTask,
  removeButlerTasks,
  searchMemory,
  searchMemoryByTask
} from "../memory"
import { broadcastThreadsChanged } from "../ipc/events"
import {
  buildCapabilityPromptBlock,
  buildCapabilitySummaryLine,
  getButlerCapabilitySnapshot
} from "./capabilities"
import { detectOversplitByModel } from "./granularity"
import {
  runButlerDirectReplyTurn,
  runButlerDigestTurn,
  runButlerOrchestratorTurn,
  runButlerPerceptionTurn,
  runButlerTaskCommentTurn
} from "./runtime"
import type { ButlerPromptContext } from "./prompt"
import { createButlerTaskThread, executeButlerTask } from "./task-dispatcher"
import { renderTaskPrompt, type ButlerDispatchIntent } from "./tools"
import { notificationMuteRegistry } from "../notifications/mute-registry"
import type {
  ButlerExternalSendInput,
  ButlerExternalSendResult,
  ButlerDigestTaskCard,
  ButlerPerceptionInput,
  QQExternalSourceInfo,
  TaskLifecycleNotice,
  ButlerRound,
  ButlerTask,
  ButlerState,
  ButlerTaskStatus,
  TaskCompletionNotice,
  ThreadMode
} from "../types"

interface ButlerMessage {
  id: string
  role: "user" | "assistant"
  content: string
  ts: string
  kind?: ButlerRound["kind"]
  sourceType?: ButlerRound["sourceType"]
  relatedThreadId?: string
  relatedTaskId?: string
  noticeType?: ButlerRound["noticeType"]
  metadata?: Record<string, unknown>
}

interface PendingTask {
  taskId: string
}

interface SendMessageParams {
  rawMessage: string
  storedMessage?: string
  metadata?: Record<string, unknown>
}

interface PerceptionDispatchedTaskResult {
  taskPrompt: string
  assistantText: string
  tasks: ButlerTask[]
  notes: string[]
}

type PerceptionDispatchResult =
  | { status: "skipped" }
  | { status: "failed"; taskPrompt: string; error: string }
  | ({ status: "dispatched" } & PerceptionDispatchedTaskResult)

interface DispatchTaskCreationContext {
  originUserMessage: string
  habitAddendum: string
  retryOfTaskId?: string
  retryAttempt?: number
  preferredReuseThreadByTaskKey?: Record<string, string>
  externalSource?: QQExternalSourceInfo
}

interface PendingDispatchOption {
  kind: "dispatch" | "cancel"
  intents: ButlerDispatchIntent[]
  assistantText: string
  summary: string
  capabilitySummary: string
  creation: DispatchTaskCreationContext
  missingWorkspacePaths?: string[]
}

interface OversplitPendingDispatchChoiceState {
  kind: "oversplit_ab"
  id: string
  createdAt: string
  hint: string
  expectedResponse: "ab"
  promptText: string
  reason: string
  confidence: number
  optionA: PendingDispatchOption
  optionB: PendingDispatchOption
}

interface RetryConfirmPendingDispatchChoiceState {
  kind: "retry_confirm"
  id: string
  createdAt: string
  hint: string
  expectedResponse: "confirm_cancel"
  promptText: string
  failedTaskId: string
  optionConfirm: PendingDispatchOption
  optionCancel: PendingDispatchOption
}

interface WorkspaceMissingPendingDispatchChoiceState {
  kind: "workspace_missing"
  id: string
  createdAt: string
  hint: string
  expectedResponse: "create_reenter"
  promptText: string
  missingPaths: string[]
  optionCreate: PendingDispatchOption
  optionReenter: PendingDispatchOption
}

interface FollowupTargetCandidate {
  taskId: string
  threadId: string
  title: string
  mode: ButlerTask["mode"]
  status: ButlerTaskStatus
  createdAt: string
  score: number
}

interface FollowupTargetPendingDispatchChoiceState {
  kind: "followup_target"
  id: string
  createdAt: string
  hint: string
  expectedResponse: "task_select"
  promptText: string
  followupText: string
  candidates: FollowupTargetCandidate[]
}

type PendingDispatchChoiceState =
  | OversplitPendingDispatchChoiceState
  | RetryConfirmPendingDispatchChoiceState
  | WorkspaceMissingPendingDispatchChoiceState
  | FollowupTargetPendingDispatchChoiceState

const TASK_NOTICE_MARKER = "[TASK_NOTICE_JSON]"
const TASK_DIGEST_MARKER = "[TASK_DIGEST_JSON]"
const GENERIC_RECORDED_REPLY_PATTERN = /^已记录([。.!！]?)*$/u

type ButlerMessageListener = (message: ButlerMessage) => void

function nowIso(): string {
  return new Date().toISOString()
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function isQQMessageScene(value: unknown): value is QQExternalSourceInfo["messageType"] {
  return value === "c2c" || value === "group" || value === "guild" || value === "dm"
}

function isQQReplyTargetInfo(value: unknown): value is QQExternalSourceInfo["replyTarget"] {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return isQQMessageScene(record.scene)
}

function isQQExternalSourceInfo(value: unknown): value is QQExternalSourceInfo {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    record.source === "qqbot" &&
    typeof record.senderOpenId === "string" &&
    typeof record.messageId === "string" &&
    isQQMessageScene(record.messageType) &&
    typeof record.timestamp === "string" &&
    isQQReplyTargetInfo(record.replyTarget) &&
    typeof record.originalText === "string" &&
    Array.isArray(record.attachmentPaths) &&
    Array.isArray(record.voiceNotes)
  )
}

function readExternalSourceFromMetadata(
  metadata?: Record<string, unknown>
): QQExternalSourceInfo | undefined {
  const direct = metadata?.externalSource
  if (isQQExternalSourceInfo(direct)) {
    return direct
  }
  return undefined
}

function extractRecentRounds(messages: ButlerMessage[], limit: number): ButlerRound[] {
  const rounds: ButlerRound[] = []
  let currentUser: ButlerMessage | null = null
  for (const message of messages) {
    const externalSource = readExternalSourceFromMetadata(message.metadata)
    if (message.role === "user") {
      if (currentUser) {
        rounds.push({
          id: `${currentUser.id}:pending`,
          user: currentUser.content,
          assistant: "",
          ts: currentUser.ts,
          kind: currentUser.kind ?? "chat",
          sourceType: currentUser.sourceType ?? "user_message",
          relatedThreadId: currentUser.relatedThreadId,
          relatedTaskId: currentUser.relatedTaskId,
          noticeType: currentUser.noticeType,
          externalSource: readExternalSourceFromMetadata(currentUser.metadata)
        })
      }
      currentUser = message
      continue
    }
    if (message.role === "assistant" && currentUser) {
      rounds.push({
        id: `${currentUser.id}:${message.id}`,
        user: currentUser.content,
        assistant: message.content,
        ts: message.ts,
        kind: message.kind ?? "chat",
        sourceType: message.sourceType ?? "orchestrator",
        relatedThreadId: message.relatedThreadId ?? currentUser.relatedThreadId,
        relatedTaskId: message.relatedTaskId ?? currentUser.relatedTaskId,
        noticeType: message.noticeType,
        externalSource: readExternalSourceFromMetadata(currentUser.metadata)
      })
      currentUser = null
      continue
    }
    if (message.role === "assistant") {
      rounds.push({
        id: `notice:${message.id}`,
        user: "[系统通知]",
        assistant: message.content,
        ts: message.ts,
        kind: message.kind ?? "task_comment",
        sourceType: message.sourceType ?? "task_lifecycle",
        relatedThreadId: message.relatedThreadId,
        relatedTaskId: message.relatedTaskId,
        noticeType: message.noticeType,
        externalSource
      })
    }
  }
  if (currentUser) {
    rounds.push({
      id: `${currentUser.id}:pending`,
      user: currentUser.content,
      assistant: "",
      ts: currentUser.ts,
      kind: currentUser.kind ?? "chat",
      sourceType: currentUser.sourceType ?? "user_message",
      relatedThreadId: currentUser.relatedThreadId,
      relatedTaskId: currentUser.relatedTaskId,
      noticeType: currentUser.noticeType,
      externalSource: readExternalSourceFromMetadata(currentUser.metadata)
    })
  }
  return rounds.slice(-limit)
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

class ButlerManager {
  private initialized = false
  private mainThreadId = ""
  private messages: ButlerMessage[] = []
  private tasks = new Map<string, ButlerTask>()
  private queue: PendingTask[] = []
  private running = new Set<string>()
  private runningThreadIds = new Set<string>()
  private dependencyChildren = new Map<string, Set<string>>()
  private unresolvedDeps = new Map<string, Set<string>>()
  private pendingDispatchChoice: PendingDispatchChoiceState | null = null
  private queuedDispatchChoices: PendingDispatchChoiceState[] = []
  private taskCompletionUnsubscribe: (() => void) | null = null
  private perceptionQueue: Array<{
    input: ButlerPerceptionInput
    resolve: (notice: TaskCompletionNotice) => void
  }> = []
  private perceptionQueueRunning = false
  private readonly messageListeners = new Set<ButlerMessageListener>()

  async initialize(): Promise<void> {
    if (this.initialized) return

    this.mainThreadId = this.ensureMainThread()
    const existingThreadIds = new Set(getAllThreads().map((row) => row.thread_id))
    this.messages = loadButlerMessages().map((entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
      ts: entry.ts,
      kind: entry.kind,
      sourceType: entry.sourceType,
      relatedThreadId: entry.relatedThreadId,
      relatedTaskId: entry.relatedTaskId,
      noticeType: entry.noticeType,
      metadata: entry.metadata
    }))

    const orphanTaskIds: string[] = []
    for (const task of loadButlerTasks()) {
      if (!existingThreadIds.has(task.threadId)) {
        orphanTaskIds.push(task.id)
        continue
      }
      if (task.status === "running" || task.status === "queued") {
        task.status = "failed"
        task.completedAt = nowIso()
        task.resultBrief = task.resultBrief || "任务在应用重启后中断。"
        task.resultDetail = task.resultDetail || task.resultBrief
        persistButlerTask(task)
      }
      this.tasks.set(task.id, task)
    }
    if (orphanTaskIds.length > 0) {
      removeButlerTasks(orphanTaskIds)
    }

    this.taskCompletionUnsubscribe = onTaskCompleted((payload) => {
      this.handleTaskCompleted(payload)
    })

    this.initialized = true
    this.broadcastState()
    this.broadcastTasks()
  }

  shutdown(): void {
    if (this.taskCompletionUnsubscribe) {
      this.taskCompletionUnsubscribe()
      this.taskCompletionUnsubscribe = null
    }
    this.initialized = false
  }

  getState(): ButlerState {
    const recentRounds = extractRecentRounds(this.messages, this.getRecentRoundLimit())
    return {
      mainThreadId: this.mainThreadId,
      recentRounds,
      totalMessageCount: this.messages.length,
      activeTaskCount: Array.from(this.tasks.values()).filter(
        (task) => task.status === "queued" || task.status === "running"
      ).length,
      pendingDispatchChoice: this.pendingDispatchChoice
        ? {
            id: this.pendingDispatchChoice.id,
            awaiting: true,
            createdAt: this.pendingDispatchChoice.createdAt,
            kind: this.pendingDispatchChoice.kind,
            expectedResponse: this.pendingDispatchChoice.expectedResponse,
            hint: this.pendingDispatchChoice.hint
          }
        : undefined
    }
  }

  listTasks(): ButlerTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  onMessageAppended(listener: ButlerMessageListener): () => void {
    this.messageListeners.add(listener)
    return () => {
      this.messageListeners.delete(listener)
    }
  }

  async clearHistory(): Promise<ButlerState> {
    await this.initialize()
    this.messages = []
    this.pendingDispatchChoice = null
    this.queuedDispatchChoices = []
    clearButlerHistoryMessages()
    this.broadcastState()
    return this.getState()
  }

  async clearTasks(): Promise<ButlerTask[]> {
    await this.initialize()
    const removableIds = Array.from(this.tasks.values())
      .filter((task) => task.status !== "queued" && task.status !== "running")
      .map((task) => task.id)

    return this.removeTaskRecords(removableIds)
  }

  async removeTasksByThreadId(threadId: string): Promise<ButlerTask[]> {
    await this.initialize()
    const normalized = threadId.trim()
    if (!normalized) return this.listTasks()

    const removableIds = Array.from(this.tasks.values())
      .filter((task) => task.threadId === normalized)
      .map((task) => task.id)

    return this.removeTaskRecords(removableIds)
  }

  private removeTaskRecords(taskIds: string[]): ButlerTask[] {
    const removableIds = Array.from(new Set(taskIds.filter((taskId) => taskId.trim().length > 0)))
    if (removableIds.length === 0) {
      return this.listTasks()
    }

    const removableIdSet = new Set(removableIds)
    for (const taskId of removableIds) {
      const task = this.tasks.get(taskId)
      this.tasks.delete(taskId)
      this.unresolvedDeps.delete(taskId)
      this.dependencyChildren.delete(taskId)
      this.running.delete(taskId)
      if (task?.threadId) {
        this.runningThreadIds.delete(task.threadId)
      }
    }

    this.queue = this.queue.filter((pending) => !removableIdSet.has(pending.taskId))

    for (const unresolved of this.unresolvedDeps.values()) {
      for (const taskId of removableIds) {
        unresolved.delete(taskId)
      }
    }

    for (const children of this.dependencyChildren.values()) {
      for (const taskId of removableIds) {
        children.delete(taskId)
      }
    }

    removeButlerTasks(removableIds)
    notificationMuteRegistry.cleanupByButlerTaskIds(removableIds)
    this.broadcastTasks()
    this.broadcastState()
    return this.listTasks()
  }

  private async pushTaskCommentNotice(
    notice: TaskCompletionNotice | TaskLifecycleNotice
  ): Promise<void> {
    const seed = `${notice.title} ${notice.resultBrief || ""} ${notice.resultDetail || ""}`
    const promptContext =
      "completedAt" in notice && notice.noticeType === "digest"
        ? this.buildPersonaOnlyContext()
        : this.buildSharedMemoryContext(seed)
    let commentText = this.sanitizeTaskCommentText(
      "phase" in notice && notice.phase === "started"
        ? `我会继续跟进这个任务：${notice.title}。`
        : notice.resultBrief || "任务已有新的结果。"
    )

    try {
      const result = await runButlerTaskCommentTurn({
        threadId: this.mainThreadId,
        notice,
        promptContext
      })
      if (result.commentText.trim()) {
        commentText = this.sanitizeTaskCommentText(result.commentText)
      }
    } catch (error) {
      console.warn("[Butler] runButlerTaskCommentTurn failed:", error)
    }
    if (!commentText) {
      commentText =
        "phase" in notice && notice.phase === "started"
          ? `我会继续跟进这个任务：${notice.title}。`
          : notice.resultBrief || "任务已有新的结果。"
    }

    const snapshotNotice: TaskCompletionNotice | TaskLifecycleNotice =
      "completedAt" in notice
        ? { ...notice, noticeType: notice.noticeType ?? "task" }
        : {
            ...notice,
            resultBrief: notice.resultBrief || commentText,
            resultDetail: notice.resultDetail || notice.resultBrief || commentText
          }

    const content = `${commentText}\n${TASK_NOTICE_MARKER}${JSON.stringify(snapshotNotice)}`

    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content,
      ts: "completedAt" in snapshotNotice ? snapshotNotice.completedAt : snapshotNotice.at,
      kind: "task_comment",
      sourceType: "task_lifecycle",
      relatedThreadId: snapshotNotice.threadId,
      noticeType: "task",
      metadata: {
        taskIdentity: snapshotNotice.taskIdentity,
        memoryRefId: snapshotNotice.memoryRefId,
        lifecyclePhase: "phase" in snapshotNotice ? snapshotNotice.phase : "completed"
      }
    })
    this.broadcastState()
  }

  notifyCompletionNotice(notice: TaskCompletionNotice): void {
    void this.pushTaskCommentNotice(notice)
  }

  notifyLifecycleNotice(notice: TaskLifecycleNotice): void {
    // 生命周期通知仅用于外部聚合链路，Butler 主线程不再为每个 started/completed 事件落评论消息。
    void notice
  }

  notifyDigestNotice(notice: TaskCompletionNotice): void {
    if (notice.noticeType !== "digest" || !notice.digest) {
      return
    }

    const content = [
      `管家服务汇总：${notice.title}`,
      notice.resultBrief || "已生成本时段任务汇总。",
      `${TASK_DIGEST_MARKER}${JSON.stringify(notice)}`
    ].join("\n")

    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content,
      ts: notice.completedAt || nowIso(),
      kind: "digest_comment",
      sourceType: "service_digest",
      relatedThreadId: notice.threadId,
      noticeType: "digest",
      metadata: {
        digestId: notice.digest.id,
        memoryRefId: notice.memoryRefId
      }
    })
    this.broadcastState()

    void this.pushTaskCommentNotice(this.buildDigestTaskCommentNotice(notice))
  }

  async summarizeDigest(input: {
    windowStart: string
    windowEnd: string
    tasks: ButlerDigestTaskCard[]
  }): Promise<string> {
    await this.initialize()
    const promptContext = this.buildPersonaOnlyContext()
    const result = await runButlerDigestTurn({
      threadId: this.mainThreadId,
      digest: input,
      promptContext
    })
    return result.summaryText.trim()
  }

  async ingestPerception(input: ButlerPerceptionInput): Promise<TaskCompletionNotice> {
    await this.initialize()
    return new Promise((resolve) => {
      this.perceptionQueue.push({ input, resolve })
      void this.pumpPerceptionQueue()
    })
  }

  private async pumpPerceptionQueue(): Promise<void> {
    if (this.perceptionQueueRunning) return
    this.perceptionQueueRunning = true

    try {
      while (this.perceptionQueue.length > 0) {
        const job = this.perceptionQueue.shift()
        if (!job) break
        const notice = await this.processPerception(job.input)
        job.resolve(notice)
      }
    } finally {
      this.perceptionQueueRunning = false
    }
  }

  private async processPerception(input: ButlerPerceptionInput): Promise<TaskCompletionNotice> {
    let reminderText = ""
    try {
      const promptContext = this.buildSharedMemoryContext(
        `${input.title} ${input.detail || ""} ${JSON.stringify(input.payload)}`
      )
      const result = await runButlerPerceptionTurn({
        threadId: this.mainThreadId,
        perception: input,
        promptContext
      })
      reminderText = result.reminderText.trim()
    } catch (error) {
      console.warn("[Butler] runButlerPerceptionTurn failed:", error)
    }

    const taskPrompt = this.extractPerceptionTaskPrompt(input)
    let dispatchResult: PerceptionDispatchResult = { status: "skipped" }
    if (taskPrompt) {
      dispatchResult = await this.dispatchPerceptionTask(input, taskPrompt)
    }

    const finalReminder = reminderText || this.buildPerceptionFallbackText(input)
    const completedAt = nowIso()
    const eventThreadId =
      dispatchResult.status === "dispatched" ? dispatchResult.tasks[0]?.threadId || "" : ""
    const notice: TaskCompletionNotice = {
      id: `event:${input.id}:${completedAt}`,
      threadId: eventThreadId,
      title: input.title,
      resultBrief: finalReminder,
      resultDetail: this.buildPerceptionResultDetail(input, finalReminder, dispatchResult),
      completedAt,
      mode: "butler",
      source: "butler",
      noticeType: "event",
      eventKind: input.kind
    }

    const content = [
      `事件提醒：${notice.title}`,
      `类型: ${input.kind}`,
      `摘要: ${notice.resultBrief}`,
      `${TASK_NOTICE_MARKER}${JSON.stringify(notice)}`
    ].join("\n")

    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content,
      ts: completedAt,
      kind: "event_comment",
      sourceType: "subscription_event",
      relatedThreadId: notice.threadId,
      noticeType: "event",
      metadata: {
        eventKind: input.kind,
        memoryRefId: notice.memoryRefId,
        ...(dispatchResult.status === "dispatched" && dispatchResult.tasks[0]?.externalSource
          ? { externalSource: dispatchResult.tasks[0].externalSource }
          : {})
      }
    })
    this.broadcastState()
    return notice
  }

  private buildPerceptionFallbackText(input: ButlerPerceptionInput): string {
    if (input.kind === "calendar_due_soon") {
      return `你有一个日历事件将在 2 小时内开始：${input.title}。`
    }
    if (input.kind === "countdown_due") {
      return `倒计时已到点：${input.title}。`
    }
    if (input.kind === "mail_new") {
      return `收到一封新的邮件，请及时查看：${input.title}。`
    }
    if (input.kind === "rss_new") {
      return `收到一条新的 RSS 更新，请及时查看：${input.title}。`
    }
    return `检测到新的监听事件：${input.title}。`
  }

  private buildPerceptionResultDetail(
    input: ButlerPerceptionInput,
    reminder: string,
    dispatchResult: PerceptionDispatchResult
  ): string {
    const snapshot = input.snapshot
    const lines = [
      `提醒: ${reminder}`,
      `事件类型: ${input.kind}`,
      `触发时间: ${input.triggeredAt}`,
      `事件详情: ${input.detail || "none"}`,
      `[快照统计]`,
      `日历事件: ${snapshot.calendarEvents.length}`,
      `倒计时: ${snapshot.countdownTimers.length}`,
      `邮件规则: ${snapshot.mailRules.length}`,
      `最近邮件: ${snapshot.recentMails.length}`,
      `RSS订阅: ${snapshot.rssSubscriptions.length}`,
      `最近RSS: ${snapshot.recentRssItems.length}`,
      "",
      "[订阅任务派发]"
    ]

    if (dispatchResult.status === "skipped") {
      lines.push("状态: skipped (未配置 taskPrompt)")
      return lines.join("\n")
    }

    if (dispatchResult.status === "failed") {
      lines.push("状态: failed")
      lines.push(`taskPrompt: ${dispatchResult.taskPrompt}`)
      lines.push(`错误: ${dispatchResult.error}`)
      return lines.join("\n")
    }

    lines.push("状态: dispatched")
    lines.push(`taskPrompt: ${dispatchResult.taskPrompt}`)
    lines.push(`编排反馈: ${dispatchResult.assistantText || "none"}`)
    lines.push(`创建任务数: ${dispatchResult.tasks.length}`)
    lines.push(`主线程: ${dispatchResult.tasks[0]?.threadId || "none"}`)
    if (dispatchResult.tasks.length > 0) {
      lines.push("[已创建任务]")
      for (const [index, task] of dispatchResult.tasks.entries()) {
        lines.push(`${index + 1}. [${task.mode}] ${task.title} | thread=${task.threadId}`)
      }
    }
    if (dispatchResult.notes.length > 0) {
      lines.push("[调度说明]")
      for (const note of dispatchResult.notes) {
        lines.push(`- ${note}`)
      }
    }
    return lines.join("\n")
  }

  private extractPerceptionTaskPrompt(input: ButlerPerceptionInput): string | null {
    const payload = input.payload as Record<string, unknown>
    const candidates: unknown[] = []

    if (payload && typeof payload === "object") {
      candidates.push(payload.taskPrompt)

      const calendarEvent = payload.calendarEvent as Record<string, unknown> | undefined
      candidates.push(calendarEvent?.taskPrompt)

      const countdown = payload.countdown as Record<string, unknown> | undefined
      candidates.push(countdown?.taskPrompt)

      const mailRule = payload.mailRule as Record<string, unknown> | undefined
      candidates.push(mailRule?.taskPrompt)

      const rssSubscription = payload.rssSubscription as Record<string, unknown> | undefined
      candidates.push(rssSubscription?.taskPrompt)
    }

    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue
      const normalized = candidate.trim()
      if (normalized.length > 0) return normalized
    }
    return null
  }

  private buildPerceptionDispatchUserMessage(
    input: ButlerPerceptionInput,
    taskPrompt: string
  ): string {
    return [
      "这是一次订阅事件自动任务派发请求。",
      "请基于下面 taskPrompt 规划任务，优先 single_task_first（除非确有多个独立目标）。",
      "",
      "[Task Prompt]",
      taskPrompt,
      "",
      "[Triggered Event]",
      `kind: ${input.kind}`,
      `title: ${input.title}`,
      `triggeredAt: ${input.triggeredAt}`,
      `detail: ${input.detail || "none"}`,
      "",
      "[Payload]",
      JSON.stringify(input.payload, null, 2)
    ].join("\n")
  }

  private buildPerceptionFallbackIntent(input: ButlerPerceptionInput): ButlerDispatchIntent {
    const taskKey = `subscription_${input.kind}_${Date.now()}`
    return {
      mode: "default",
      taskKey,
      title: `订阅任务：${input.title}`,
      initialPrompt: [
        "补充说明：本任务由订阅事件自动触发。",
        `事件类型: ${input.kind}`,
        `触发时间: ${input.triggeredAt}`,
        `事件详情: ${input.detail || "none"}`,
        "请在执行结果中明确说明处理结论与下一步建议。"
      ].join("\n"),
      threadStrategy: "new_thread",
      dependsOn: [],
      deliverableFormat: "text"
    }
  }

  private buildPerceptionHabitAddendum(input: ButlerPerceptionInput): string {
    const payloadText = JSON.stringify(input.payload, null, 2)
    const clippedPayload =
      payloadText.length > 3000 ? `${payloadText.slice(0, 2999)}...` : payloadText

    return [
      "[Subscription Event Context]",
      `kind: ${input.kind}`,
      `title: ${input.title}`,
      `triggeredAt: ${input.triggeredAt}`,
      `detail: ${input.detail || "none"}`,
      "",
      "[Subscription Event Payload]",
      clippedPayload
    ].join("\n")
  }

  private async dispatchPerceptionTask(
    input: ButlerPerceptionInput,
    taskPrompt: string
  ): Promise<PerceptionDispatchResult> {
    const trimmedPrompt = taskPrompt.trim()
    if (!trimmedPrompt) {
      return { status: "skipped" }
    }

    const { capabilityCatalog, capabilitySummary } = this.getCapabilityContext()
    const promptContextBase = this.buildPromptContextBase({
      userMessage: this.buildPerceptionDispatchUserMessage(input, trimmedPrompt),
      capabilityCatalog,
      capabilitySummary
    })

    const notes: string[] = []
    let assistantText = "已根据订阅配置派发任务。"
    let intents: ButlerDispatchIntent[] = []
    try {
      const orchestrator = await runButlerOrchestratorTurn({
        threadId: this.mainThreadId,
        promptContext: {
          ...promptContextBase,
          dispatchPolicy: "single_task_first"
        }
      })
      intents = orchestrator.dispatchIntents
      if (orchestrator.assistantText?.trim()) {
        assistantText = orchestrator.assistantText.trim()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notes.push(`编排调用失败，已使用默认任务回退: ${message}`)
    }

    if (intents.length === 0) {
      intents = [this.buildPerceptionFallbackIntent(input)]
      notes.push("编排未返回任务，已自动回退为 1 个 default 任务。")
    }

    const workspaceValidation = this.resolveIntentWorkspacePaths(intents)
    if (workspaceValidation.kind === "invalid") {
      return {
        status: "failed",
        taskPrompt: trimmedPrompt,
        error: workspaceValidation.error
      }
    }

    let runnableIntents = workspaceValidation.intents
    if (workspaceValidation.kind === "missing") {
      const creationResult = this.ensureWorkspaceDirectories(workspaceValidation.missingPaths)
      if (!creationResult.ok) {
        return {
          status: "failed",
          taskPrompt: trimmedPrompt,
          error: `创建工作目录失败: ${creationResult.path} (${creationResult.error})`
        }
      }
      notes.push(`已自动创建缺失目录: ${workspaceValidation.missingPaths.join(", ")}`)
      runnableIntents = workspaceValidation.intents
    }

    const created = this.createTasksFromIntents({
      intents: runnableIntents,
      groupId: uuid(),
      sourceTurnId: uuid(),
      creation: {
        originUserMessage: this.normalizeOriginUserMessage(trimmedPrompt),
        habitAddendum: this.buildPerceptionHabitAddendum(input)
      }
    })

    for (const taskId of created.readyTaskIds) {
      this.enqueueTask(taskId)
    }

    notes.push(...created.notes)
    this.broadcastTasks()
    this.broadcastState()
    void this.pumpQueue()

    return {
      status: "dispatched",
      taskPrompt: trimmedPrompt,
      assistantText,
      tasks: created.tasks,
      notes
    }
  }

  private getCapabilityContext(): { capabilityCatalog: string; capabilitySummary: string } {
    const capabilitySnapshot = getButlerCapabilitySnapshot()
    return {
      capabilityCatalog: buildCapabilityPromptBlock(capabilitySnapshot),
      capabilitySummary: buildCapabilitySummaryLine(capabilitySnapshot)
    }
  }

  private buildPersonaProfileText(): string {
    const persona = getSettings().butler.persona
    return [
      `name: ${persona.name}`,
      `role: ${persona.role}`,
      `relationship: ${persona.relationshipToUser}`,
      `tone: ${persona.tone}`,
      `comment_style: ${persona.commentStyle}`,
      `initiative_level: ${persona.initiativeLevel}`,
      "[Principles]",
      ...(persona.principles.length > 0
        ? persona.principles.map((item, index) => `${index + 1}. ${item}`)
        : ["none"]),
      "",
      "[Do]",
      ...(persona.dos.length > 0
        ? persona.dos.map((item, index) => `${index + 1}. ${item}`)
        : ["none"]),
      "",
      "[Don't]",
      ...(persona.donts.length > 0
        ? persona.donts.map((item, index) => `${index + 1}. ${item}`)
        : ["none"])
    ].join("\n")
  }

  private buildLongTermRecallText(seed: string): string {
    const result = searchMemory({ text: seed, limit: 5 })
    const eventLines = result.events
      .slice(0, 5)
      .map((event, index) => `${index + 1}. [${event.category}] ${event.title}: ${event.summary}`)
    const entityLines = result.entities
      .slice(0, 5)
      .map((entity, index) => `${index + 1}. (${entity.type}) ${entity.name}: ${entity.value}`)
    return [
      "[Relevant Events]",
      eventLines.length > 0 ? eventLines.join("\n") : "none",
      "",
      "[Relevant Entities]",
      entityLines.length > 0 ? entityLines.join("\n") : "none"
    ].join("\n")
  }

  private buildSharedMemoryContext(
    seed: string
  ): Pick<ButlerPromptContext, "personaProfile" | "workingMemoryText" | "memoryRecallText"> {
    return {
      personaProfile: this.buildPersonaProfileText(),
      workingMemoryText: getWorkingMemorySnapshot().text,
      memoryRecallText: this.buildLongTermRecallText(seed)
    }
  }

  private buildPersonaOnlyContext(): Pick<
    ButlerPromptContext,
    "personaProfile" | "workingMemoryText" | "memoryRecallText"
  > {
    return {
      personaProfile: this.buildPersonaProfileText(),
      workingMemoryText: undefined,
      memoryRecallText: undefined
    }
  }

  private normalizeOriginUserMessage(message: string): string {
    const normalized = message.trim()
    return normalized || "none"
  }

  private buildHabitAddendum(params: {
    profileText?: string
    memoryHints: Array<{ threadId: string; title?: string; summaryBrief: string }>
  }): string {
    const profileText = params.profileText?.trim() || ""
    const memoryLines = params.memoryHints
      .map((hint, index) => {
        const title = hint.title?.trim() ? ` (${hint.title.trim()})` : ""
        return `${index + 1}. ${hint.threadId}${title}: ${hint.summaryBrief}`
      })
      .filter((line) => line.trim().length > 0)
    const sections: string[] = []

    if (profileText) {
      sections.push(`[Daily Profile]\n${profileText}`)
    }
    if (memoryLines.length > 0) {
      sections.push(`[Related Memory Hints]\n${memoryLines.join("\n")}`)
    }

    return sections.length > 0 ? sections.join("\n\n") : "none"
  }

  private getRecentExecutionTasks(limit = 5): ButlerTask[] {
    return this.listTasks()
      .filter(
        (task) =>
          task.status === "running" || task.status === "completed" || task.status === "failed"
      )
      .slice(0, limit)
  }

  private buildPromptContextBase(params: {
    userMessage: string
    capabilityCatalog: string
    capabilitySummary: string
    currentUserMessageId?: string
  }): Omit<ButlerPromptContext, "dispatchPolicy"> {
    const { userMessage, capabilityCatalog, capabilitySummary, currentUserMessageId } = params
    const profile = getLatestDailyProfile()
    const now = new Date()
    const weekdayLabels = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ]
    const currentWeekday = weekdayLabels[now.getDay()] || "Unknown"
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"
    const previousUserMessage = currentUserMessageId
      ? this.findPreviousUserMessage(currentUserMessageId)?.content
      : this.findLatestUserMessage()?.content
    const memoryHints = searchMemoryByTask(userMessage, 5)
    const recentTasks = this.getRecentExecutionTasks(5).map((task) => ({
      id: task.id,
      title: task.title,
      mode: task.mode,
      status: task.status,
      threadId: task.threadId,
      createdAt: task.createdAt,
      resultBrief: task.resultBrief
    }))
    const sharedMemoryContext = this.buildSharedMemoryContext(userMessage)

    return {
      userMessage,
      capabilityCatalog,
      capabilitySummary,
      personaProfile: sharedMemoryContext.personaProfile,
      workingMemoryText: sharedMemoryContext.workingMemoryText,
      memoryRecallText: sharedMemoryContext.memoryRecallText,
      currentTimeIso: now.toISOString(),
      currentLocalTime: now.toLocaleString(),
      currentWeekday,
      currentTimezone,
      profileText: profile?.profileText,
      comparisonText: profile?.comparisonText,
      previousUserMessage,
      memoryHints: memoryHints.map((item) => ({
        threadId: item.threadId,
        title: item.title,
        summaryBrief: item.summaryBrief
      })),
      recentTasks
    }
  }

  private isGenericRecordedReply(text: string): boolean {
    const normalized = text.trim()
    if (!normalized) return false
    return (
      GENERIC_RECORDED_REPLY_PATTERN.test(normalized) ||
      normalized.startsWith("已记录，") ||
      normalized.startsWith("已记录,")
    )
  }

  private sanitizeDispatchAssistantText(text: string, fallback: string): string {
    const normalized = text.trim()
    if (!normalized) return fallback
    if (this.isGenericRecordedReply(normalized)) return fallback
    return normalized
  }

  private isUsableAssistantText(text: string): boolean {
    const normalized = text.trim()
    return normalized.length > 0 && !this.isGenericRecordedReply(normalized)
  }

  private buildLocalTimeQuickReply(userMessage: string): string | null {
    const normalized = userMessage.trim().toLowerCase()
    if (!normalized) return null

    const asksDate = /(今天几号|今天日期|几月几日|日期是多少|what.*date|today.*date)/iu.test(
      normalized
    )
    const asksTime = /(现在几点|当前时间|几点了|what.*time|time\s+now|current\s+time)/iu.test(
      normalized
    )
    const asksWeekday = /(今天星期几|今天周几|星期几|周几|what.*day.*week|weekday)/iu.test(
      normalized
    )
    if (!asksDate && !asksTime && !asksWeekday) {
      return null
    }

    const now = new Date()
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
    const weekday = weekdays[now.getDay()] || "星期未知"
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"
    const dateText = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
    const timeText = now.toLocaleTimeString("zh-CN", { hour12: false })

    if (asksDate && asksTime && asksWeekday) {
      return `现在是 ${dateText}，${weekday}，${timeText}（时区：${timezone}）。`
    }
    if (asksDate && asksWeekday) {
      return `今天是 ${dateText}，${weekday}（时区：${timezone}）。`
    }
    if (asksDate && asksTime) {
      return `现在是 ${dateText} ${timeText}（时区：${timezone}）。`
    }
    if (asksDate) {
      return `今天是 ${dateText}（时区：${timezone}）。`
    }
    if (asksWeekday) {
      return `今天是 ${weekday}（时区：${timezone}）。`
    }
    return `现在时间是 ${timeText}（时区：${timezone}）。`
  }

  private shouldHandleMemoryQuickReply(userMessage: string): boolean {
    const normalized = userMessage.trim()
    if (!normalized) return false
    const asksYesterday = /(昨天|yesterday)/iu.test(normalized)
    const asksActionSummary =
      /(干了什么|做了什么|完成了什么|发生了什么|what\s+did\s+i\s+do)/iu.test(normalized)
    if (asksYesterday && asksActionSummary) return true
    if (/(对话历史|聊天记录|历史消息|history|chat\s*history)/iu.test(normalized)) return true
    if (
      /(最近|近期|recent)/iu.test(normalized) &&
      /(任务|事件|历史|对话|干了什么|做了什么|发生了什么|what.*(did|done))/iu.test(normalized)
    ) {
      return true
    }
    return (
      /(记忆|memory)/iu.test(normalized) && /(回顾|总结|查询|看看|summary|recap)/iu.test(normalized)
    )
  }

  private buildMemoryQuickReply(userMessage: string): string | null {
    if (!this.shouldHandleMemoryQuickReply(userMessage)) return null

    const normalized = userMessage.trim()
    const lines: string[] = []
    const asksYesterday = /(昨天|yesterday)/iu.test(normalized)
    const asksHistory = /(对话历史|聊天记录|历史消息|history|chat\s*history)/iu.test(normalized)

    if (asksYesterday) {
      const yesterdaySummary = getRangeSummary({ preset: "yesterday" })
      lines.push("[昨天概览]")
      lines.push(
        yesterdaySummary.eventCount > 0 ? yesterdaySummary.summaryText : "暂无昨天的有效记录。"
      )
      if (yesterdaySummary.highlights.length > 0) {
        lines.push("关键点:")
        for (const [index, item] of yesterdaySummary.highlights.slice(0, 3).entries()) {
          lines.push(`${index + 1}. ${item}`)
        }
      }
      lines.push("")
    }

    const memorySearch = searchMemory({ text: normalized, limit: 5 })
    if (memorySearch.events.length > 0) {
      lines.push("[相关事件]")
      for (const [index, event] of memorySearch.events.slice(0, 4).entries()) {
        lines.push(`${index + 1}. ${event.title}（${event.occurredAt}）: ${event.summary}`)
      }
      lines.push("")
    }

    if (asksHistory) {
      const recentChatRounds = extractRecentRounds(this.messages, 6).filter(
        (round) => round.kind === "chat"
      )
      if (recentChatRounds.length > 0) {
        lines.push("[最近对话]")
        for (const [index, round] of recentChatRounds.slice(-3).entries()) {
          lines.push(`${index + 1}. 你: ${round.user}`)
          if (round.assistant.trim()) {
            lines.push(`   管家: ${round.assistant}`)
          }
        }
      } else {
        lines.push("[最近对话]")
        lines.push("暂无可回顾的对话记录。")
      }
    }

    const compact = lines
      .map((line) => line.trimEnd())
      .join("\n")
      .trim()
    if (compact) return compact
    return "我现在还没有足够的历史记忆来回答这个问题。请告诉我你想回顾的时间范围或任务主题。"
  }

  private isFollowupContinuationCue(userMessage: string): boolean {
    const normalized = userMessage.trim()
    if (!normalized) return false
    if (normalized.length > 180) return false
    if (/^(再|另外|顺便|补充|追加|继续|再帮我|帮我再|再给我|再把|并且|还要)/u.test(normalized)) {
      return true
    }
    return /(补充|再加|追加|顺便|再帮我|再给我|继续这个|继续上个)/u.test(normalized)
  }

  private tokenizeForTaskMatch(text: string): string[] {
    const tokens = text.toLowerCase().match(/[\u4e00-\u9fff]{2,}|[a-z0-9_-]{3,}/gu)
    if (!tokens) return []
    return Array.from(new Set(tokens)).slice(0, 30)
  }

  private overlapScore(sourceTokens: string[], targetTokens: Set<string>): number {
    let score = 0
    for (const token of sourceTokens) {
      if (targetTokens.has(token)) score += 1
    }
    return score
  }

  private buildFollowupCandidates(params: {
    statuses: ButlerTaskStatus[]
    followupText: string
    previousUserMessage?: string
    cueDetected: boolean
  }): FollowupTargetCandidate[] {
    const phaseTasks = this.listTasks().filter((task) => params.statuses.includes(task.status))
    if (phaseTasks.length === 0) return []

    const followupTokens = this.tokenizeForTaskMatch(params.followupText)
    const previousTokens = this.tokenizeForTaskMatch(params.previousUserMessage || "")
    const normalizedPrevious = (params.previousUserMessage || "").trim().toLowerCase()
    const scored: FollowupTargetCandidate[] = []

    for (const [index, task] of phaseTasks.entries()) {
      const corpus = [task.title, task.originUserMessage || "", task.prompt, task.resultBrief || ""]
        .join("\n")
        .toLowerCase()
      const taskTokens = new Set(this.tokenizeForTaskMatch(corpus))
      const followupOverlap = this.overlapScore(followupTokens, taskTokens)
      const previousOverlap = this.overlapScore(previousTokens, taskTokens)
      const previousExact = normalizedPrevious.length > 0 && corpus.includes(normalizedPrevious)
      const hasSignal = followupOverlap > 0 || previousOverlap > 0 || previousExact
      if (!hasSignal) continue

      const recencyBoost = Math.max(0, 8 - index)
      const score =
        followupOverlap * 5 +
        previousOverlap * 9 +
        (previousExact ? 25 : 0) +
        recencyBoost +
        (task.status === "running" ? 12 : 0)
      scored.push({
        taskId: task.id,
        threadId: task.threadId,
        title: task.title,
        mode: task.mode,
        status: task.status,
        createdAt: task.createdAt,
        score
      })
    }

    if (scored.length === 0 && params.cueDetected && phaseTasks.length === 1) {
      const single = phaseTasks[0]
      return [
        {
          taskId: single.id,
          threadId: single.threadId,
          title: single.title,
          mode: single.mode,
          status: single.status,
          createdAt: single.createdAt,
          score: 1
        }
      ]
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.createdAt.localeCompare(a.createdAt)
    })
    return scored.slice(0, 5)
  }

  private chooseFollowupCandidate(candidates: FollowupTargetCandidate[]): {
    selected?: FollowupTargetCandidate
    ambiguous: boolean
  } {
    if (candidates.length === 0) return { ambiguous: true }
    if (candidates.length === 1) return { selected: candidates[0], ambiguous: false }
    const [first, second] = candidates
    if ((first?.score ?? 0) - (second?.score ?? 0) >= 12) {
      return { selected: first, ambiguous: false }
    }
    return { ambiguous: true }
  }

  private buildFallbackFollowupCandidates(limit = 3): FollowupTargetCandidate[] {
    return this.listTasks()
      .filter((task) => task.status === "running" || task.status === "completed")
      .slice(0, limit)
      .map((task) => ({
        taskId: task.id,
        threadId: task.threadId,
        title: task.title,
        mode: task.mode,
        status: task.status,
        createdAt: task.createdAt,
        score: 0
      }))
  }

  private buildFollowupTargetChoicePrompt(
    followupText: string,
    candidates: FollowupTargetCandidate[]
  ): string {
    const lines = candidates.map(
      (candidate, index) =>
        `${index + 1}. [${candidate.mode}/${candidate.status}] ${candidate.title} | thread=${candidate.threadId}`
    )
    return [
      "这条看起来是对最近任务的补充，但我还不能唯一确定目标任务。",
      `补充内容: ${followupText}`,
      "",
      "请回复序号选择要续接的任务：",
      ...lines
    ].join("\n")
  }

  private parseTaskSelectChoiceText(raw: string, candidateCount: number): number | null {
    const normalized = raw.trim().toLowerCase()
    if (!normalized || candidateCount <= 0) return null
    const matched = normalized.match(/\d+/)
    if (!matched) return null
    const value = Number.parseInt(matched[0], 10)
    if (!Number.isFinite(value)) return null
    if (value < 1 || value > candidateCount) return null
    return value - 1
  }

  private buildFollowupIntent(params: {
    targetTask: ButlerTask
    followupText: string
    taskKey: string
  }): ButlerDispatchIntent {
    const { targetTask, followupText, taskKey } = params
    const title = `${targetTask.title}（补充）`
    const reuseFollowupBlock = [
      "[Reuse Followup Message]",
      `target_thread_id=${targetTask.threadId}`,
      `source_task_id=${targetTask.id}`,
      `followup_user_request=${followupText}`,
      "dispatch_timing=after_previous_run_if_same_thread_running",
      "[/Reuse Followup Message]"
    ].join("\n")
    const initialPrompt = [
      "这是对同一任务的追问补充，请基于已有上下文继续执行。",
      reuseFollowupBlock,
      `新增要求: ${followupText}`,
      "请在结果中明确说明新增内容和与原任务的衔接。"
    ].join("\n")
    const common = {
      taskKey,
      title,
      initialPrompt,
      threadStrategy: "reuse_last_thread" as const,
      reuseThreadId: targetTask.threadId,
      workspacePath: targetTask.workspacePath,
      dependsOn: []
    }

    switch (targetTask.mode) {
      case "ralph":
        return {
          ...common,
          mode: "ralph",
          acceptanceCriteria: ["新增补充要求已实现并通过验证。"],
          maxIterations: targetTask.ralphMaxIterations
        }
      case "email":
        return {
          ...common,
          mode: "email",
          emailIntent: followupText
        }
      case "loop": {
        const fallbackLoopConfig = {
          enabled: true,
          contentTemplate: followupText,
          trigger: { type: "schedule" as const, cron: "*/5 * * * *" },
          queue: { policy: "strict" as const, mergeWindowSec: 300 }
        }
        return {
          ...common,
          mode: "loop",
          loopConfig: targetTask.loopConfig ?? fallbackLoopConfig
        }
      }
      case "expert":
        return {
          ...common,
          mode: "expert",
          expertConfig: targetTask.expertConfig ?? {
            experts: [
              {
                id: "followup_expert",
                role: "执行者",
                prompt: `在原任务上下文中实现这个补充要求：${followupText}`,
                agentThreadId: ""
              }
            ],
            loop: { enabled: false, maxCycles: 1 }
          }
        }
      default:
        return {
          ...common,
          mode: "default"
        }
    }
  }

  private dispatchFollowupToTask(params: {
    targetTask: ButlerTask
    followupText: string
    capabilitySummary: string
  }): ButlerState {
    const { targetTask, followupText, capabilitySummary } = params
    const followupTaskKey = `followup_${Date.now()}`
    const intent = this.buildFollowupIntent({
      targetTask,
      followupText,
      taskKey: followupTaskKey
    })
    const profile = getLatestDailyProfile()
    const followupHints = searchMemoryByTask(followupText, 3).map((item) => ({
      threadId: item.threadId,
      title: item.title,
      summaryBrief: item.summaryBrief
    }))
    const creation: DispatchTaskCreationContext = {
      originUserMessage: this.normalizeOriginUserMessage(
        `${targetTask.originUserMessage || targetTask.title}\n补充要求: ${followupText}`
      ),
      habitAddendum: this.buildHabitAddendum({
        profileText: profile?.profileText,
        memoryHints: followupHints
      }),
      externalSource: targetTask.externalSource,
      preferredReuseThreadByTaskKey: {
        [followupTaskKey]: targetTask.threadId
      }
    }
    return this.dispatchIntentsAndReply({
      intents: [intent],
      assistantText: `已将补充要求续接到任务「${targetTask.title}」，会在当前执行完成后继续处理。`,
      capabilitySummary,
      creation
    })
  }

  private tryHandleFollowupContinuation(params: {
    userMessage: string
    previousUserMessage?: string
    capabilitySummary: string
  }): ButlerState | null {
    const cueDetected = this.isFollowupContinuationCue(params.userMessage)
    if (!cueDetected) return null

    const hasTaskToContinue = this.listTasks().some(
      (task) => task.status === "running" || task.status === "completed"
    )
    if (!hasTaskToContinue) return null

    const runningCandidates = this.buildFollowupCandidates({
      statuses: ["running"],
      followupText: params.userMessage,
      previousUserMessage: params.previousUserMessage,
      cueDetected
    })
    if (runningCandidates.length > 0) {
      const choice = this.chooseFollowupCandidate(runningCandidates)
      if (choice.selected) {
        const target = this.tasks.get(choice.selected.taskId)
        if (target) {
          return this.dispatchFollowupToTask({
            targetTask: target,
            followupText: params.userMessage,
            capabilitySummary: params.capabilitySummary
          })
        }
      }
      const pendingChoice: FollowupTargetPendingDispatchChoiceState = {
        kind: "followup_target",
        id: uuid(),
        createdAt: nowIso(),
        hint: "检测到追问补充，请回复序号选择要续接的任务。",
        expectedResponse: "task_select",
        promptText: this.buildFollowupTargetChoicePrompt(
          params.userMessage,
          runningCandidates.slice(0, 3)
        ),
        followupText: params.userMessage,
        candidates: runningCandidates.slice(0, 3)
      }
      this.schedulePendingDispatchChoice(pendingChoice)
      return this.getState()
    }

    const completedCandidates = this.buildFollowupCandidates({
      statuses: ["completed"],
      followupText: params.userMessage,
      previousUserMessage: params.previousUserMessage,
      cueDetected
    })
    if (completedCandidates.length > 0) {
      const choice = this.chooseFollowupCandidate(completedCandidates)
      if (choice.selected) {
        const target = this.tasks.get(choice.selected.taskId)
        if (target) {
          return this.dispatchFollowupToTask({
            targetTask: target,
            followupText: params.userMessage,
            capabilitySummary: params.capabilitySummary
          })
        }
      }
      const pendingChoice: FollowupTargetPendingDispatchChoiceState = {
        kind: "followup_target",
        id: uuid(),
        createdAt: nowIso(),
        hint: "检测到追问补充，请回复序号选择要续接的任务。",
        expectedResponse: "task_select",
        promptText: this.buildFollowupTargetChoicePrompt(
          params.userMessage,
          completedCandidates.slice(0, 3)
        ),
        followupText: params.userMessage,
        candidates: completedCandidates.slice(0, 3)
      }
      this.schedulePendingDispatchChoice(pendingChoice)
      return this.getState()
    }

    const fallbackCandidates = this.buildFallbackFollowupCandidates(3)
    if (fallbackCandidates.length > 0) {
      const pendingChoice: FollowupTargetPendingDispatchChoiceState = {
        kind: "followup_target",
        id: uuid(),
        createdAt: nowIso(),
        hint: "补充目标不清晰，请回复序号选择要续接的任务。",
        expectedResponse: "task_select",
        promptText: this.buildFollowupTargetChoicePrompt(params.userMessage, fallbackCandidates),
        followupText: params.userMessage,
        candidates: fallbackCandidates
      }
      this.schedulePendingDispatchChoice(pendingChoice)
      return this.getState()
    }

    return null
  }

  private buildExternalStoredMessage(input: ButlerExternalSendInput): string {
    const external = input.externalSource
    const lines = [
      "[External Message]",
      `source: ${input.source}`,
      `senderOpenId: ${external.senderOpenId}`,
      `senderName: ${external.senderName?.trim() || "unknown"}`,
      `messageId: ${external.messageId}`,
      `messageType: ${external.messageType}`,
      `timestamp: ${external.timestamp}`,
      `replyTarget: ${JSON.stringify(external.replyTarget)}`,
      "originalText:",
      external.originalText || "(empty)",
      "attachments:",
      ...(external.attachmentPaths.length > 0
        ? external.attachmentPaths.map((item) => `- ${item}`)
        : ["- none"]),
      "voiceNotes:",
      ...(external.voiceNotes.length > 0
        ? external.voiceNotes.map((item) => `- ${item}`)
        : ["- none"]),
      "[/External Message]",
      "",
      input.message.trim()
    ]
    return lines.join("\n")
  }

  private splitExternalReplyContent(content: string): {
    assistantText: string
    taskSummary?: string
  } {
    const trimmed = content.trim()
    if (!trimmed) {
      return { assistantText: "" }
    }

    const lines = trimmed.split("\n")
    const taskSummaryStart = lines.findIndex(
      (line) =>
        /^任务组[:：]/.test(line) ||
        /^共创建\s+\d+\s+个任务/.test(line) ||
        /^\d+\.\s+\[[^\]]+\]\s+/.test(line)
    )

    if (taskSummaryStart <= 0) {
      return { assistantText: trimmed }
    }

    return {
      assistantText: lines.slice(0, taskSummaryStart).join("\n").trim(),
      taskSummary: lines.slice(taskSummaryStart).join("\n").trim()
    }
  }

  private buildExternalTaskSummary(tasks: ButlerTask[], fallback?: string): string | undefined {
    if (fallback?.trim()) {
      return fallback.trim()
    }
    if (tasks.length === 0) {
      return undefined
    }

    const lines = [`共创建 ${tasks.length} 个任务。`]
    for (const [index, task] of tasks.entries()) {
      lines.push(`${index + 1}. [${task.mode}/${task.status}] ${task.title}`)
    }
    return lines.join("\n")
  }

  private getLatestAssistantMessage(startIndex = 0): ButlerMessage | undefined {
    const candidates = this.messages
      .slice(startIndex)
      .filter((message) => message.role === "assistant")
    return candidates[candidates.length - 1]
  }

  private async sendCore(params: SendMessageParams): Promise<ButlerState> {
    const trimmedRaw = params.rawMessage.trim()
    const trimmedStored = (params.storedMessage ?? params.rawMessage).trim()

    if (!trimmedRaw || !trimmedStored) {
      return this.getState()
    }

    const userMessage: ButlerMessage = {
      id: uuid(),
      role: "user",
      content: trimmedStored,
      ts: nowIso(),
      kind: "chat",
      sourceType: "user_message",
      metadata: params.metadata
    }
    this.pushMessage(userMessage)

    if (this.pendingDispatchChoice) {
      return this.handlePendingDispatchChoice(trimmedRaw)
    }

    const localTimeReply = this.buildLocalTimeQuickReply(trimmedRaw)
    if (localTimeReply) {
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: localTimeReply,
        ts: nowIso()
      })
      this.broadcastState()
      return this.getState()
    }

    const memoryQuickReply = this.buildMemoryQuickReply(trimmedRaw)
    if (memoryQuickReply) {
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: memoryQuickReply,
        ts: nowIso()
      })
      this.broadcastState()
      return this.getState()
    }

    const { capabilityCatalog, capabilitySummary } = this.getCapabilityContext()
    const promptContextBase = this.buildPromptContextBase({
      userMessage: trimmedRaw,
      capabilityCatalog,
      capabilitySummary,
      currentUserMessageId: userMessage.id
    })
    const creation: DispatchTaskCreationContext = {
      originUserMessage: this.normalizeOriginUserMessage(trimmedRaw),
      habitAddendum: this.buildHabitAddendum({
        profileText: promptContextBase.profileText,
        memoryHints: promptContextBase.memoryHints
      }),
      externalSource: readExternalSourceFromMetadata(params.metadata)
    }

    const followupState = this.tryHandleFollowupContinuation({
      userMessage: trimmedRaw,
      previousUserMessage: promptContextBase.previousUserMessage,
      capabilitySummary
    })
    if (followupState) {
      return followupState
    }

    const orchestrator = await runButlerOrchestratorTurn({
      threadId: this.mainThreadId,
      promptContext: {
        ...promptContextBase,
        dispatchPolicy: "standard"
      }
    })

    if (orchestrator.dispatchIntents.length === 0) {
      let directReplyText = orchestrator.assistantText.trim()
      let shouldUseDirectReply = this.isUsableAssistantText(directReplyText)
      if (!shouldUseDirectReply) {
        try {
          const directReplyTurn = await runButlerDirectReplyTurn({
            promptContext: {
              ...promptContextBase,
              dispatchPolicy: "standard"
            }
          })
          if (this.isUsableAssistantText(directReplyTurn.assistantText)) {
            directReplyText = directReplyTurn.assistantText.trim()
            shouldUseDirectReply = true
          }
        } catch (error) {
          console.warn("[Butler] Direct reply fallback failed:", error)
        }
      }
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: shouldUseDirectReply
          ? directReplyText
          : "我还缺少关键信息。请补充你的目标、范围或期望输出。",
        ts: nowIso()
      })
      this.broadcastState()
      return this.getState()
    }

    const primaryAssistantText = this.sanitizeDispatchAssistantText(
      orchestrator.assistantText,
      "已完成任务编排并开始执行。"
    )

    if (orchestrator.dispatchIntents.length <= 1) {
      return this.dispatchIntentsAndReply({
        intents: orchestrator.dispatchIntents,
        assistantText: primaryAssistantText,
        capabilitySummary,
        creation
      })
    }

    const detection = await detectOversplitByModel({
      userMessage: trimmedRaw,
      intents: orchestrator.dispatchIntents
    })
    if (detection.verdict === "valid_multi") {
      return this.dispatchIntentsAndReply({
        intents: orchestrator.dispatchIntents,
        assistantText: primaryAssistantText,
        capabilitySummary,
        creation
      })
    }

    let optionA: PendingDispatchOption
    try {
      const replanned = await runButlerOrchestratorTurn({
        threadId: this.mainThreadId,
        promptContext: {
          ...promptContextBase,
          dispatchPolicy: "single_task_first"
        }
      })

      const canUseReplan =
        replanned.dispatchIntents.length === 1 &&
        this.validateDispatchGraph(replanned.dispatchIntents).ok
      if (canUseReplan) {
        optionA = {
          kind: "dispatch",
          intents: replanned.dispatchIntents,
          assistantText: this.sanitizeDispatchAssistantText(
            replanned.assistantText,
            "已按方案A（单任务优先）执行。"
          ),
          summary: this.buildDispatchOptionSummary(replanned.dispatchIntents),
          capabilitySummary,
          creation
        }
      } else {
        optionA = {
          kind: "cancel",
          intents: [],
          assistantText: "已取消本次执行，请重述需求后我会重新编排。",
          summary: "单任务重编排未产生可执行的单任务方案。",
          capabilitySummary,
          creation
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      optionA = {
        kind: "cancel",
        intents: [],
        assistantText: "已取消本次执行，请重述需求后我会重新编排。",
        summary: `单任务重编排失败：${message}`,
        capabilitySummary,
        creation
      }
    }

    const optionB: PendingDispatchOption = {
      kind: "dispatch",
      intents: orchestrator.dispatchIntents,
      assistantText: this.sanitizeDispatchAssistantText(
        orchestrator.assistantText,
        "已按方案B（原始拆分）执行。"
      ),
      summary: this.buildDispatchOptionSummary(orchestrator.dispatchIntents),
      capabilitySummary,
      creation
    }

    const promptText = this.buildOversplitDispatchChoicePrompt(
      optionA,
      optionB,
      detection.reason,
      detection.confidence
    )

    const choice: OversplitPendingDispatchChoiceState = {
      kind: "oversplit_ab",
      id: uuid(),
      createdAt: nowIso(),
      hint: "当前存在待确认的任务编排方案，请在输入框回复 A 或 B。",
      expectedResponse: "ab",
      promptText,
      reason: detection.reason,
      confidence: detection.confidence,
      optionA,
      optionB
    }
    this.schedulePendingDispatchChoice(choice)
    return this.getState()
  }

  async send(message: string): Promise<ButlerState> {
    await this.initialize()
    return this.sendCore({ rawMessage: message })
  }

  async sendExternal(input: ButlerExternalSendInput): Promise<ButlerExternalSendResult> {
    await this.initialize()
    const beforeMessageIndex = this.messages.length
    const beforeTaskIds = new Set(this.tasks.keys())

    const state = await this.sendCore({
      rawMessage: input.message,
      storedMessage: this.buildExternalStoredMessage(input),
      metadata: {
        source: input.source,
        senderOpenId: input.externalSource.senderOpenId,
        senderName: input.externalSource.senderName,
        messageId: input.externalSource.messageId,
        externalSource: input.externalSource
      }
    })

    const latestAssistant = this.getLatestAssistantMessage(beforeMessageIndex)
    const parsedReply = this.splitExternalReplyContent(latestAssistant?.content ?? "")
    const createdTasks = this.listTasks().filter((task) => !beforeTaskIds.has(task.id))

    return {
      assistantText: parsedReply.assistantText || latestAssistant?.content?.trim() || "",
      taskSummary: this.buildExternalTaskSummary(createdTasks, parsedReply.taskSummary),
      pendingChoice: state.pendingDispatchChoice,
      state
    }
  }

  private handlePendingDispatchChoice(choiceText: string): ButlerState {
    const pending = this.pendingDispatchChoice
    if (!pending) return this.getState()

    if (pending.kind === "followup_target") {
      const selectedIndex = this.parseTaskSelectChoiceText(choiceText, pending.candidates.length)
      if (selectedIndex === null) {
        this.pushMessage({
          id: uuid(),
          role: "assistant",
          content: [
            "请回复序号选择要续接的任务。",
            ...pending.candidates.map(
              (candidate, index) =>
                `${index + 1}. [${candidate.mode}/${candidate.status}] ${candidate.title}`
            )
          ].join("\n"),
          ts: nowIso()
        })
        this.broadcastState()
        return this.getState()
      }

      const selected = pending.candidates[selectedIndex]
      const targetTask = selected ? this.tasks.get(selected.taskId) : null
      this.pendingDispatchChoice = null
      if (!targetTask) {
        this.pushMessage({
          id: uuid(),
          role: "assistant",
          content: "目标任务不存在或已被清理，请重新说明要补充的任务。",
          ts: nowIso()
        })
        this.broadcastState()
        this.promoteNextQueuedDispatchChoice()
        return this.getState()
      }

      const state = this.dispatchFollowupToTask({
        targetTask,
        followupText: pending.followupText,
        capabilitySummary: this.getCapabilityContext().capabilitySummary
      })
      this.promoteNextQueuedDispatchChoice()
      return state
    }

    let selected: PendingDispatchOption

    if (pending.kind === "oversplit_ab") {
      const choice = this.parseABChoiceText(choiceText)
      if (!choice) {
        this.pushMessage({
          id: uuid(),
          role: "assistant",
          content: [
            "当前存在待确认的编排方案。",
            "请回复 A 或 B 进行选择。",
            "A: 单任务优先方案",
            "B: 原始拆分方案"
          ].join("\n"),
          ts: nowIso()
        })
        this.broadcastState()
        return this.getState()
      }
      selected = choice === "A" ? pending.optionA : pending.optionB
    } else if (pending.kind === "retry_confirm") {
      const choice = this.parseConfirmCancelChoiceText(choiceText)
      if (!choice) {
        this.pushMessage({
          id: uuid(),
          role: "assistant",
          content: [
            "当前存在待确认的失败重分配方案。",
            "请回复 确认 或 取消。",
            "确认: 按建议创建重试任务",
            "取消: 不创建重试任务"
          ].join("\n"),
          ts: nowIso()
        })
        this.broadcastState()
        return this.getState()
      }
      selected = choice === "confirm" ? pending.optionConfirm : pending.optionCancel
    } else {
      const choice = this.parseCreateReenterChoiceText(choiceText)
      if (!choice) {
        this.pushMessage({
          id: uuid(),
          role: "assistant",
          content: [
            "检测到工作目录不存在，请回复 创建 或 重输。",
            "创建: 由管家创建缺失目录并继续派发",
            "重输: 取消本轮派发，等待你重新输入路径"
          ].join("\n"),
          ts: nowIso()
        })
        this.broadcastState()
        return this.getState()
      }
      selected = choice === "create" ? pending.optionCreate : pending.optionReenter
    }

    this.pendingDispatchChoice = null

    if (selected.kind === "cancel") {
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: selected.assistantText,
        ts: nowIso()
      })
      this.broadcastState()
      this.promoteNextQueuedDispatchChoice()
      return this.getState()
    }

    if (selected.intents.length === 0) {
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: "所选方案没有可执行任务，请重新描述需求。",
        ts: nowIso()
      })
      this.broadcastState()
      this.promoteNextQueuedDispatchChoice()
      return this.getState()
    }

    if (selected.missingWorkspacePaths && selected.missingWorkspacePaths.length > 0) {
      const creationResult = this.ensureWorkspaceDirectories(selected.missingWorkspacePaths)
      if (!creationResult.ok) {
        this.pushMessage({
          id: uuid(),
          role: "assistant",
          content: [
            "创建工作目录失败，请重新输入可用路径。",
            `失败路径: ${creationResult.path}`,
            `错误: ${creationResult.error}`
          ].join("\n"),
          ts: nowIso()
        })
        this.broadcastState()
        this.promoteNextQueuedDispatchChoice()
        return this.getState()
      }
    }

    const state = this.dispatchIntentsAndReply({
      intents: selected.intents,
      assistantText: selected.assistantText,
      capabilitySummary: selected.capabilitySummary,
      creation: selected.creation
    })
    this.promoteNextQueuedDispatchChoice()
    return state
  }

  private parseABChoiceText(raw: string): "A" | "B" | null {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, "")
    if (!normalized) return null

    const optionA = new Set(["a", "1", "方案a", "选a", "a方案", "选择a", "a执行"])
    if (optionA.has(normalized)) return "A"

    const optionB = new Set(["b", "2", "方案b", "选b", "b方案", "选择b", "b执行"])
    if (optionB.has(normalized)) return "B"

    return null
  }

  private parseConfirmCancelChoiceText(raw: string): "confirm" | "cancel" | null {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, "")
    if (!normalized) return null

    const confirm = new Set(["确认", "同意", "yes", "y", "ok", "好的", "继续"])
    if (confirm.has(normalized)) return "confirm"

    const cancel = new Set(["取消", "拒绝", "no", "n", "不用", "停止"])
    if (cancel.has(normalized)) return "cancel"

    return null
  }

  private parseCreateReenterChoiceText(raw: string): "create" | "reenter" | null {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, "")
    if (!normalized) return null

    const create = new Set(["创建", "帮我创建", "create", "yes", "y", "确认", "同意", "可以创建"])
    if (create.has(normalized)) return "create"

    const reenter = new Set(["重输", "重新输入", "reenter", "no", "n", "取消", "不用", "我重输"])
    if (reenter.has(normalized)) return "reenter"

    return null
  }

  private buildOversplitDispatchChoicePrompt(
    optionA: PendingDispatchOption,
    optionB: PendingDispatchOption,
    reason: string,
    confidence: number
  ): string {
    const confidencePct = `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`
    return [
      "检测到当前计划可能过度拆分，需你确认执行方案。",
      `判定原因: ${reason}`,
      `判定置信度: ${confidencePct}`,
      "",
      "方案A（单任务优先）",
      optionA.summary,
      "",
      "方案B（原始拆分）",
      optionB.summary,
      "",
      "请回复 A 或 B。"
    ].join("\n")
  }

  private buildRetryDispatchChoicePrompt(
    failedTask: ButlerTask,
    errorMessage: string,
    confirmOption: PendingDispatchOption
  ): string {
    return [
      "检测到任务异常失败，已生成重分配方案。",
      `失败任务: [${failedTask.mode}] ${failedTask.title}`,
      `错误信息: ${errorMessage}`,
      "",
      "建议方案（单任务同模式）",
      confirmOption.summary,
      "",
      "请回复 确认 或 取消。"
    ].join("\n")
  }

  private buildWorkspaceMissingDispatchChoicePrompt(
    missingPaths: string[],
    optionCreate: PendingDispatchOption
  ): string {
    const pathLines = missingPaths.map((path, index) => `${index + 1}. ${path}`)
    return [
      "检测到任务工作目录不存在，需你确认下一步。",
      "",
      "[缺失目录]",
      ...pathLines,
      "",
      "[待执行任务概览]",
      optionCreate.summary,
      "",
      "请回复 创建 或 重输。",
      "创建: 由管家创建目录并继续执行。",
      "重输: 取消本轮并等待你输入新路径。"
    ].join("\n")
  }

  private promoteNextQueuedDispatchChoice(): void {
    if (this.pendingDispatchChoice) return
    const next = this.queuedDispatchChoices.shift()
    if (!next) return

    this.pendingDispatchChoice = next

    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content: next.promptText,
      ts: nowIso()
    })
    this.broadcastState()
  }

  private schedulePendingDispatchChoice(choice: PendingDispatchChoiceState): void {
    if (this.pendingDispatchChoice) {
      this.queuedDispatchChoices.push(choice)
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: `检测到新的待确认方案，已加入确认队列（${choice.kind}）。请先处理当前方案。`,
        ts: nowIso()
      })
      this.broadcastState()
      return
    }

    this.pendingDispatchChoice = choice
    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content: choice.promptText,
      ts: nowIso()
    })
    this.broadcastState()
  }

  private buildDispatchOptionSummary(intents: ButlerDispatchIntent[]): string {
    if (intents.length === 0) return "无任务。"

    const modeCounter = new Map<ButlerDispatchIntent["mode"], number>()
    for (const intent of intents) {
      const current = modeCounter.get(intent.mode) ?? 0
      modeCounter.set(intent.mode, current + 1)
    }
    const modeDistribution = Array.from(modeCounter.entries())
      .map(([mode, count]) => `${mode}:${count}`)
      .join(", ")
    const dependentCount = intents.filter((intent) => intent.dependsOn.length > 0).length
    const detailLines = intents.map((intent, index) => {
      const deps =
        intent.dependsOn.length > 0 ? `dependsOn=${intent.dependsOn.join(",")}` : "independent"
      return `${index + 1}. [${intent.mode}] ${intent.title} (${deps})`
    })

    return [
      `任务数: ${intents.length}`,
      `模式分布: ${modeDistribution}`,
      `依赖任务: ${dependentCount}/${intents.length}`,
      ...detailLines
    ].join("\n")
  }

  private resolveIntentWorkspacePaths(
    intents: ButlerDispatchIntent[]
  ):
    | { kind: "ready"; intents: ButlerDispatchIntent[] }
    | { kind: "missing"; intents: ButlerDispatchIntent[]; missingPaths: string[] }
    | { kind: "invalid"; error: string } {
    const rootPath = this.getRootPath().trim()
    const resolvedRootPath = rootPath ? resolve(rootPath) : ""
    const normalizedIntents: ButlerDispatchIntent[] = []
    const missingPaths = new Set<string>()

    for (const intent of intents) {
      const rawWorkspacePath = intent.workspacePath?.trim()
      if (!rawWorkspacePath) {
        normalizedIntents.push(intent)
        continue
      }

      if (!isAbsolute(rawWorkspacePath) && !resolvedRootPath) {
        return {
          kind: "invalid",
          error: `任务 ${intent.taskKey} 使用了相对路径 "${rawWorkspacePath}"，但 butler.rootPath 未配置。请改为绝对路径或先配置管家根目录。`
        }
      }

      const resolvedWorkspacePath = isAbsolute(rawWorkspacePath)
        ? resolve(rawWorkspacePath)
        : resolve(resolvedRootPath, rawWorkspacePath)

      if (existsSync(resolvedWorkspacePath)) {
        try {
          const stat = statSync(resolvedWorkspacePath)
          if (!stat.isDirectory()) {
            return {
              kind: "invalid",
              error: `任务 ${intent.taskKey} 的路径不是目录: ${resolvedWorkspacePath}`
            }
          }
        } catch (error) {
          return {
            kind: "invalid",
            error: `任务 ${intent.taskKey} 校验路径失败: ${resolvedWorkspacePath} (${error instanceof Error ? error.message : String(error)})`
          }
        }
      } else {
        missingPaths.add(resolvedWorkspacePath)
      }

      normalizedIntents.push({
        ...intent,
        workspacePath: resolvedWorkspacePath
      })
    }

    if (missingPaths.size > 0) {
      return {
        kind: "missing",
        intents: normalizedIntents,
        missingPaths: Array.from(missingPaths.values())
      }
    }

    return {
      kind: "ready",
      intents: normalizedIntents
    }
  }

  private ensureWorkspaceDirectories(
    paths: string[]
  ): { ok: true } | { ok: false; path: string; error: string } {
    for (const path of paths) {
      try {
        mkdirSync(path, { recursive: true })
        const stat = statSync(path)
        if (!stat.isDirectory()) {
          return {
            ok: false,
            path,
            error: "目标路径存在但不是目录。"
          }
        }
      } catch (error) {
        return {
          ok: false,
          path,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
    return { ok: true }
  }

  private dispatchIntentsAndReply(params: {
    intents: ButlerDispatchIntent[]
    assistantText: string
    capabilitySummary: string
    creation: DispatchTaskCreationContext
  }): ButlerState {
    const graphValidation = this.validateDispatchGraph(params.intents)
    if (!graphValidation.ok) {
      const clarificationText = [
        params.assistantText || "当前任务计划无法派发。",
        `原因: ${graphValidation.error}`,
        "请补充或修正任务依赖关系后重试。"
      ].join("\n")
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: clarificationText,
        ts: nowIso()
      })
      this.broadcastState()
      return this.getState()
    }

    const workspaceValidation = this.resolveIntentWorkspacePaths(params.intents)
    if (workspaceValidation.kind === "invalid") {
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: [
          params.assistantText || "当前任务计划无法派发。",
          `原因: ${workspaceValidation.error}`,
          "请重新输入正确路径后重试。"
        ].join("\n"),
        ts: nowIso()
      })
      this.broadcastState()
      return this.getState()
    }

    if (workspaceValidation.kind === "missing") {
      const optionCreate: PendingDispatchOption = {
        kind: "dispatch",
        intents: workspaceValidation.intents,
        assistantText: params.assistantText,
        summary: this.buildDispatchOptionSummary(workspaceValidation.intents),
        capabilitySummary: params.capabilitySummary,
        creation: params.creation,
        missingWorkspacePaths: workspaceValidation.missingPaths
      }
      const optionReenter: PendingDispatchOption = {
        kind: "cancel",
        intents: [],
        assistantText: "已取消本轮派发，请重新输入工作目录路径后再试。",
        summary: "用户选择重新输入路径。",
        capabilitySummary: params.capabilitySummary,
        creation: params.creation
      }

      const choice: WorkspaceMissingPendingDispatchChoiceState = {
        kind: "workspace_missing",
        id: uuid(),
        createdAt: nowIso(),
        hint: "检测到工作目录不存在，请回复 创建 或 重输。",
        expectedResponse: "create_reenter",
        promptText: this.buildWorkspaceMissingDispatchChoicePrompt(
          workspaceValidation.missingPaths,
          optionCreate
        ),
        missingPaths: workspaceValidation.missingPaths,
        optionCreate,
        optionReenter
      }
      this.schedulePendingDispatchChoice(choice)
      return this.getState()
    }

    const groupId = uuid()
    const sourceTurnId = uuid()
    const created = this.createTasksFromIntents({
      intents: workspaceValidation.intents,
      groupId,
      sourceTurnId,
      creation: params.creation
    })
    this.pendingDispatchChoice = null

    for (const taskId of created.readyTaskIds) {
      this.enqueueTask(taskId)
    }
    this.broadcastTasks()

    const dispatchedLines = created.tasks.map((task, index) => {
      const depCount = task.dependsOnTaskIds?.length ?? 0
      return `${index + 1}. [${task.mode}] ${task.title} (${depCount > 0 ? `depends:${depCount}` : "independent"})`
    })

    const replyLines = [
      params.assistantText || "已完成任务编排并开始执行。",
      `任务组: ${groupId}`,
      `共创建 ${created.tasks.length} 个任务。`,
      ...dispatchedLines,
      params.capabilitySummary
    ]
    if (created.notes.length > 0) {
      replyLines.push("[调度说明]")
      replyLines.push(...created.notes)
    }
    const replyContent = replyLines.join("\n")

    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content: replyContent,
      ts: nowIso()
    })
    this.broadcastState()

    void this.pushTaskCommentNotice(
      this.buildDispatchTaskCommentNotice({
        groupId,
        replyContent,
        tasks: created.tasks
      })
    )

    void this.pumpQueue()
    return this.getState()
  }

  private sanitizeTaskCommentText(text: string): string {
    const cleaned = text
      .replace(/^\s*(任务评论|模式|线程|阶段|摘要|phase|mode|thread)\s*[:：].*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    return cleaned
  }

  private buildDispatchTaskCommentNotice(params: {
    groupId: string
    replyContent: string
    tasks: ButlerTask[]
  }): TaskLifecycleNotice {
    const { groupId, replyContent, tasks } = params
    const taskCount = tasks.length
    const singleTask = taskCount === 1 ? tasks[0] : undefined
    return {
      id: `dispatch:${groupId}:started`,
      phase: "started",
      threadId: singleTask?.threadId || "",
      title: singleTask?.title || `任务组 ${groupId}`,
      mode: "butler",
      source: "butler",
      at: nowIso(),
      resultBrief: `已完成任务编排并开始执行，共创建 ${taskCount} 个任务。`,
      resultDetail: replyContent
    }
  }

  private buildDigestTaskCommentNotice(notice: TaskCompletionNotice): TaskLifecycleNotice {
    const brief = notice.resultBrief || "已生成本时段任务汇总。"
    return {
      id: `digest:${notice.id}:completed`,
      phase: "completed",
      threadId: "",
      title: notice.title || "管家服务汇总",
      mode: "butler",
      source: "butler",
      at: notice.completedAt || nowIso(),
      resultBrief: brief,
      resultDetail: notice.resultDetail || brief,
      memoryRefId: notice.memoryRefId
    }
  }

  private getRecentRoundLimit(): number {
    const value = getSettings().butler?.recentRounds ?? 5
    return Math.max(1, value)
  }

  private getMaxConcurrent(): number {
    const value = getSettings().butler?.maxConcurrent ?? 2
    return Math.max(1, value)
  }

  private getRootPath(): string {
    return getSettings().butler?.rootPath || getSettings().defaultWorkspacePath || ""
  }

  private ensureMainThread(): string {
    const rows = getAllThreads()
    const found = rows.find((row) => {
      const metadata = parseMetadata(row.metadata)
      return metadata.butlerMain === true
    })
    if (found) return found.thread_id

    const threadId = uuid()
    const metadata = {
      mode: "butler" as ThreadMode,
      createdBy: "butler",
      butlerMain: true,
      disableApprovals: true
    }
    dbCreateThread(threadId, metadata)
    dbUpdateThread(threadId, { metadata: JSON.stringify(metadata), title: "Butler AI" })
    broadcastThreadsChanged()
    return threadId
  }

  private pushMessage(message: ButlerMessage): void {
    const normalized: ButlerMessage = {
      ...message,
      kind: message.kind ?? "chat",
      sourceType: message.sourceType ?? (message.role === "user" ? "user_message" : "orchestrator")
    }
    this.messages.push(normalized)
    appendButlerHistoryMessage({
      id: normalized.id,
      role: normalized.role,
      content: normalized.content,
      ts: normalized.ts,
      kind: normalized.kind,
      sourceType: normalized.sourceType,
      relatedThreadId: normalized.relatedThreadId,
      relatedTaskId: normalized.relatedTaskId,
      noticeType: normalized.noticeType,
      metadata: normalized.metadata
    })
    for (const listener of this.messageListeners) {
      try {
        listener(normalized)
      } catch (error) {
        console.warn("[Butler] message listener failed:", error)
      }
    }
  }

  private findPreviousUserMessage(currentMessageId: string): ButlerMessage | null {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index]
      if (message.id === currentMessageId) continue
      if (message.role === "user") return message
    }
    return null
  }

  private findLatestUserMessage(): ButlerMessage | null {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index]
      if (message.role === "user") return message
    }
    return null
  }

  private validateDispatchGraph(
    intents: ButlerDispatchIntent[]
  ): { ok: true } | { ok: false; error: string } {
    const byKey = new Map<string, ButlerDispatchIntent>()
    for (const intent of intents) {
      if (byKey.has(intent.taskKey)) {
        return { ok: false, error: `taskKey 重复: ${intent.taskKey}` }
      }
      byKey.set(intent.taskKey, intent)
    }

    for (const intent of intents) {
      for (const dep of intent.dependsOn) {
        if (!byKey.has(dep)) {
          return {
            ok: false,
            error: `任务 ${intent.taskKey} 依赖不存在的 taskKey: ${dep}`
          }
        }
        if (dep === intent.taskKey) {
          return { ok: false, error: `任务 ${intent.taskKey} 不能依赖自身` }
        }
      }
    }

    const visitState = new Map<string, 0 | 1 | 2>()
    const hasCycle = (taskKey: string): boolean => {
      const state = visitState.get(taskKey) ?? 0
      if (state === 1) return true
      if (state === 2) return false

      visitState.set(taskKey, 1)
      const intent = byKey.get(taskKey)
      for (const depKey of intent?.dependsOn ?? []) {
        if (hasCycle(depKey)) return true
      }
      visitState.set(taskKey, 2)
      return false
    }

    for (const taskKey of byKey.keys()) {
      if (hasCycle(taskKey)) {
        return { ok: false, error: "依赖图存在环，无法调度" }
      }
    }

    return { ok: true }
  }

  private createTasksFromIntents(params: {
    intents: ButlerDispatchIntent[]
    groupId: string
    sourceTurnId: string
    creation: DispatchTaskCreationContext
  }): {
    tasks: ButlerTask[]
    readyTaskIds: string[]
    notes: string[]
  } {
    const { intents, groupId, sourceTurnId, creation } = params
    const createdByTaskKey = new Map<string, ButlerTask>()
    const notes: string[] = []
    const recentExecutionTasks = this.getRecentExecutionTasks(5)
    const recentReusableThreadIds = new Set(
      recentExecutionTasks
        .map((task) => task.threadId)
        .filter((threadId) => threadId.trim().length > 0)
    )
    const recentModeByThreadId = new Map(
      recentExecutionTasks.map((task) => [task.threadId, task.mode] as const)
    )

    for (const intent of intents) {
      const requestedReuse = intent.threadStrategy === "reuse_last_thread"
      const preferredReuseThreadId = creation.preferredReuseThreadByTaskKey?.[intent.taskKey]
      const normalizedIntentReuseThreadId = intent.reuseThreadId?.trim() || undefined
      let reusableThreadId = preferredReuseThreadId

      if (!reusableThreadId && requestedReuse && normalizedIntentReuseThreadId) {
        if (recentReusableThreadIds.has(normalizedIntentReuseThreadId)) {
          const recentMode = recentModeByThreadId.get(normalizedIntentReuseThreadId)
          if (!recentMode || recentMode === intent.mode) {
            reusableThreadId = normalizedIntentReuseThreadId
          } else {
            notes.push(
              `任务 ${intent.taskKey}: reuseThreadId=${normalizedIntentReuseThreadId} 与当前 mode=${intent.mode} 不一致，已回退到 mode 最近线程。`
            )
          }
        } else {
          notes.push(
            `任务 ${intent.taskKey}: reuseThreadId=${normalizedIntentReuseThreadId} 不在最近 5 条可复用任务中，已回退到 mode 最近线程。`
          )
        }
      }

      if (!reusableThreadId && requestedReuse) {
        reusableThreadId = this.findReusableThreadId(intent.mode)
      }

      if (requestedReuse && !reusableThreadId) {
        notes.push(`任务 ${intent.taskKey}: 未找到可复用线程，已自动改为 new_thread。`)
      }

      const task = createButlerTaskThread({
        mode: intent.mode,
        prompt: renderTaskPrompt(intent, {
          originUserMessage: creation.originUserMessage,
          habitAddendum: creation.habitAddendum
        }),
        title: intent.title,
        rootPath: this.getRootPath(),
        workspacePath: intent.workspacePath,
        requester: "user",
        ralphMaxIterations: intent.mode === "ralph" ? intent.maxIterations : undefined,
        loopConfig: intent.mode === "loop" ? intent.loopConfig : undefined,
        expertConfig: intent.mode === "expert" ? intent.expertConfig : undefined,
        groupId,
        taskKey: intent.taskKey,
        handoff: intent.handoff,
        sourceTurnId,
        reuseThreadId: reusableThreadId,
        originUserMessage: creation.originUserMessage,
        retryOfTaskId: creation.retryOfTaskId,
        retryAttempt: creation.retryAttempt,
        externalSource: creation.externalSource
      })

      this.tasks.set(task.id, task)
      createdByTaskKey.set(intent.taskKey, task)
      persistButlerTask(task)
    }

    for (const intent of intents) {
      const task = createdByTaskKey.get(intent.taskKey)
      if (!task) continue

      const dependsOnTaskIds = intent.dependsOn
        .map((taskKey) => createdByTaskKey.get(taskKey)?.id)
        .filter((taskId): taskId is string => !!taskId)
      task.dependsOnTaskIds = dependsOnTaskIds
      persistButlerTask(task)

      if (dependsOnTaskIds.length > 0) {
        this.unresolvedDeps.set(task.id, new Set(dependsOnTaskIds))
        for (const parentId of dependsOnTaskIds) {
          const children = this.dependencyChildren.get(parentId) ?? new Set<string>()
          children.add(task.id)
          this.dependencyChildren.set(parentId, children)
        }
      }
    }

    const tasks = Array.from(createdByTaskKey.values())
    const readyTaskIds = tasks
      .filter((task) => !task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0)
      .map((task) => task.id)

    return { tasks, readyTaskIds, notes }
  }

  private findReusableThreadId(mode: ButlerTask["mode"]): string | undefined {
    const candidates = this.listTasks().filter((task) => task.mode === mode)
    if (candidates.length === 0) return undefined
    const preferred = candidates.find(
      (task) => task.status !== "failed" && task.status !== "cancelled"
    )
    return preferred?.threadId ?? candidates[0]?.threadId
  }

  private enqueueTask(taskId: string): void {
    if (this.queue.some((item) => item.taskId === taskId)) return
    this.queue.push({ taskId })
  }

  private canStartTask(task: ButlerTask): boolean {
    if (task.status !== "queued") return false
    if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) return true

    for (const parentId of task.dependsOnTaskIds) {
      const parent = this.tasks.get(parentId)
      if (!parent) {
        this.markTaskFailedByDependency(task, `依赖任务不存在: ${parentId}`)
        return false
      }
      if (parent.status === "failed" || parent.status === "cancelled") {
        this.markTaskFailedByDependency(task, `依赖任务失败: ${parent.title}`)
        return false
      }
      if (parent.status !== "completed") {
        return false
      }
    }

    return true
  }

  private async pumpQueue(): Promise<void> {
    while (this.running.size < this.getMaxConcurrent() && this.queue.length > 0) {
      const nextIndex = this.queue.findIndex((pending) => {
        const task = this.tasks.get(pending.taskId)
        if (!task) return false
        if (this.runningThreadIds.has(task.threadId)) return false
        return this.canStartTask(task)
      })

      if (nextIndex < 0) return

      const [next] = this.queue.splice(nextIndex, 1)
      if (!next) return
      const task = this.tasks.get(next.taskId)
      if (!task) continue

      task.status = "running"
      task.startedAt = nowIso()
      this.running.add(task.id)
      this.runningThreadIds.add(task.threadId)
      emitTaskStarted({
        threadId: task.threadId,
        source: "butler"
      })
      persistButlerTask(task)
      this.broadcastTasks()

      void this.runTaskAndUpdate(task)
    }
  }

  private buildContextPrefix(task: ButlerTask): string {
    const parentIds = task.dependsOnTaskIds ?? []
    if (parentIds.length === 0) return ""

    const parents = parentIds
      .map((id) => this.tasks.get(id))
      .filter((parent): parent is ButlerTask => !!parent)
    if (parents.length === 0) return ""

    const lines = parents.map((parent, index) => {
      return `${index + 1}. ${parent.title}\nmode=${parent.mode}\nthread=${parent.threadId}\nresult_brief=${parent.resultBrief || ""}\nresult_detail=${parent.resultDetail || ""}`
    })
    const note = task.handoff?.note ? `\n[Handoff Note]\n${task.handoff.note}` : ""
    return [`[Butler Upstream Context]`, ...lines, note].filter(Boolean).join("\n\n")
  }

  private writeFilesystemHandoff(task: ButlerTask): void {
    if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) return
    const method = task.handoff?.method ?? "both"
    if (method !== "filesystem" && method !== "both") return

    const upstream = task.dependsOnTaskIds
      .map((id) => this.tasks.get(id))
      .filter((parent): parent is ButlerTask => !!parent)
      .map((parent) => ({
        taskId: parent.id,
        taskKey: parent.taskKey,
        title: parent.title,
        mode: parent.mode,
        threadId: parent.threadId,
        workspacePath: parent.workspacePath,
        resultBrief: parent.resultBrief,
        resultDetail: parent.resultDetail,
        completedAt: parent.completedAt
      }))

    const payload = {
      taskId: task.id,
      taskKey: task.taskKey,
      generatedAt: new Date().toISOString(),
      handoff: {
        method,
        note: task.handoff?.note,
        requiredArtifacts: task.handoff?.requiredArtifacts ?? []
      },
      upstream
    }

    try {
      writeFileSync(
        join(task.workspacePath, ".butler_handoff.json"),
        JSON.stringify(payload, null, 2),
        "utf-8"
      )
    } catch (error) {
      console.warn("[Butler] Failed to write handoff file:", error)
    }
  }

  private buildExecutionPrompt(task: ButlerTask): string {
    if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) {
      return task.prompt
    }

    const method = task.handoff?.method ?? "both"
    const withContext = method === "context" || method === "both"
    const prefix = withContext ? this.buildContextPrefix(task) : ""
    this.writeFilesystemHandoff(task)

    if (!prefix) return task.prompt
    return `${prefix}\n\n${task.prompt}`
  }

  private async runTaskAndUpdate(task: ButlerTask): Promise<void> {
    try {
      const executionPrompt = this.buildExecutionPrompt(task)
      const executionTask: ButlerTask = {
        ...task,
        prompt: executionPrompt
      }
      const { result, error } = await executeButlerTask(executionTask)
      const latest = this.tasks.get(task.id)
      if (latest && latest.status === "running") {
        latest.status = error ? "failed" : "completed"
        latest.resultBrief = error || result || latest.resultBrief
        latest.resultDetail = error || result || latest.resultDetail
        latest.completedAt = nowIso()
        persistButlerTask(latest)
        this.onTaskSettled(latest)
        this.broadcastTasks()
      }
    } finally {
      this.running.delete(task.id)
      this.runningThreadIds.delete(task.threadId)
      this.broadcastTasks()
      void this.pumpQueue()
    }
  }

  private markTaskFailedByDependency(task: ButlerTask, reason: string): void {
    if (task.status !== "queued") return
    task.status = "failed"
    task.completedAt = nowIso()
    task.resultBrief = reason
    task.resultDetail = reason
    persistButlerTask(task)
    this.onTaskSettled(task)
    this.broadcastTasks()
  }

  private onTaskSettled(task: ButlerTask): void {
    this.unresolvedDeps.delete(task.id)
    const children = this.dependencyChildren.get(task.id)
    if (!children || children.size === 0) return

    for (const childId of children) {
      const child = this.tasks.get(childId)
      if (!child || child.status !== "queued") continue
      const unresolved = this.unresolvedDeps.get(childId)
      if (unresolved) {
        unresolved.delete(task.id)
      }

      if (task.status !== "completed") {
        this.markTaskFailedByDependency(child, `依赖任务失败: ${task.title}`)
        continue
      }

      if (!unresolved || unresolved.size === 0) {
        this.unresolvedDeps.delete(childId)
        this.enqueueTask(childId)
      }
    }
  }

  private getRetryAttempt(task: ButlerTask): number {
    const raw = task.retryAttempt
    if (typeof raw !== "number" || !Number.isFinite(raw)) return 0
    return Math.max(0, Math.floor(raw))
  }

  private resolveRetryRootTask(task: ButlerTask): ButlerTask {
    let current = task
    const visited = new Set<string>()

    while (current.retryOfTaskId) {
      if (visited.has(current.id)) break
      visited.add(current.id)
      const parent = this.tasks.get(current.retryOfTaskId)
      if (!parent) break
      current = parent
    }

    return current
  }

  private isDependencyFailureTask(task: ButlerTask): boolean {
    const reason = [task.resultBrief || "", task.resultDetail || ""].join("\n")
    return reason.includes("依赖任务失败:") || reason.includes("依赖任务不存在:")
  }

  private async prepareRetryReassignmentForFailure(
    task: ButlerTask,
    errorMessage: string
  ): Promise<void> {
    if (task.status !== "failed") return
    if (this.isDependencyFailureTask(task)) return

    const root = this.resolveRetryRootTask(task)
    const rootAttempt = Math.max(this.getRetryAttempt(root), this.getRetryAttempt(task))
    if (rootAttempt >= 1) {
      return
    }

    const originUserMessage = this.normalizeOriginUserMessage(
      task.originUserMessage || task.prompt || task.title
    )
    const { capabilityCatalog, capabilitySummary } = this.getCapabilityContext()
    const promptContextBase = this.buildPromptContextBase({
      userMessage: originUserMessage,
      capabilityCatalog,
      capabilitySummary
    })

    try {
      const replanned = await runButlerOrchestratorTurn({
        threadId: this.mainThreadId,
        promptContext: {
          ...promptContextBase,
          dispatchPolicy: "single_task_first",
          planningFocus: "retry_reassign",
          forcedMode: task.mode,
          retryContext: {
            failedTaskTitle: task.title,
            failedTaskMode: task.mode,
            failedTaskPrompt: task.prompt,
            failureError: errorMessage,
            originUserMessage
          }
        }
      })

      const validSingleTask =
        replanned.dispatchIntents.length === 1 &&
        replanned.dispatchIntents[0]?.mode === task.mode &&
        this.validateDispatchGraph(replanned.dispatchIntents).ok

      if (!validSingleTask) {
        this.pushMessage({
          id: uuid(),
          role: "assistant",
          content: [
            `任务失败：${task.title}`,
            `错误: ${errorMessage}`,
            "自动重分配未生成可执行的同模式单任务方案，请手动重述需求。"
          ].join("\n"),
          ts: nowIso()
        })
        this.broadcastState()
        return
      }

      const creation: DispatchTaskCreationContext = {
        originUserMessage,
        habitAddendum: this.buildHabitAddendum({
          profileText: promptContextBase.profileText,
          memoryHints: promptContextBase.memoryHints
        }),
        retryOfTaskId: task.id,
        retryAttempt: rootAttempt + 1,
        externalSource: task.externalSource
      }
      const optionConfirm: PendingDispatchOption = {
        kind: "dispatch",
        intents: replanned.dispatchIntents,
        assistantText: replanned.assistantText || "已确认失败重分配方案并开始执行。",
        summary: this.buildDispatchOptionSummary(replanned.dispatchIntents),
        capabilitySummary,
        creation
      }
      const optionCancel: PendingDispatchOption = {
        kind: "cancel",
        intents: [],
        assistantText: "已取消本次失败重分配。你可以稍后手动重述需求。",
        summary: "用户取消失败重分配。",
        capabilitySummary,
        creation
      }
      const promptText = this.buildRetryDispatchChoicePrompt(task, errorMessage, optionConfirm)
      const choice: RetryConfirmPendingDispatchChoiceState = {
        kind: "retry_confirm",
        id: uuid(),
        createdAt: nowIso(),
        hint: "检测到失败重分配方案，请回复 确认 或 取消。",
        expectedResponse: "confirm_cancel",
        promptText,
        failedTaskId: task.id,
        optionConfirm,
        optionCancel
      }
      this.schedulePendingDispatchChoice(choice)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: [
          `任务失败：${task.title}`,
          `错误: ${errorMessage}`,
          `自动重分配生成失败：${message}`,
          "请手动重述需求。"
        ].join("\n"),
        ts: nowIso()
      })
      this.broadcastState()
    }
  }

  private handleTaskCompleted(payload: TaskCompletionPayload): void {
    const byThread = this.listTasks()
      .filter((task) => task.threadId === payload.threadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const target = byThread.find((task) => task.status === "running") || byThread[0]

    if (target) {
      const nextStatus: ButlerTaskStatus = payload.error ? "failed" : "completed"
      const wasRunning = target.status === "running"
      target.status = nextStatus
      target.resultBrief = payload.error || payload.result || target.resultBrief
      target.resultDetail = payload.error || payload.result || target.resultDetail
      target.completedAt = payload.finishedAt
      persistButlerTask(target)
      if (wasRunning) {
        this.onTaskSettled(target)
      }
      this.broadcastTasks()

      if (payload.source === "butler" && payload.error) {
        void this.prepareRetryReassignmentForFailure(target, payload.error)
      }
    }
  }

  private broadcastState(): void {
    broadcast("butler:state-changed", this.getState())
  }

  private broadcastTasks(): void {
    broadcast("butler:tasks-changed", this.listTasks())
  }
}

export const butlerManager = new ButlerManager()

// 导出测试可用能力，避免 tree-shaking 下未使用报警。
export function reportButlerThreadCompleted(threadId: string, result?: string): void {
  emitTaskCompleted({ threadId, result, source: "butler" })
}
