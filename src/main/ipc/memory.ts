import { IpcMain } from "electron"
import { clearAllMemory, listConversationSummaries, listDailyProfiles } from "../memory"

export function registerMemoryHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("memory:listConversationSummaries", async (_event, limit?: number) => {
    const normalizedLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.max(1, Math.min(2000, Math.round(limit)))
        : 400
    return listConversationSummaries(normalizedLimit)
  })

  ipcMain.handle("memory:listDailyProfiles", async (_event, limit?: number) => {
    const normalizedLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.max(1, Math.min(1000, Math.round(limit)))
        : 180
    return listDailyProfiles(normalizedLimit)
  })

  ipcMain.handle("memory:clearAll", async () => {
    clearAllMemory()
  })
}
