import { IpcMain } from "electron"
import { createSubagent, deleteSubagent, listSubagents, updateSubagent } from "../subagents"
import type { SubagentConfig } from "../types"

export function registerSubagentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("subagents:list", async () => {
    return listSubagents()
  })

  ipcMain.handle("subagents:create", async (_event, input: Omit<SubagentConfig, "id">) => {
    return createSubagent(input)
  })

  ipcMain.handle(
    "subagents:update",
    async (_event, payload: { id: string; updates: Partial<Omit<SubagentConfig, "id">> }) => {
      return updateSubagent(payload.id, payload.updates)
    }
  )

  ipcMain.handle("subagents:delete", async (_event, id: string) => {
    deleteSubagent(id)
  })
}
