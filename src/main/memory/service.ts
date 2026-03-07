import { getThread } from "../db"
import { getCheckpointer } from "../agent/runtime"
import {
  onTaskCompleted,
  onTaskStarted,
  type TaskCompletionPayload,
  type TaskStartedPayload
} from "../tasks/lifecycle"
import { buildDailyProfileInput, getTodayLocalDay, getYesterdayLocalDay } from "./daily-profile"
import { summarizeTaskMemory } from "./summarizer"
import {
  appendButlerMessage,
  clearAllTaskSummaries,
  clearButlerMessages,
  clearDailyProfiles,
  clearMemoryEntities,
  clearMemoryEvents,
  clearMemoryRangeSummaries,
  clearRunMarkers,
  clearWorkingMemorySnapshot,
  deleteButlerTasksByIds,
  deleteTaskSummariesByThread,
  getDailyProfile,
  getMemoryRangeSummary,
  getPreviousDailyProfile,
  getWorkingMemorySnapshotRow,
  hasRunMarker,
  initializeMemoryDatabase,
  insertMemoryEvent,
  insertTaskSummary,
  listButlerMessages,
  listButlerTasks,
  listDailyProfiles as listDailyProfilesFromStorage,
  listMemoryEntities,
  listMemoryEvents,
  listMemoryEventsByRange,
  listTaskSummaries,
  listTaskSummariesByDay,
  searchMemoryEvents,
  searchTaskSummaries,
  setRunMarker,
  upsertButlerTask,
  upsertDailyProfile,
  upsertMemoryEntity,
  upsertMemoryRangeSummary,
  upsertWorkingMemorySnapshot
} from "./storage"
import type {
  ButlerMessageInput,
  ButlerTaskRow,
  DailyProfileRow,
  MemoryEntityRow,
  MemoryEntityUpsertInput,
  MemoryEventInput,
  MemoryEventRow,
  MemoryTaskSummaryRow,
  WorkingMemorySnapshotRow
} from "./types"
import type {
  ButlerTask,
  DailyProfile,
  MemoryEntity,
  MemoryEntityType,
  MemoryEvent,
  MemoryRangeSummary,
  MemoryRangeSummaryQuery,
  MemorySearchQuery,
  MemorySearchResult,
  MemorySourceType,
  MemorySummary,
  WorkingMemorySnapshot
} from "../types"

const WORKING_MEMORY_ID = "default"
const WORKING_MEMORY_BUDGET = 4200
const SECTION_BUDGET = {
  last24hMessages: 1200,
  habits: 420,
  preferences: 420,
  facts: 540,
  openLoops: 520,
  toolingLearnings: 420,
  recentTaskOutcomes: 620
} as const

let memoryServiceStarted = false
let unsubscribeTaskCompleted: (() => void) | null = null
let unsubscribeTaskStarted: (() => void) | null = null
let workingSnapshotCache: WorkingMemorySnapshot | null = null
let ingestQueue: Promise<void> = Promise.resolve()

interface ParsedCheckpointMessages {
  userMessages: string[]
  assistantMessages: string[]
  toolNames: string[]
}

function nowIso(): string {
  return new Date().toISOString()
}

function compact(text: string, maxLength: number): string {
  const value = text.trim().replace(/\s+/g, " ")
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .filter(
        (entry): entry is { type?: string; text?: string } => !!entry && typeof entry === "object"
      )
      .map((entry) => (entry.type === "text" ? (entry.text ?? "") : ""))
      .join("")
  }
  return ""
}

function parseCheckpointMessages(data: unknown[]): ParsedCheckpointMessages {
  const userMessages: string[] = []
  const assistantMessages: string[] = []
  const toolNames: string[] = []
  const first = data[0] as
    | {
        checkpoint?: {
          channel_values?: {
            messages?: Array<{
              kwargs?: { content?: unknown; tool_calls?: Array<{ name?: string }> }
              content?: unknown
              tool_calls?: Array<{ name?: string }>
              type?: string
              _getType?: () => string
            }>
          }
        }
      }
    | undefined
  const messages = first?.checkpoint?.channel_values?.messages
  if (!Array.isArray(messages)) return { userMessages, assistantMessages, toolNames }
  for (const message of messages) {
    const type = (typeof message._getType === "function" ? message._getType() : undefined) ?? message.type ?? ""
    const content = extractTextContent(message.kwargs?.content ?? message.content)
    if (type === "human" && content.trim()) userMessages.push(content.trim())
    if (type === "ai" && content.trim()) assistantMessages.push(content.trim())
    const calls = message.kwargs?.tool_calls ?? message.tool_calls ?? []
    for (const call of calls) {
      if (call?.name) toolNames.push(call.name)
    }
  }
  return { userMessages, assistantMessages, toolNames }
}

async function loadThreadProcess(threadId: string): Promise<ParsedCheckpointMessages> {
  try {
    const checkpointer = await getCheckpointer(threadId)
    const list: unknown[] = []
    for await (const checkpoint of checkpointer.list({ configurable: { thread_id: threadId } }, { limit: 1 })) {
      list.push(checkpoint)
    }
    return parseCheckpointMessages(list)
  } catch (error) {
    console.warn("[Memory] Failed to load checkpoint history:", error)
    return { userMessages: [], assistantMessages: [], toolNames: [] }
  }
}

function buildDefaultWorkingSnapshot(): WorkingMemorySnapshot {
  const snapshot: WorkingMemorySnapshot = {
    id: WORKING_MEMORY_ID,
    updatedAt: nowIso(),
    budgetChars: WORKING_MEMORY_BUDGET,
    recentOverview: "用户近期活动仍在逐步构建。",
    last24hMessages: "",
    habits: "",
    preferences: "",
    facts: "",
    openLoops: "",
    toolingLearnings: "",
    recentTaskOutcomes: "",
    text: ""
  }
  snapshot.text = buildWorkingMemoryText(snapshot)
  return snapshot
}

function buildWorkingMemoryText(snapshot: Omit<WorkingMemorySnapshot, "text">): string {
  return [
    "[Recent Overview]",
    snapshot.recentOverview || "none",
    "",
    "[Last 24h Messages]",
    snapshot.last24hMessages || "none",
    "",
    "[Habits]",
    snapshot.habits || "none",
    "",
    "[Preferences]",
    snapshot.preferences || "none",
    "",
    "[Facts]",
    snapshot.facts || "none",
    "",
    "[Open Loops]",
    snapshot.openLoops || "none",
    "",
    "[Tooling Learnings]",
    snapshot.toolingLearnings || "none",
    "",
    "[Recent Task Outcomes]",
    snapshot.recentTaskOutcomes || "none"
  ].join("\n")
}

function hydrateWorkingSnapshot(row: WorkingMemorySnapshotRow | null): WorkingMemorySnapshot {
  if (!row) return buildDefaultWorkingSnapshot()
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    budgetChars: row.budgetChars,
    recentOverview: row.recentOverview,
    last24hMessages: row.last24hMessages,
    habits: row.habits,
    preferences: row.preferences,
    facts: row.facts,
    openLoops: row.openLoops,
    toolingLearnings: row.toolingLearnings,
    recentTaskOutcomes: row.recentTaskOutcomes,
    text: row.text || buildWorkingMemoryText(row)
  }
}

function loadWorkingSnapshot(): WorkingMemorySnapshot {
  if (workingSnapshotCache) return workingSnapshotCache
  workingSnapshotCache = hydrateWorkingSnapshot(getWorkingMemorySnapshotRow(WORKING_MEMORY_ID))
  return workingSnapshotCache
}

function persistWorkingSnapshot(snapshot: WorkingMemorySnapshot): WorkingMemorySnapshot {
  const next = { ...snapshot, text: buildWorkingMemoryText(snapshot) }
  const row = upsertWorkingMemorySnapshot({
    id: next.id,
    updatedAt: next.updatedAt,
    budgetChars: next.budgetChars,
    recentOverview: next.recentOverview,
    last24hMessages: next.last24hMessages,
    habits: next.habits,
    preferences: next.preferences,
    facts: next.facts,
    openLoops: next.openLoops,
    toolingLearnings: next.toolingLearnings,
    recentTaskOutcomes: next.recentTaskOutcomes,
    text: next.text
  })
  workingSnapshotCache = hydrateWorkingSnapshot(row)
  return workingSnapshotCache
}

function appendSection(existing: string, line: string, maxChars: number, maxLines = 8): string {
  const normalized = compact(line, Math.min(maxChars, 220))
  if (!normalized) return existing
  const lines = existing
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== normalized)
  const next = [normalized, ...lines]
  const kept: string[] = []
  let total = 0
  for (const item of next) {
    const added = item.length + (kept.length > 0 ? 1 : 0)
    if (kept.length >= maxLines || total + added > maxChars) break
    kept.push(item)
    total += added
  }
  return kept.join("\n")
}

function mapButlerSourceTypeToMemory(sourceType?: ButlerMessageInput["sourceType"]): MemorySourceType | null {
  if (!sourceType) return null
  if (sourceType === "user_message") return "butler_dialogue"
  if (sourceType === "orchestrator") return "butler_comment"
  if (sourceType === "task_lifecycle") return "task_lifecycle"
  if (sourceType === "subscription_event") return "subscription_event"
  if (sourceType === "service_digest") return "service_digest"
  return null
}

function detectSourceType(message: ButlerMessageInput): MemorySourceType {
  const mapped = mapButlerSourceTypeToMemory(message.sourceType)
  if (mapped) return mapped
  if (message.role === "user") return "butler_dialogue"
  if (message.noticeType === "event") return "subscription_event"
  if (message.noticeType === "digest") return "service_digest"
  if (message.noticeType === "task") return "task_lifecycle"
  return "butler_comment"
}

function detectCategory(message: ButlerMessageInput): string {
  if (message.noticeType === "event") return "subscription_event"
  if (message.noticeType === "digest") return "service_digest"
  if (message.noticeType === "task") return "task_comment"
  return message.role === "user" ? "butler_dialogue" : "butler_comment"
}

function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
  const parts = normalized.split(/\s+/).filter((item) => item.length >= 2)
  return Array.from(new Set(parts)).slice(0, 12)
}

function maybePushEntity(target: MemoryEntityUpsertInput[], entry: MemoryEntityUpsertInput | null): void {
  if (entry) target.push(entry)
}

function extractEntitiesFromEvent(event: MemoryEventRow): MemoryEntityUpsertInput[] {
  const result: MemoryEntityUpsertInput[] = []
  const metadata = event.metadata ?? {}
  const sourceRef = event.id
  const seenAt = event.occurredAt
  const labeledValues: Array<[MemoryEntityType, string, unknown]> = [
    ["task_category", "task_direction", metadata["taskDirection"]],
    ["habit", "usage_habit", metadata["usageHabits"]],
    ["interest", "interest", metadata["hobbies"]],
    ["preference", "report_preference", metadata["reportPreference"]],
    ["tooling_pattern", "research_process", metadata["researchProcess"]]
  ]
  for (const [type, name, value] of labeledValues) {
    if (typeof value === "string" && value.trim()) {
      result.push({ type, name, value: value.trim(), confidence: 0.72, seenAt, sourceRef })
    }
  }

  const toolNames = Array.isArray(metadata["toolNames"]) ? metadata["toolNames"] : []
  for (const toolName of toolNames) {
    if (typeof toolName === "string" && toolName.trim()) {
      result.push({
        type: "tooling_pattern",
        name: "tool",
        value: toolName.trim(),
        confidence: 0.7,
        seenAt,
        sourceRef
      })
    }
  }

  const skills = Array.isArray(metadata["skillsUsed"]) ? metadata["skillsUsed"] : []
  for (const skill of skills) {
    if (typeof skill === "string" && skill.trim()) {
      result.push({
        type: "tooling_pattern",
        name: "skill",
        value: skill.trim(),
        confidence: 0.68,
        seenAt,
        sourceRef
      })
    }
  }

  const mcpServers = Array.isArray(metadata["mcpServers"]) ? metadata["mcpServers"] : []
  for (const server of mcpServers) {
    if (typeof server === "string" && server.trim()) {
      result.push({
        type: "tooling_pattern",
        name: "mcp",
        value: server.trim(),
        confidence: 0.68,
        seenAt,
        sourceRef
      })
    }
  }

  maybePushEntity(
    result,
    event.category === "task_started"
      ? { type: "task_category", name: "task_state", value: "active_task", confidence: 0.55, seenAt, sourceRef }
      : null
  )
  return result
}

function buildWorkingLine(event: MemoryEventRow): string {
  const ageMs = Date.now() - Date.parse(event.occurredAt)
  const timeLabel = event.occurredAt.slice(11, 16)
  if (Number.isFinite(ageMs) && ageMs <= 3 * 60 * 60 * 1000) {
    return `${timeLabel} | ${event.category} | ${compact(event.title || event.summary, 120)}`
  }
  return `${event.day} | ${event.category} | ${compact(event.summary, 120)}`
}

function rebuildOverview(snapshot: WorkingMemorySnapshot): string {
  const summaryParts = [
    snapshot.last24hMessages.split("\n")[0],
    snapshot.openLoops.split("\n")[0],
    snapshot.recentTaskOutcomes.split("\n")[0]
  ].filter(Boolean)
  return compact(summaryParts.join(" | ") || "用户近期活动仍在逐步构建。", 280)
}

function updateWorkingSnapshotFromEvent(event: MemoryEventRow): WorkingMemorySnapshot {
  const snapshot = loadWorkingSnapshot()
  const line = buildWorkingLine(event)
  const metadata = event.metadata ?? {}

  snapshot.last24hMessages = appendSection(snapshot.last24hMessages, line, SECTION_BUDGET.last24hMessages, 10)
  if (event.sourceType === "task_result" || event.sourceType === "service_digest") {
    snapshot.recentTaskOutcomes = appendSection(snapshot.recentTaskOutcomes, `${event.title}: ${event.summary}`, SECTION_BUDGET.recentTaskOutcomes)
  }
  if (event.category === "task_started" || event.category === "subscription_event") {
    snapshot.openLoops = appendSection(snapshot.openLoops, `${event.title}: ${event.summary}`, SECTION_BUDGET.openLoops)
  }
  if (event.category === "task_completed" || event.category === "task_failed") {
    snapshot.openLoops = appendSection(snapshot.openLoops, `已完成/结束: ${event.title}`, SECTION_BUDGET.openLoops)
  }

  if (typeof metadata["usageHabits"] === "string") {
    snapshot.habits = appendSection(snapshot.habits, metadata["usageHabits"], SECTION_BUDGET.habits)
  }
  if (typeof metadata["reportPreference"] === "string") {
    snapshot.preferences = appendSection(snapshot.preferences, metadata["reportPreference"], SECTION_BUDGET.preferences)
  }
  if (typeof metadata["hobbies"] === "string") {
    snapshot.facts = appendSection(snapshot.facts, `兴趣: ${metadata["hobbies"]}`, SECTION_BUDGET.facts)
  }
  if (typeof metadata["taskDirection"] === "string") {
    snapshot.facts = appendSection(snapshot.facts, `常见任务: ${metadata["taskDirection"]}`, SECTION_BUDGET.facts)
  }
  if (typeof metadata["researchProcess"] === "string") {
    snapshot.toolingLearnings = appendSection(snapshot.toolingLearnings, metadata["researchProcess"], SECTION_BUDGET.toolingLearnings)
  }
  const toolNames = Array.isArray(metadata["toolNames"]) ? metadata["toolNames"] : []
  if (toolNames.length > 0) {
    snapshot.toolingLearnings = appendSection(snapshot.toolingLearnings, `常用工具: ${toolNames.join(", ")}`, SECTION_BUDGET.toolingLearnings)
  }

  snapshot.updatedAt = nowIso()
  snapshot.recentOverview = rebuildOverview(snapshot)
  if (buildWorkingMemoryText(snapshot).length > snapshot.budgetChars) {
    snapshot.last24hMessages = appendSection(snapshot.last24hMessages, "更早记录已压缩进近期概览。", Math.floor(SECTION_BUDGET.last24hMessages * 0.75), 6)
    snapshot.recentOverview = rebuildOverview(snapshot)
  }
  return persistWorkingSnapshot(snapshot)
}

function recordEntitiesFromEvent(event: MemoryEventRow): void {
  for (const entity of extractEntitiesFromEvent(event)) {
    upsertMemoryEntity(entity)
  }
}

function queueIngest(work: () => Promise<void>): Promise<void> {
  ingestQueue = ingestQueue.then(work, work).catch((error) => {
    console.warn("[Memory] ingest failed:", error)
  })
  return ingestQueue
}

async function ingestMemoryEventInternal(input: MemoryEventInput): Promise<MemoryEventRow> {
  const { row: event, inserted } = insertMemoryEvent({
    ...input,
    keywords: input.keywords ?? extractKeywords(`${input.title} ${input.summary} ${input.detail ?? ""}`)
  })
  if (!inserted) {
    return event
  }
  recordEntitiesFromEvent(event)
  updateWorkingSnapshotFromEvent(event)
  clearMemoryRangeSummaries()
  return event
}

async function recordTaskCompletionToMemory(payload: TaskCompletionPayload): Promise<void> {
  const metadata = payload.metadata || {}
  if (metadata.butlerMain === true || payload.mode === "butler") return

  const process = await loadThreadProcess(payload.threadId)
  const summary = summarizeTaskMemory({
    payload,
    userMessages: process.userMessages,
    assistantMessages: process.assistantMessages,
    toolNames: process.toolNames
  })
  insertTaskSummary(summary)
  await ingestMemoryEventInternal({
    sourceType: "task_result",
    sourceId: `task-result:${payload.threadId}:${payload.finishedAt}`,
    occurredAt: payload.finishedAt,
    category: payload.error ? "task_failed" : "task_completed",
    title: payload.title || summary.title || "Task Result",
    summary: summary.summaryBrief,
    detail: summary.summaryDetail,
    threadId: payload.threadId,
    taskId: String(payload.metadata?.butlerTaskId ?? ""),
    keywords: extractKeywords(`${summary.summaryBrief} ${summary.summaryDetail}`),
    metadata: {
      mode: payload.mode,
      taskDirection: summary.taskDirection,
      usageHabits: summary.usageHabits,
      hobbies: summary.hobbies,
      researchProcess: summary.researchProcess,
      reportPreference: summary.reportPreference,
      toolNames: process.toolNames,
      userMessages: process.userMessages.slice(-3),
      assistantMessages: process.assistantMessages.slice(-2)
    }
  })
}

async function recordTaskStartedToMemory(payload: TaskStartedPayload): Promise<void> {
  const metadata = payload.metadata || {}
  if (metadata.butlerMain === true || payload.mode === "butler") return
  await ingestMemoryEventInternal({
    sourceType: "task_lifecycle",
    sourceId: `task-started:${payload.threadId}:${payload.startedAt}`,
    occurredAt: payload.startedAt,
    category: "task_started",
    title: payload.title || "Task Started",
    summary: `任务开始执行：${payload.title || payload.threadId}`,
    detail: `模式: ${payload.mode}\n来源: ${payload.source}`,
    threadId: payload.threadId,
    taskId: typeof payload.metadata?.butlerTaskId === "string" ? payload.metadata.butlerTaskId : undefined,
    metadata: { ...payload.metadata, mode: payload.mode, source: payload.source }
  })
}

function mapEventRow(row: MemoryEventRow): MemoryEvent {
  return { ...row }
}

function mapEntityRow(row: MemoryEntityRow): MemoryEntity {
  return { ...row }
}

function resolveRange(query: MemoryRangeSummaryQuery): { from: string; to: string; preset?: MemoryRangeSummaryQuery["preset"] } {
  const now = new Date()
  const preset = query.preset ?? "custom"
  if (preset === "today") {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: now.toISOString(), preset }
  }
  if (preset === "yesterday") {
    const start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    return { from: start.toISOString(), to: end.toISOString(), preset }
  }
  if (preset === "this_week") {
    const start = new Date(now)
    const weekday = start.getDay() || 7
    start.setDate(start.getDate() - weekday + 1)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: now.toISOString(), preset }
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: now.toISOString(), preset }
  }
  return {
    from: query.from ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    to: query.to ?? now.toISOString(),
    preset: query.preset
  }
}

function buildRangeSummaryText(events: MemoryEventRow[]): { summaryText: string; highlights: string[] } {
  if (events.length === 0) {
    return { summaryText: "该时间范围内暂无可用记忆。", highlights: [] }
  }
  const categoryCounts = new Map<string, number>()
  const highlights: string[] = []
  for (const event of events.slice(0, 5)) {
    highlights.push(`${event.day} ${event.title}: ${compact(event.summary, 100)}`)
  }
  for (const event of events) {
    categoryCounts.set(event.category, (categoryCounts.get(event.category) ?? 0) + 1)
  }
  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${name} x${count}`)
  return {
    summaryText: compact(`共记录 ${events.length} 条事件。重点集中在 ${topCategories.join("，")}。最近事项包括：${highlights.join("；")}`, 480),
    highlights
  }
}

export async function initializeMemoryService(): Promise<void> {
  if (memoryServiceStarted) return
  await initializeMemoryDatabase()
  workingSnapshotCache = hydrateWorkingSnapshot(getWorkingMemorySnapshotRow(WORKING_MEMORY_ID))

  unsubscribeTaskStarted = onTaskStarted((payload) => {
    void queueIngest(() => recordTaskStartedToMemory(payload))
  })
  unsubscribeTaskCompleted = onTaskCompleted((payload) => {
    void queueIngest(() => recordTaskCompletionToMemory(payload))
  })

  memoryServiceStarted = true
  if (listMemoryEvents(1).length === 0) {
    await rebuildMemoryFromLegacyData()
  }
}

export async function stopMemoryService(): Promise<void> {
  unsubscribeTaskStarted?.()
  unsubscribeTaskCompleted?.()
  unsubscribeTaskStarted = null
  unsubscribeTaskCompleted = null
  await ingestQueue
  memoryServiceStarted = false
}

export function searchMemoryByTask(query: string, limit = 20): MemoryTaskSummaryRow[] {
  const summaryRows = searchTaskSummaries(query, limit)
  if (summaryRows.length > 0) return summaryRows
  return searchMemoryEvents({ text: query, limit })
    .map((event) => ({
      id: event.id,
      threadId: event.threadId || "memory",
      mode: "default" as const,
      title: event.title,
      summaryBrief: event.summary,
      summaryDetail: event.detail,
      createdAt: event.occurredAt
    }))
    .slice(0, limit)
}

export function listConversationSummaries(limit = 200): MemorySummary[] {
  return listTaskSummaries(limit)
}

export function listDailyProfiles(limit = 60): DailyProfile[] {
  return listDailyProfilesFromStorage(limit)
}

export function removeConversationMemoryByThread(threadId: string): void {
  const normalized = threadId.trim()
  if (!normalized) return
  deleteTaskSummariesByThread(normalized)
}

export function clearAllMemory(): void {
  clearAllTaskSummaries()
  clearDailyProfiles()
  clearRunMarkers()
  clearButlerMessages()
  clearMemoryEvents()
  clearMemoryEntities()
  clearMemoryRangeSummaries()
  clearWorkingMemorySnapshot(WORKING_MEMORY_ID)
  workingSnapshotCache = buildDefaultWorkingSnapshot()
}

export async function generateDailyProfileOnStartup(now = new Date()): Promise<DailyProfileRow | null> {
  const today = getTodayLocalDay(now)
  const runKey = `daily-profile:${today}`
  if (hasRunMarker(runKey)) return null
  const targetDay = getYesterdayLocalDay(now)
  const summaries = listTaskSummariesByDay(targetDay)
  const previous = getPreviousDailyProfile(targetDay)
  const input = buildDailyProfileInput({
    day: targetDay,
    summaries,
    previousProfileDay: previous?.day,
    previousProfileText: previous?.profileText
  })
  const profile = upsertDailyProfile(input)
  setRunMarker(runKey, profile.createdAt)
  return profile
}

export function getLatestDailyProfile(): DailyProfileRow | null {
  const today = getTodayLocalDay(new Date())
  return getDailyProfile(today) ?? getPreviousDailyProfile(today)
}

export function loadButlerMessages(): ButlerMessageInput[] {
  return listButlerMessages()
}

export function appendButlerHistoryMessage(message: ButlerMessageInput): void {
  appendButlerMessage(message)
  void queueIngest(async () => {
    await ingestMemoryEventInternal({
      sourceType: detectSourceType(message),
      sourceId: `butler-message:${message.id}`,
      occurredAt: message.ts,
      category: detectCategory(message),
      title: message.noticeType ? `${message.noticeType}:${compact(message.content, 80)}` : compact(message.content, 80),
      summary: compact(message.content, 240),
      detail: message.content,
      threadId: message.relatedThreadId,
      taskId: message.relatedTaskId,
      metadata: {
        role: message.role,
        kind: message.kind,
        sourceType: message.sourceType,
        noticeType: message.noticeType,
        ...(message.metadata ?? {})
      }
    })
  })
}

export function clearButlerHistoryMessages(): void {
  clearButlerMessages()
}

export function persistButlerTask(task: ButlerTask): void {
  upsertButlerTask(task)
}

export function loadButlerTasks(): ButlerTask[] {
  const rows: ButlerTaskRow[] = listButlerTasks()
  return rows.map((row) => row.payload)
}

export function removeButlerTasks(taskIds: string[]): void {
  deleteButlerTasksByIds(taskIds)
}

export function getThreadContextByMemory(threadId: string): { threadId: string; title?: string } | null {
  const row = getThread(threadId)
  if (!row) return null
  return { threadId: row.thread_id, title: row.title ?? undefined }
}

export function getWorkingMemorySnapshot(): WorkingMemorySnapshot {
  return loadWorkingSnapshot()
}

export function clearWorkingSnapshot(): WorkingMemorySnapshot {
  clearWorkingMemorySnapshot(WORKING_MEMORY_ID)
  workingSnapshotCache = buildDefaultWorkingSnapshot()
  return persistWorkingSnapshot(workingSnapshotCache)
}

export async function refreshWorkingMemorySnapshot(_reason = "manual"): Promise<WorkingMemorySnapshot> {
  const snapshot = buildDefaultWorkingSnapshot()
  workingSnapshotCache = snapshot
  for (const event of listMemoryEvents(200).reverse()) {
    updateWorkingSnapshotFromEvent(event)
  }
  return loadWorkingSnapshot()
}

export async function ingestMemoryEvent(input: MemoryEventInput): Promise<MemoryEvent | null> {
  await initializeMemoryService()
  let stored: MemoryEventRow | null = null
  await queueIngest(async () => {
    stored = await ingestMemoryEventInternal(input)
  })
  return stored ? mapEventRow(stored) : null
}

export function searchMemory(query: string | MemorySearchQuery): MemorySearchResult {
  const normalized: MemorySearchQuery = typeof query === "string" ? { text: query } : query
  const events = searchMemoryEvents(normalized).map(mapEventRow)
  const entities = listMemoryEntities(undefined, {
    text: normalized.text,
    limit: Math.max(20, Math.min(200, normalized.limit ?? 50))
  }).map(mapEntityRow)
  return {
    events,
    entities,
    total: events.length,
    workingSnapshot: getWorkingMemorySnapshot()
  }
}

export function getMemoryEntities(
  type?: MemoryEntityType,
  filters?: { text?: string; limit?: number }
): MemoryEntity[] {
  return listMemoryEntities(type, filters).map(mapEntityRow)
}

export function getRangeSummary(query: MemoryRangeSummaryQuery): MemoryRangeSummary {
  const range = resolveRange(query)
  const categories = query.categories ?? []
  const rangeKey = JSON.stringify({ ...range, categories })
  const cached = getMemoryRangeSummary(rangeKey)
  if (cached) {
    return {
      id: cached.id,
      from: cached.from,
      to: cached.to,
      preset: cached.preset,
      categories: cached.categories,
      summaryText: cached.summaryText,
      highlights: cached.highlights,
      eventCount: cached.eventCount,
      generatedAt: cached.generatedAt
    }
  }

  const events = listMemoryEventsByRange(range.from, range.to, categories, 1000)
  const summary = buildRangeSummaryText(events)
  const saved = upsertMemoryRangeSummary({
    rangeKey,
    from: range.from,
    to: range.to,
    preset: range.preset,
    categories,
    summaryText: summary.summaryText,
    highlights: summary.highlights,
    eventCount: events.length
  })
  return {
    id: saved.id,
    from: saved.from,
    to: saved.to,
    preset: saved.preset,
    categories: saved.categories,
    summaryText: saved.summaryText,
    highlights: saved.highlights,
    eventCount: saved.eventCount,
    generatedAt: saved.generatedAt
  }
}

export async function rebuildMemoryFromLegacyData(): Promise<void> {
  clearMemoryEvents()
  clearMemoryEntities()
  clearMemoryRangeSummaries()
  clearWorkingMemorySnapshot(WORKING_MEMORY_ID)
  workingSnapshotCache = buildDefaultWorkingSnapshot()

  for (const message of listButlerMessages()) {
    await ingestMemoryEventInternal({
      sourceType: detectSourceType(message),
      sourceId: `legacy:butler-message:${message.id}`,
      occurredAt: message.ts,
      category: detectCategory(message),
      title: compact(message.content, 80),
      summary: compact(message.content, 240),
      detail: message.content,
      threadId: message.relatedThreadId,
      taskId: message.relatedTaskId,
      metadata: {
        role: message.role,
        kind: message.kind,
        sourceType: message.sourceType,
        noticeType: message.noticeType,
        ...(message.metadata ?? {})
      }
    })
  }

  for (const summary of listTaskSummaries(500)) {
    await ingestMemoryEventInternal({
      sourceType: "task_result",
      sourceId: `legacy:task-summary:${summary.id}`,
      occurredAt: summary.createdAt,
      category: "task_completed",
      title: summary.title || "Legacy Task Summary",
      summary: summary.summaryBrief,
      detail: summary.summaryDetail,
      threadId: summary.threadId,
      metadata: {
        mode: summary.mode,
        taskDirection: summary.taskDirection,
        usageHabits: summary.usageHabits,
        hobbies: summary.hobbies,
        researchProcess: summary.researchProcess,
        reportPreference: summary.reportPreference
      }
    })
  }

  await refreshWorkingMemorySnapshot("legacy_rebuild")
}
