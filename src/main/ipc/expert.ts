import type { IpcMain } from "electron"
import { getThread, updateThread as dbUpdateThread } from "../db"
import { broadcastThreadsChanged } from "./events"
import {
  cleanupExpertAgentContexts,
  mergeExpertConfig,
  normalizeStoredExpertConfig
} from "../expert/config"
import type { ExpertConfig, ExpertConfigInput } from "../types"

function parseMetadata(threadId: string): Record<string, unknown> {
  const row = getThread(threadId)
  return row?.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {}
}

export function registerExpertHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    "expert:getConfig",
    async (_event, threadId: string): Promise<ExpertConfig | null> => {
      const metadata = parseMetadata(threadId)
      return normalizeStoredExpertConfig(metadata.expert)
    }
  )

  ipcMain.handle(
    "expert:updateConfig",
    async (
      _event,
      { threadId, config }: { threadId: string; config: ExpertConfigInput | ExpertConfig }
    ): Promise<ExpertConfig> => {
      const row = getThread(threadId)
      if (!row) {
        throw new Error("Thread not found")
      }

      const metadata = parseMetadata(threadId)
      const existing = normalizeStoredExpertConfig(metadata.expert)
      const merged = mergeExpertConfig({ existing, nextInput: config })

      metadata.mode = "expert"
      metadata.expert = merged.config
      dbUpdateThread(threadId, { metadata: JSON.stringify(metadata) })

      await cleanupExpertAgentContexts([
        ...merged.resetAgentThreadIds,
        ...merged.removedAgentThreadIds
      ])

      broadcastThreadsChanged()
      return merged.config
    }
  )
}
