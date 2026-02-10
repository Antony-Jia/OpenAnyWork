import { getThread } from "../db"
import { getCheckpointer } from "../agent/runtime"
import { onTaskCompleted, type TaskCompletionPayload } from "../tasks/lifecycle"
import { buildDailyProfileInput, getTodayLocalDay, getYesterdayLocalDay } from "./daily-profile"
import { summarizeTaskMemory } from "./summarizer"
import {
  appendButlerMessage,
  clearAllTaskSummaries,
  clearButlerMessages,
  clearDailyProfiles,
  clearRunMarkers,
  deleteButlerTasksByIds,
  deleteTaskSummariesByThread,
  getDailyProfile,
  getPreviousDailyProfile,
  hasRunMarker,
  initializeMemoryDatabase,
  insertTaskSummary,
  listDailyProfiles as listDailyProfilesFromStorage,
  listButlerMessages,
  listButlerTasks,
  listTaskSummaries,
  listTaskSummariesByDay,
  searchTaskSummaries,
  setRunMarker,
  upsertButlerTask,
  upsertDailyProfile
} from "./storage"
import type {
  ButlerMessageInput,
  ButlerTaskRow,
  DailyProfileRow,
  MemoryTaskSummaryRow
} from "./types"
import type { ButlerTask, DailyProfile, MemorySummary } from "../types"

let memoryServiceStarted = false
let unsubscribeTaskCompleted: (() => void) | null = null

interface ParsedCheckpointMessages {
  userMessages: string[]
  assistantMessages: string[]
  toolNames: string[]
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
              id?: unknown
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
  if (!Array.isArray(messages)) {
    return { userMessages, assistantMessages, toolNames }
  }

  for (const message of messages) {
    const type =
      (typeof message._getType === "function" ? message._getType() : undefined) ??
      message.type ??
      ""

    const content = extractTextContent(message.kwargs?.content ?? message.content)
    if (type === "human" && content.trim()) {
      userMessages.push(content.trim())
    } else if (type === "ai" && content.trim()) {
      assistantMessages.push(content.trim())
    }

    const calls = message.kwargs?.tool_calls ?? message.tool_calls ?? []
    for (const call of calls) {
      if (call?.name) {
        toolNames.push(call.name)
      }
    }
  }

  return { userMessages, assistantMessages, toolNames }
}

async function loadThreadProcess(threadId: string): Promise<ParsedCheckpointMessages> {
  try {
    const checkpointer = await getCheckpointer(threadId)
    const list: unknown[] = []
    for await (const checkpoint of checkpointer.list(
      { configurable: { thread_id: threadId } },
      { limit: 1 }
    )) {
      list.push(checkpoint)
    }
    return parseCheckpointMessages(list)
  } catch (error) {
    console.warn("[Memory] Failed to load checkpoint history:", error)
    return { userMessages: [], assistantMessages: [], toolNames: [] }
  }
}

async function recordTaskCompletionToMemory(payload: TaskCompletionPayload): Promise<void> {
  const metadata = payload.metadata || {}

  // 管家主会话不写入记忆库。
  if (metadata.butlerMain === true || payload.mode === "butler") {
    return
  }

  const process = await loadThreadProcess(payload.threadId)
  const summary = summarizeTaskMemory({
    payload,
    userMessages: process.userMessages,
    assistantMessages: process.assistantMessages,
    toolNames: process.toolNames
  })
  insertTaskSummary(summary)
}

export async function initializeMemoryService(): Promise<void> {
  if (memoryServiceStarted) return
  await initializeMemoryDatabase()

  unsubscribeTaskCompleted = onTaskCompleted((payload) => {
    void recordTaskCompletionToMemory(payload)
  })

  memoryServiceStarted = true
}

export async function stopMemoryService(): Promise<void> {
  if (unsubscribeTaskCompleted) {
    unsubscribeTaskCompleted()
    unsubscribeTaskCompleted = null
  }
  memoryServiceStarted = false
}

export function searchMemoryByTask(query: string, limit = 20): MemoryTaskSummaryRow[] {
  return searchTaskSummaries(query, limit)
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
}

export async function generateDailyProfileOnStartup(
  now = new Date()
): Promise<DailyProfileRow | null> {
  const today = getTodayLocalDay(now)
  const runKey = `daily-profile:${today}`
  if (hasRunMarker(runKey)) {
    return null
  }

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

export function getThreadContextByMemory(
  threadId: string
): { threadId: string; title?: string } | null {
  const row = getThread(threadId)
  if (!row) return null
  return { threadId: row.thread_id, title: row.title ?? undefined }
}
