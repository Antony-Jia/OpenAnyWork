import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs"
import { getThreadRalphLogPath } from "./storage"
import type { RalphLogEntry } from "./types"

export const MAX_RALPH_LOG_ENTRIES = 500

export function appendRalphLogEntry(threadId: string, entry: RalphLogEntry): void {
  const logPath = getThreadRalphLogPath(threadId)
  try {
    appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf-8")
  } catch (error) {
    console.warn("[RalphLog] Failed to append entry:", error)
    return
  }

  try {
    const content = readFileSync(logPath, "utf-8")
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length <= MAX_RALPH_LOG_ENTRIES) {
      return
    }

    const trimmed = lines.slice(-MAX_RALPH_LOG_ENTRIES)
    writeFileSync(logPath, trimmed.join("\n") + "\n", "utf-8")
  } catch (error) {
    console.warn("[RalphLog] Failed to trim log:", error)
  }
}

export function readRalphLogTail(threadId: string, limit = 200): RalphLogEntry[] {
  const logPath = getThreadRalphLogPath(threadId)
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

    const entries: RalphLogEntry[] = []
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as RalphLogEntry)
      } catch {
        // Skip malformed lines
      }
    }
    return entries
  } catch (error) {
    console.warn("[RalphLog] Failed to read log:", error)
    return []
  }
}
