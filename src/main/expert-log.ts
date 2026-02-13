import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "fs"
import { getThreadExpertLogPath } from "./storage"
import type { ExpertLogEntry } from "./types"

export const MAX_EXPERT_LOG_ENTRIES = 1000

export function appendExpertLogEntry(threadId: string, entry: ExpertLogEntry): void {
  const logPath = getThreadExpertLogPath(threadId)
  try {
    appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf-8")
  } catch (error) {
    console.warn("[ExpertLog] Failed to append entry:", error)
    return
  }

  try {
    const content = readFileSync(logPath, "utf-8")
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length <= MAX_EXPERT_LOG_ENTRIES) {
      return
    }

    const trimmed = lines.slice(-MAX_EXPERT_LOG_ENTRIES)
    writeFileSync(logPath, trimmed.join("\n") + "\n", "utf-8")
  } catch (error) {
    console.warn("[ExpertLog] Failed to trim log:", error)
  }
}

export function readExpertLogTail(threadId: string, limit = 200): ExpertLogEntry[] {
  const logPath = getThreadExpertLogPath(threadId)
  if (!existsSync(logPath)) {
    return []
  }

  try {
    const content = readFileSync(logPath, "utf-8")
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(-limit)

    const entries: ExpertLogEntry[] = []
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as ExpertLogEntry)
      } catch {
        // Skip malformed lines.
      }
    }
    return entries
  } catch (error) {
    console.warn("[ExpertLog] Failed to read log:", error)
    return []
  }
}

export function deleteExpertLog(threadId: string): void {
  const logPath = getThreadExpertLogPath(threadId)
  if (!existsSync(logPath)) return
  try {
    unlinkSync(logPath)
  } catch (error) {
    console.warn("[ExpertLog] Failed to delete log:", error)
  }
}
