import { IpcMain } from "electron"
import { getProxyConfig, setProxyConfig, applyProxyToFetch } from "../proxy-config"
import type { ProxyConfig } from "../types"

/**
 * Register IPC handlers for proxy configuration
 */
export function registerProxyHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("proxy:get", async (): Promise<ProxyConfig> => {
    return getProxyConfig()
  })

  ipcMain.handle("proxy:update", async (_event, config: ProxyConfig): Promise<ProxyConfig> => {
    setProxyConfig(config)
    
    // Reapply proxy to fetch with new configuration
    applyProxyToFetch()
    
    return getProxyConfig()
  })
}
