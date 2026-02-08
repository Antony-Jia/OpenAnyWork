import { IpcMain } from "electron"
import { butlerManager } from "../butler/manager"

export function registerButlerHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("butler:getState", async () => {
    await butlerManager.initialize()
    return butlerManager.getState()
  })

  ipcMain.handle("butler:send", async (_event, message: string) => {
    return butlerManager.send(message)
  })

  ipcMain.handle("butler:listTasks", async () => {
    await butlerManager.initialize()
    return butlerManager.listTasks()
  })
}
