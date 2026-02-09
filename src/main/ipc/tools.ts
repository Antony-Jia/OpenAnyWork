import { IpcMain } from "electron"
import {
  listTools,
  updateToolEnabled,
  updateToolEnabledByScope,
  updateToolKey
} from "../tools/service"
import type {
  ToolEnableScopeUpdateParams,
  ToolEnableUpdateParams,
  ToolKeyUpdateParams
} from "../types"
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

  ipcMain.handle("tools:setEnabledScope", async (_event, payload: ToolEnableScopeUpdateParams) => {
    return withSpan(
      "IPC",
      "tools:setEnabledScope",
      { name: payload.name, enabled: payload.enabled, scope: payload.scope },
      async () => updateToolEnabledByScope(payload.name, payload.enabled, payload.scope)
    )
  })
}
