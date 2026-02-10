import { IpcMain } from "electron"
import type {
  CalendarWatchEventCreateInput,
  CalendarWatchEventUpdateInput,
  CountdownWatchItemCreateInput,
  CountdownWatchItemUpdateInput,
  MailWatchRuleCreateInput,
  MailWatchRuleUpdateInput
} from "../types"
import { ButlerMonitorManager } from "../butler/monitoring/manager"

export function registerButlerMonitorHandlers(
  ipcMain: IpcMain,
  butlerMonitorManager: ButlerMonitorManager
): void {
  ipcMain.handle("butler-monitor:getSnapshot", async () => {
    return butlerMonitorManager.getSnapshot()
  })

  ipcMain.handle("butler-monitor:calendar:list", async () => {
    return butlerMonitorManager.listCalendarEvents()
  })

  ipcMain.handle(
    "butler-monitor:calendar:create",
    async (_event, input: CalendarWatchEventCreateInput) => {
      return butlerMonitorManager.createCalendarEvent(input)
    }
  )

  ipcMain.handle(
    "butler-monitor:calendar:update",
    async (_event, payload: { id: string; updates: CalendarWatchEventUpdateInput }) => {
      return butlerMonitorManager.updateCalendarEvent(payload.id, payload.updates)
    }
  )

  ipcMain.handle("butler-monitor:calendar:delete", async (_event, id: string) => {
    butlerMonitorManager.deleteCalendarEvent(id)
  })

  ipcMain.handle("butler-monitor:countdown:list", async () => {
    return butlerMonitorManager.listCountdownTimers()
  })

  ipcMain.handle(
    "butler-monitor:countdown:create",
    async (_event, input: CountdownWatchItemCreateInput) => {
      return butlerMonitorManager.createCountdownTimer(input)
    }
  )

  ipcMain.handle(
    "butler-monitor:countdown:update",
    async (_event, payload: { id: string; updates: CountdownWatchItemUpdateInput }) => {
      return butlerMonitorManager.updateCountdownTimer(payload.id, payload.updates)
    }
  )

  ipcMain.handle("butler-monitor:countdown:delete", async (_event, id: string) => {
    butlerMonitorManager.deleteCountdownTimer(id)
  })

  ipcMain.handle("butler-monitor:mail:listRules", async () => {
    return butlerMonitorManager.listMailRules()
  })

  ipcMain.handle(
    "butler-monitor:mail:createRule",
    async (_event, input: MailWatchRuleCreateInput) => {
      return butlerMonitorManager.createMailRule(input)
    }
  )

  ipcMain.handle(
    "butler-monitor:mail:updateRule",
    async (_event, payload: { id: string; updates: MailWatchRuleUpdateInput }) => {
      return butlerMonitorManager.updateMailRule(payload.id, payload.updates)
    }
  )

  ipcMain.handle("butler-monitor:mail:deleteRule", async (_event, id: string) => {
    butlerMonitorManager.deleteMailRule(id)
  })

  ipcMain.handle("butler-monitor:mail:listMessages", async (_event, limit?: number) => {
    return butlerMonitorManager.listRecentMails(limit)
  })

  ipcMain.handle("butler-monitor:mail:pullNow", async () => {
    return butlerMonitorManager.pullMailNow()
  })
}
