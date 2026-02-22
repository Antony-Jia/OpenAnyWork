import { IpcMain } from "electron"
import { notificationMuteRegistry } from "../notifications/mute-registry"

interface NotificationHandlerOptions {
  onMutedTaskIdentity?: (taskIdentity: string) => void
}

function normalizeTaskIdentity(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function registerNotificationHandlers(
  ipcMain: IpcMain,
  options: NotificationHandlerOptions = {}
): void {
  ipcMain.handle("notifications:muteTask", async (_event, taskIdentity: string) => {
    const normalized = normalizeTaskIdentity(taskIdentity)
    if (!normalized) return
    notificationMuteRegistry.mute(normalized)
    options.onMutedTaskIdentity?.(normalized)
  })

  ipcMain.handle("notifications:unmuteTask", async (_event, taskIdentity: string) => {
    const normalized = normalizeTaskIdentity(taskIdentity)
    if (!normalized) return
    notificationMuteRegistry.unmute(normalized)
  })

  ipcMain.handle("notifications:listMutedTasks", async () => {
    return notificationMuteRegistry.list()
  })
}
