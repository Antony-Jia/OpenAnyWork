import { BrowserWindow } from "electron"
import type { TaskCompletionNotice } from "../types"

export function broadcastThreadsChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("threads:changed")
  }
}

export function broadcastThreadHistoryUpdated(threadId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("thread:history-updated", threadId)
  }
}

export function broadcastToast(
  type: "info" | "success" | "warning" | "error",
  message: string
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("app:toast", { type, message })
  }
}

export function broadcastTaskCard(card: TaskCompletionNotice): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("app:task-card", card)
  }
}

export function broadcastButlerState(state: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("butler:state-changed", state)
  }
}

export function broadcastButlerTasks(tasks: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("butler:tasks-changed", tasks)
  }
}
