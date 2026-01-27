import { IpcMain } from "electron"
import { listTools, updateToolEnabled, updateToolKey } from "../tools/service"
import type { ToolEnableUpdateParams, ToolKeyUpdateParams } from "../types"
import { withSpan } from "../logging"

export function registerToolHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("tools:list", async () => {
    return withSpan("IPC", "tools:list", undefined, async () => listTools())
  })

  ipcMain.handle("tools:setKey", async (_event, payload: ToolKeyUpdateParams) => {
    return withSpan(
      "IPC",
      "tools:setKey",
      { name: payload.name, hasKey: !!payload.key },
      async () => updateToolKey(payload.name, payload.key)
    )
  })

  ipcMain.handle("tools:setEnabled", async (_event, payload: ToolEnableUpdateParams) => {
    return withSpan(
      "IPC",
      "tools:setEnabled",
      { name: payload.name, enabled: payload.enabled },
      async () => updateToolEnabled(payload.name, payload.enabled)
    )
  })
}
