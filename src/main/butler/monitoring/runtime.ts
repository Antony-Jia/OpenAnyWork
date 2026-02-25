import type { ButlerMonitorManager } from "./manager"

let activeButlerMonitorManager: ButlerMonitorManager | null = null

export function setActiveButlerMonitorManager(manager: ButlerMonitorManager | null): void {
  activeButlerMonitorManager = manager
}

export function getActiveButlerMonitorManager(): ButlerMonitorManager {
  if (!activeButlerMonitorManager) {
    throw new Error("Butler monitor manager is not initialized.")
  }
  return activeButlerMonitorManager
}

