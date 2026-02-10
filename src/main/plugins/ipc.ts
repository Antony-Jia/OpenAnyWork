import { BrowserWindow, type IpcMain } from "electron"
import type { PluginEnableUpdateParams } from "./core/contracts"
import { pluginHost } from "./core/host"
import { withSpan } from "../logging"

const ACTIONBOOK_EVENT_CHANNEL = "plugins:actionbook:event"

export function registerPluginsIpc(ipcMain: IpcMain): () => void {
  void pluginHost.hydrateFromSettings()

  ipcMain.handle("plugins:list", async () => {
    return withSpan("IPC", "plugins:list", undefined, async () => pluginHost.listPlugins())
  })

  ipcMain.handle("plugins:setEnabled", async (_event, input: PluginEnableUpdateParams) => {
    return withSpan(
      "IPC",
      "plugins:setEnabled",
      { id: input.id, enabled: input.enabled },
      async () => pluginHost.setEnabled(input)
    )
  })

  ipcMain.handle("plugins:actionbook:getState", async () => {
    return withSpan("IPC", "plugins:actionbook:getState", undefined, async () =>
      pluginHost.getActionbookState()
    )
  })

  ipcMain.handle("plugins:actionbook:refreshChecks", async () => {
    return withSpan("IPC", "plugins:actionbook:refreshChecks", undefined, async () =>
      pluginHost.refreshActionbookChecks()
    )
  })

  ipcMain.handle("plugins:actionbook:start", async () => {
    return withSpan("IPC", "plugins:actionbook:start", undefined, async () =>
      pluginHost.startActionbookBridge()
    )
  })

  ipcMain.handle("plugins:actionbook:stop", async () => {
    return withSpan("IPC", "plugins:actionbook:stop", undefined, async () =>
      pluginHost.stopActionbookBridge()
    )
  })

  ipcMain.handle("plugins:actionbook:status", async () => {
    return withSpan("IPC", "plugins:actionbook:status", undefined, async () =>
      pluginHost.runActionbookStatus()
    )
  })

  ipcMain.handle("plugins:actionbook:ping", async () => {
    return withSpan("IPC", "plugins:actionbook:ping", undefined, async () =>
      pluginHost.runActionbookPing()
    )
  })

  const unsubscribe = pluginHost.onActionbookEvent((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(ACTIONBOOK_EVENT_CHANNEL, event)
    }
  })

  return () => {
    unsubscribe()
  }
}
