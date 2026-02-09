import { BrowserWindow } from "electron"
import { writeFileSync } from "fs"
import { join } from "path"
import { v4 as uuid } from "uuid"
import { createThread as dbCreateThread, getAllThreads, updateThread as dbUpdateThread } from "../db"
import { getSettings } from "../settings"
import { emitTaskCompleted, onTaskCompleted, type TaskCompletionPayload } from "../tasks/lifecycle"
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
import { runButlerOrchestratorTurn, runButlerPerceptionTurn } from "./runtime"
import type { ButlerPromptContext } from "./prompt"
import { createButlerTaskThread, executeButlerTask } from "./task-dispatcher"
import { renderTaskPrompt, type ButlerDispatchIntent } from "./tools"
import type {
  ButlerPerceptionInput,
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

interface PendingDispatchOption {
  kind: "dispatch" | "cancel"
  intents: ButlerDispatchIntent[]
  assistantText: string
  summary: string
}

interface PendingDispatchChoiceState {
  id: string
  createdAt: string
  reason: string
  confidence: number
  optionA: PendingDispatchOption
  optionB: PendingDispatchOption
}

const TASK_NOTICE_MARKER = "[TASK_NOTICE_JSON]"

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
            createdAt: this.pendingDispatchChoice.createdAt
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
      `最近邮件: ${snapshot.recentMails.length}`
    ].join("\n")
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

    const capabilitySnapshot = getButlerCapabilitySnapshot()
    const capabilityCatalog = buildCapabilityPromptBlock(capabilitySnapshot)
    const capabilitySummary = buildCapabilitySummaryLine(capabilitySnapshot)

    if (this.pendingDispatchChoice) {
      return this.handlePendingDispatchChoice(trimmed, capabilitySummary)
    }

    const memoryHints = searchMemoryByTask(trimmed, 5)
    const profile = getLatestDailyProfile()
    const previousUserMessage = this.findPreviousUserMessage(userMessage.id)?.content
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
    const promptContextBase: Omit<ButlerPromptContext, "dispatchPolicy"> = {
      userMessage: trimmed,
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
        capabilitySummary
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
        capabilitySummary
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
          summary: this.buildDispatchOptionSummary(replanned.dispatchIntents)
        }
      } else {
        optionA = {
          kind: "cancel",
          intents: [],
          assistantText: "已取消本次执行，请重述需求后我会重新编排。",
          summary: "单任务重编排未产生可执行的单任务方案。"
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      optionA = {
        kind: "cancel",
        intents: [],
        assistantText: "已取消本次执行，请重述需求后我会重新编排。",
        summary: `单任务重编排失败：${message}`
      }
    }

    const optionB: PendingDispatchOption = {
      kind: "dispatch",
      intents: orchestrator.dispatchIntents,
      assistantText: orchestrator.assistantText || "已按方案B（原始拆分）执行。",
      summary: this.buildDispatchOptionSummary(orchestrator.dispatchIntents)
    }

    this.pendingDispatchChoice = {
      id: uuid(),
      createdAt: nowIso(),
      reason: detection.reason,
      confidence: detection.confidence,
      optionA,
      optionB
    }

    this.pushMessage({
      id: uuid(),
      role: "assistant",
      content: this.buildDispatchChoicePrompt(optionA, optionB, detection.reason, detection.confidence),
      ts: nowIso()
    })
    this.broadcastState()
    return this.getState()
  }

  private handlePendingDispatchChoice(choiceText: string, capabilitySummary: string): ButlerState {
    const pending = this.pendingDispatchChoice
    if (!pending) return this.getState()

    const choice = this.parseChoiceText(choiceText)
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

    const selected = choice === "A" ? pending.optionA : pending.optionB
    this.pendingDispatchChoice = null

    if (selected.kind === "cancel") {
      this.pushMessage({
        id: uuid(),
        role: "assistant",
        content: selected.assistantText,
        ts: nowIso()
      })
      this.broadcastState()
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
      return this.getState()
    }

    return this.dispatchIntentsAndReply({
      intents: selected.intents,
      assistantText: selected.assistantText,
      capabilitySummary
    })
  }

  private parseChoiceText(raw: string): "A" | "B" | null {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, "")
    if (!normalized) return null

    const optionA = new Set(["a", "1", "方案a", "选a", "a方案", "选择a", "a执行"])
    if (optionA.has(normalized)) return "A"

    const optionB = new Set(["b", "2", "方案b", "选b", "b方案", "选择b", "b执行"])
    if (optionB.has(normalized)) return "B"

    return null
  }

  private buildDispatchChoicePrompt(
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
      const deps = intent.dependsOn.length > 0 ? `dependsOn=${intent.dependsOn.join(",")}` : "independent"
      return `${index + 1}. [${intent.mode}] ${intent.title} (${deps})`
    })

    return [
      `任务数: ${intents.length}`,
      `模式分布: ${modeDistribution}`,
      `依赖任务: ${dependentCount}/${intents.length}`,
      ...detailLines
    ].join("\n")
  }

  private dispatchIntentsAndReply(params: {
    intents: ButlerDispatchIntent[]
    assistantText: string
    capabilitySummary: string
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

    const groupId = uuid()
    const sourceTurnId = uuid()
    const created = this.createTasksFromIntents({
      intents: params.intents,
      groupId,
      sourceTurnId
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

  private validateDispatchGraph(intents: ButlerDispatchIntent[]): { ok: true } | { ok: false; error: string } {
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
  }): {
    tasks: ButlerTask[]
    readyTaskIds: string[]
    notes: string[]
  } {
    const { intents, groupId, sourceTurnId } = params
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
        prompt: renderTaskPrompt(intent),
        title: intent.title,
        rootPath: this.getRootPath(),
        requester: "user",
        loopConfig: intent.mode === "loop" ? intent.loopConfig : undefined,
        groupId,
        taskKey: intent.taskKey,
        handoff: intent.handoff,
        sourceTurnId,
        reuseThreadId: reusableThreadId
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
    const preferred = candidates.find((task) => task.status !== "failed" && task.status !== "cancelled")
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
      writeFileSync(join(task.workspacePath, ".butler_handoff.json"), JSON.stringify(payload, null, 2), "utf-8")
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
