import { IpcMain } from "electron"
import {
  createPromptTemplate,
  deletePromptTemplate,
  getPromptTemplate,
  listPromptTemplates,
  updatePromptTemplate
} from "../prompts"
import type { PromptCreateInput, PromptUpdateInput } from "../types"

export function registerPromptHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("prompts:list", async (_event, query?: string) => {
    return listPromptTemplates(query)
  })

  ipcMain.handle("prompts:get", async (_event, id: string) => {
    return getPromptTemplate(id)
  })

  ipcMain.handle("prompts:create", async (_event, input: PromptCreateInput) => {
    return createPromptTemplate(input)
  })

  ipcMain.handle(
    "prompts:update",
    async (_event, payload: { id: string; updates: PromptUpdateInput }) => {
      return updatePromptTemplate(payload.id, payload.updates)
    }
  )

  ipcMain.handle("prompts:delete", async (_event, id: string) => {
    deletePromptTemplate(id)
  })
}
