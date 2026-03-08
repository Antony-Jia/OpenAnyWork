import { IpcMain } from "electron"
import { getSettings, updateSettings } from "../settings"
import { updateEmailPollingInterval } from "../email/worker"
import type { AppSettings } from "../types"
import type { SettingsUpdateParams } from "../types"

interface SettingsHandlerOptions {
  onSettingsUpdated?: (next: AppSettings, previous: AppSettings) => void | Promise<void>
}

export function registerSettingsHandlers(
  ipcMain: IpcMain,
  options: SettingsHandlerOptions = {}
): void {
  ipcMain.handle("settings:get", async () => {
    return getSettings()
  })

  ipcMain.handle("settings:update", async (_event, payload: SettingsUpdateParams) => {
    const previous = getSettings()
    const next = updateSettings(payload.updates)
    updateEmailPollingInterval(next.email?.pollIntervalSec)
    await options.onSettingsUpdated?.(next, previous)
    return next
  })
}
