import { IpcMain } from "electron"
import { createSubagent, deleteSubagent, listSubagents, updateSubagent } from "../subagents"
import type { SubagentConfig } from "../types"
import { logEntry, logExit, withSpan } from "../logging"

export function registerSubagentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("subagents:list", async () => {
    return withSpan("IPC", "subagents:list", undefined, async () => listSubagents())
  })

  ipcMain.handle("subagents:create", async (_event, input: Omit<SubagentConfig, "id">) => {
    return withSpan("IPC", "subagents:create", { name: input.name }, async () =>
      createSubagent(input)
    )
  })

  ipcMain.handle(
    "subagents:update",
    async (_event, payload: { id: string; updates: Partial<Omit<SubagentConfig, "id">> }) => {
      return withSpan(
        "IPC",
        "subagents:update",
        { id: payload.id, updates: Object.keys(payload.updates || {}) },
        async () => updateSubagent(payload.id, payload.updates)
      )
    }
  )

  ipcMain.handle("subagents:delete", async (_event, id: string) => {
    logEntry("IPC", "subagents:delete", { id })
    deleteSubagent(id)
    logExit("IPC", "subagents:delete", { id })
  })
}
