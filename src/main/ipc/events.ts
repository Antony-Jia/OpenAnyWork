import { BrowserWindow } from "electron"

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
