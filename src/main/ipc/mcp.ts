import { IpcMain } from "electron"
import {
  createMcpServer,
  deleteMcpServer,
  listMcpServers,
  startMcpServer,
  stopMcpServer,
  updateMcpServer
} from "../mcp/service"
import type { McpServerCreateParams, McpServerUpdateParams } from "../types"

export function registerMcpHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("mcp:list", async () => {
    return listMcpServers()
  })

  ipcMain.handle("mcp:create", async (_event, payload: McpServerCreateParams) => {
    return createMcpServer(payload)
  })

  ipcMain.handle("mcp:update", async (_event, payload: McpServerUpdateParams) => {
    return updateMcpServer(payload)
  })

  ipcMain.handle("mcp:delete", async (_event, id: string) => {
    return deleteMcpServer(id)
  })

  ipcMain.handle("mcp:start", async (_event, id: string) => {
    return startMcpServer(id)
  })

  ipcMain.handle("mcp:stop", async (_event, id: string) => {
    return stopMcpServer(id)
  })
}
