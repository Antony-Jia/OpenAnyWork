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
  getLatestDailyProfile,
  loadButlerMessages,
  loadButlerTasks,
  persistButlerTask,
  removeButlerTasks,
  searchMemoryByTask
} from "../memory"
import { broadcastThreadsChanged } from "../ipc/events"
import {
  buildCapabilityPromptBlock,
  buildCapabilitySummaryLine,
  getButlerCapabilitySnapshot
} from "./capabilities"
import { detectOversplitByModel } from "./granularity"
import { runButlerDigestTurn, runButlerOrchestratorTurn, runButlerPerceptionTurn } from "./runtime"
import type { ButlerPromptContext } from "./prompt"
import { createButlerTaskThread, executeButlerTask } from "./task-dispatcher"
import { renderTaskPrompt, type ButlerDispatchIntent } from "./tools"
import { notificationMuteRegistry } from "../notifications/mute-registry"
import type {
  ButlerDigestTaskCard,
  ButlerPerceptionInput,
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
}

interface PendingTask {
  taskId: string
}

interface DispatchTaskCreationContext {
  originUserMessage: string
  habitAddendum: string
  retryOfTaskId?: string
  retryAttempt?: number
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

type PendingDispatchChoiceState =
  | OversplitPendingDispatchChoiceState
  | RetryConfirmPendingDispatchChoiceState
  | WorkspaceMissingPendingDispatchChoiceState

const TASK_NOTICE_MARKER = "[TASK_NOTICE_JSON]"
const TASK_DIGEST_MARKER = "[TASK_DIGEST_JSON]"

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

function extractRecentRounds(messages: ButlerMessage[], limit: number): ButlerRound[] {
  const rounds: ButlerRound[] = []
  let currentUser: ButlerMessage | null = null
  for (const message of messages) {
    if (message.role === "user") {
      if (currentUser) {
        rounds.push({
          id: `${currentUser.id}:pending`,
          user: currentUser.content,
          assistant: "",
          ts: currentUser.ts
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
        ts: message.ts
      })
      currentUser = null
      continue
    }
    if (message.role === "assistant") {
      rounds.push({
        id: `notice:${message.id}`,
        user: "[系统通知]",
        assistant: message.content,
        ts: message.ts
      })
    }
  }
  if (currentUser) {
    rounds.push({
      id: `${currentUser.id}:pending`,
      user: currentUser.content,
      assistant: "",
      ts: currentUser.ts
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

  async initialize(): Promise<void> {
    if (this.initialized) return

    this.mainThreadId = this.ensureMainThread()
    const existingThreadIds = new Set(getAllThreads().map((row) => row.thread_id))
    this.messages = loadButlerMessages().map((entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
      ts: entry.ts
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

  notifyCompletionNotice(notice: TaskCompletionNotice): void {
    const content = [
      `任务完成通知：${notice.title}`,
      `模式: ${notice.mode} | 来源: ${notice.source}`,
      `线程: ${notice.threadId}`,
      `摘要: ${notice.resultBrief || "任务已完成。"}`,
      `${TASK_NOTICE_MARKER}${JSON.stringify(notice)}`
    ].join("\n")

    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content,
      ts: nowIso()
    })
    this.broadcastState()
  }

  notifyLifecycleNotice(notice: TaskLifecycleNotice): void {
    if (notice.phase === "completed") {
      this.notifyCompletionNotice({
        id: notice.id,
        threadId: notice.threadId,
        title: notice.title,
        resultBrief: notice.resultBrief || "任务已完成。",
        resultDetail: notice.resultDetail || notice.resultBrief || "任务已完成。",
        completedAt: notice.at,
        mode: notice.mode,
        source: notice.source,
        noticeType: "task",
        taskIdentity: notice.taskIdentity
      })
      return
    }

    const content = [
      `任务启动通知：${notice.title}`,
      `模式: ${notice.mode} | 来源: ${notice.source}`,
      `线程: ${notice.threadId}`,
      `摘要: ${notice.resultBrief || "任务已开始执行。"}`
    ].join("\n")
    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content,
      ts: nowIso()
    })
    this.broadcastState()
  }

  notifyDigestNotice(notice: TaskCompletionNotice): void {
    if (notice.noticeType !== "digest" || !notice.digest) {
      this.notifyCompletionNotice(notice)
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
      ts: notice.completedAt || nowIso()
    })
    this.broadcastState()
  }

  async summarizeDigest(input: {
    windowStart: string
    windowEnd: string
    tasks: ButlerDigestTaskCard[]
  }): Promise<string> {
    await this.initialize()
    const result = await runButlerDigestTurn({
      threadId: this.mainThreadId,
      digest: input
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
      const result = await runButlerPerceptionTurn({
        threadId: this.mainThreadId,
        perception: input
      })
      reminderText = result.reminderText.trim()
    } catch (error) {
      console.warn("[Butler] runButlerPerceptionTurn failed:", error)
    }

    const finalReminder = reminderText || this.buildPerceptionFallbackText(input)
    const completedAt = nowIso()
    const notice: TaskCompletionNotice = {
      id: `event:${input.id}:${completedAt}`,
      threadId: this.mainThreadId,
      title: input.title,
      resultBrief: finalReminder,
      resultDetail: this.buildPerceptionResultDetail(input, finalReminder),
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
      ts: completedAt
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

  private buildPerceptionResultDetail(input: ButlerPerceptionInput, reminder: string): string {
    const snapshot = input.snapshot
    return [
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
      `最近RSS: ${snapshot.recentRssItems.length}`
    ].join("\n")
  }

  private getCapabilityContext(): { capabilityCatalog: string; capabilitySummary: string } {
    const capabilitySnapshot = getButlerCapabilitySnapshot()
    return {
      capabilityCatalog: buildCapabilityPromptBlock(capabilitySnapshot),
      capabilitySummary: buildCapabilitySummaryLine(capabilitySnapshot)
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

  private buildPromptContextBase(params: {
    userMessage: string
    capabilityCatalog: string
    capabilitySummary: string
    currentUserMessageId?: string
  }): Omit<ButlerPromptContext, "dispatchPolicy"> {
    const { userMessage, capabilityCatalog, capabilitySummary, currentUserMessageId } = params
    const profile = getLatestDailyProfile()
    const previousUserMessage = currentUserMessageId
      ? this.findPreviousUserMessage(currentUserMessageId)?.content
      : this.findLatestUserMessage()?.content
    const memoryHints = searchMemoryByTask(userMessage, 5)
    const recentTasks = this.listTasks()
      .slice(0, 10)
      .map((task) => ({
        id: task.id,
        title: task.title,
        mode: task.mode,
        status: task.status,
        threadId: task.threadId,
        createdAt: task.createdAt
      }))

    return {
      userMessage,
      capabilityCatalog,
      capabilitySummary,
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

  async send(message: string): Promise<ButlerState> {
    await this.initialize()
    const trimmed = message.trim()
    if (!trimmed) return this.getState()

    const userMessage: ButlerMessage = {
      id: uuid(),
      role: "user",
      content: trimmed,
      ts: nowIso()
    }
    this.pushMessage(userMessage)

    if (this.pendingDispatchChoice) {
      return this.handlePendingDispatchChoice(trimmed)
    }

    const { capabilityCatalog, capabilitySummary } = this.getCapabilityContext()
    const promptContextBase = this.buildPromptContextBase({
      userMessage: trimmed,
      capabilityCatalog,
      capabilitySummary,
      currentUserMessageId: userMessage.id
    })
    const creation: DispatchTaskCreationContext = {
      originUserMessage: this.normalizeOriginUserMessage(trimmed),
      habitAddendum: this.buildHabitAddendum({
        profileText: promptContextBase.profileText,
        memoryHints: promptContextBase.memoryHints
      })
    }

    const orchestrator = await runButlerOrchestratorTurn({
      threadId: this.mainThreadId,
      promptContext: {
        ...promptContextBase,
        dispatchPolicy: "standard"
      }
    })

    if (orchestrator.dispatchIntents.length === 0) {
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content:
          orchestrator.assistantText ||
          (orchestrator.clarification ? "请补充关键信息。" : "已记录。"),
        ts: nowIso()
      })
      this.broadcastState()
      return this.getState()
    }

    if (orchestrator.dispatchIntents.length <= 1) {
      return this.dispatchIntentsAndReply({
        intents: orchestrator.dispatchIntents,
        assistantText: orchestrator.assistantText || "已完成任务编排并开始执行。",
        capabilitySummary,
        creation
      })
    }

    const detection = await detectOversplitByModel({
      userMessage: trimmed,
      intents: orchestrator.dispatchIntents
    })
    if (detection.verdict === "valid_multi") {
      return this.dispatchIntentsAndReply({
        intents: orchestrator.dispatchIntents,
        assistantText: orchestrator.assistantText || "已完成任务编排并开始执行。",
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
          assistantText: replanned.assistantText || "已按方案A（单任务优先）执行。",
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
      assistantText: orchestrator.assistantText || "已按方案B（原始拆分）执行。",
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

  private handlePendingDispatchChoice(choiceText: string): ButlerState {
    const pending = this.pendingDispatchChoice
    if (!pending) return this.getState()

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

    const create = new Set([
      "创建",
      "帮我创建",
      "create",
      "yes",
      "y",
      "确认",
      "同意",
      "可以创建"
    ])
    if (create.has(normalized)) return "create"

    const reenter = new Set([
      "重输",
      "重新输入",
      "reenter",
      "no",
      "n",
      "取消",
      "不用",
      "我重输"
    ])
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

    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content: replyLines.join("\n"),
      ts: nowIso()
    })
    this.broadcastState()

    void this.pumpQueue()
    return this.getState()
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
    this.messages.push(message)
    appendButlerHistoryMessage({
      id: message.id,
      role: message.role,
      content: message.content,
      ts: message.ts
    })
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

    for (const intent of intents) {
      const requestedReuse = intent.threadStrategy === "reuse_last_thread"
      const reusableThreadId = requestedReuse ? this.findReusableThreadId(intent.mode) : undefined
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
        retryAttempt: creation.retryAttempt
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
        retryAttempt: rootAttempt + 1
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
