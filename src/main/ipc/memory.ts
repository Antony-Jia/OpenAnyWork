import { IpcMain } from "electron"
import {
  clearWorkingSnapshot,
  clearAllMemory,
  getMemoryEntities,
  getRangeSummary,
  getWorkingMemorySnapshot,
  listConversationSummaries,
  listDailyProfiles,
  rebuildMemoryFromLegacyData,
  searchMemory
} from "../memory"
import type { MemoryEntityType, MemoryRangeSummaryQuery, MemorySearchQuery } from "../types"

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

  ipcMain.handle("memory:getWorkingSnapshot", async () => {
    return getWorkingMemorySnapshot()
  })

  ipcMain.handle("memory:clearWorkingSnapshot", async () => {
    return clearWorkingSnapshot()
  })

  ipcMain.handle("memory:search", async (_event, query?: string | MemorySearchQuery) => {
    return searchMemory(query ?? "")
  })

  ipcMain.handle(
    "memory:listEntities",
    async (_event, type?: MemoryEntityType, filters?: { text?: string; limit?: number }) => {
      return getMemoryEntities(type, filters)
    }
  )

  ipcMain.handle("memory:getRangeSummary", async (_event, query?: MemoryRangeSummaryQuery) => {
    return getRangeSummary(query ?? { preset: "today" })
  })

  ipcMain.handle("memory:rebuild", async () => {
    await rebuildMemoryFromLegacyData()
    return {
      workingSnapshot: getWorkingMemorySnapshot(),
      search: searchMemory("")
    }
  })
}
