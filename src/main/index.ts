import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  nativeImage,
  Tray,
  Menu,
  globalShortcut,
  screen
} from "electron"
import { join } from "path"
import { registerAgentHandlers, getActiveRunCount } from "./ipc/agent"
import { broadcastTaskCard, broadcastThreadHistoryUpdated, broadcastToast } from "./ipc/events"

// Prevent Windows error dialog boxes for unhandled errors
process.on("uncaughtException", (error) => {
  console.error("[Main] Uncaught exception:", error)
  const message = error instanceof Error ? error.message : String(error)
  broadcastToast("error", `Uncaught error: ${message}`)
})

process.on("unhandledRejection", (reason) => {
  console.error("[Main] Unhandled rejection:", reason)
  const message = reason instanceof Error ? reason.message : String(reason)
  broadcastToast("error", `Unhandled error: ${message}`)
})
import { registerThreadHandlers } from "./ipc/threads"
import { registerModelHandlers } from "./ipc/models"
import { registerSubagentHandlers } from "./ipc/subagents"
import { registerSkillHandlers } from "./ipc/skills"
import { registerToolHandlers } from "./ipc/tools"
import { registerMiddlewareHandlers } from "./ipc/middleware"
import { registerDockerHandlers } from "./ipc/docker"
import { registerAttachmentHandlers } from "./ipc/attachments"
import { initializeDatabase } from "./db"
import { registerMcpHandlers } from "./ipc/mcp"
import { registerLoopHandlers } from "./ipc/loop"
import { registerButlerHandlers } from "./ipc/butler"
import { registerPromptHandlers } from "./ipc/prompts"
import { registerMemoryHandlers } from "./ipc/memory"
import { startAutoMcpServers } from "./mcp/service"
import { registerSettingsHandlers } from "./ipc/settings"
import { registerSpeechHandlers } from "./ipc/speech"
import { startEmailPolling, stopEmailPolling } from "./email/worker"
import { loopManager } from "./loop/manager"
import {
  generateDailyProfileOnStartup,
  initializeMemoryService,
  stopMemoryService,
  flushMemoryDatabase
} from "./memory"
import { butlerManager } from "./butler/manager"
import { TaskPopupController } from "./notifications/popup-controller"
import { TaskCompletionBus } from "./notifications/task-completion-bus"

let mainWindow: BrowserWindow | null = null
let quickInputWindow: BrowserWindow | null = null
let tray: Tray | null = null
let taskPopupController: TaskPopupController | null = null
let taskCompletionBus: TaskCompletionBus | null = null
let isQuitting = false

// Simple dev check - replaces @electron-toolkit/utils is.dev
const isDev = !app.isPackaged

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    frame: false, // Frameless mode
    backgroundColor: "#0D0D0F",
    // titleBarStyle: "hiddenInset", // Removed for custom controls
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show()
    // Auto-open devtools to debug issues
    // if (mainWindow) {
    //   mainWindow.webContents.openDevTools()
    // }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  // IPC Handlers for Window Controls
  ipcMain.on("window-minimize", () => {
    mainWindow?.minimize()
  })

  ipcMain.on("window-maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on("window-close", () => {
    mainWindow?.close()
  })

  mainWindow.on("close", (event) => {
    if (isQuitting) return
    event.preventDefault()
    hideMainWindowToTray()
  })

  mainWindow.on("show", () => {
    if (mainWindow?.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow?.setSkipTaskbar(false)
    taskPopupController?.clear()
    updateTrayMenu()
  })

  mainWindow.on("hide", () => {
    updateTrayMenu()
  })

  // HMR for renderer based on electron-vite cli
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

function hideMainWindowToTray(): void {
  if (!mainWindow) return
  mainWindow.setSkipTaskbar(true)
  mainWindow.hide()
  updateTrayMenu()
}

function showMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
  mainWindow.setSkipTaskbar(false)
  updateTrayMenu()
}

function activateThread(threadId: string): void {
  if (!threadId || !mainWindow) return
  mainWindow.webContents.send("threads:activate", threadId)
}

function createQuickInputWindow(): void {
  if (quickInputWindow) return
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const defaultQuickInputWidth = 860
  const windowWidth = Math.min(Math.round(defaultQuickInputWidth * 1.5), Math.max(640, width - 80))
  const windowHeight = 156
  const x = Math.round((width - windowWidth) / 2)
  const y = Math.round((height - windowHeight) / 4)

  quickInputWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  })

  quickInputWindow.on("closed", () => {
    quickInputWindow = null
  })

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    const url = new URL(process.env["ELECTRON_RENDERER_URL"])
    url.searchParams.set("quickInput", "1")
    quickInputWindow.loadURL(url.toString())
  } else {
    quickInputWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      query: { quickInput: "1" }
    })
  }
}

function toggleQuickInput(): void {
  if (!quickInputWindow) {
    createQuickInputWindow()
  }
  if (!quickInputWindow) return

  if (quickInputWindow.isVisible()) {
    quickInputWindow.hide()
    return
  }

  quickInputWindow.show()
  quickInputWindow.focus()
}

function updateTrayMenu(): void {
  if (!tray) return
  const isVisible = !!mainWindow && mainWindow.isVisible()
  const activeRuns = getActiveRunCount()
  const menu = Menu.buildFromTemplate([
    {
      label: `Active conversations: ${activeRuns}`,
      enabled: false
    },
    {
      label: isVisible ? "Hide Window" : "Show Window",
      click: () => {
        if (isVisible) {
          hideMainWindowToTray()
        } else {
          showMainWindow()
        }
      }
    },
    { type: "separator" },
    {
      label: "Exit",
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
}

function createTray(): void {
  const iconPath = join(__dirname, "../../resources/icon.png")
  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip("Openwork")
  tray.on("click", () => {
    if (!mainWindow) return
    if (mainWindow.isVisible()) {
      hideMainWindowToTray()
    } else {
      showMainWindow()
    }
  })

  updateTrayMenu()
}

app.whenReady().then(async () => {
  // Set app user model id for windows
  if (process.platform === "win32") {
    app.setAppUserModelId(isDev ? process.execPath : "com.langchain.openwork")
  }

  // Set dock icon on macOS
  if (process.platform === "darwin" && app.dock) {
    const iconPath = join(__dirname, "../../resources/icon.png")
    try {
      const icon = nativeImage.createFromPath(iconPath)
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon)
      }
    } catch {
      // Icon not found, use default
    }
  }

  // Default open or close DevTools by F12 in development
  if (isDev) {
    app.on("browser-window-created", (_, window) => {
      window.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
          window.webContents.toggleDevTools()
          event.preventDefault()
        }
      })
    })
  }

  // Initialize database
  await initializeDatabase()
  await initializeMemoryService()
  await generateDailyProfileOnStartup()
  await butlerManager.initialize()
  loopManager.resetAllOnStartup()

  // Register IPC handlers
  registerAgentHandlers(ipcMain)
  registerThreadHandlers(ipcMain)
  registerModelHandlers(ipcMain)
  registerSubagentHandlers(ipcMain)
  registerSkillHandlers(ipcMain)
  registerToolHandlers(ipcMain)
  registerMiddlewareHandlers(ipcMain)
  registerDockerHandlers(ipcMain)
  registerAttachmentHandlers(ipcMain)
  registerMcpHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerSpeechHandlers(ipcMain)
  registerLoopHandlers(ipcMain)
  registerButlerHandlers(ipcMain)
  registerPromptHandlers(ipcMain)
  registerMemoryHandlers(ipcMain)

  await startAutoMcpServers()

  createWindow()
  createTray()

  const rendererHtmlPath = join(__dirname, "../renderer/index.html")
  const preloadPath = join(__dirname, "../preload/index.js")
  const rendererUrl = isDev ? process.env["ELECTRON_RENDERER_URL"] : undefined

  taskPopupController = new TaskPopupController({
    rendererUrl,
    rendererHtmlPath,
    preloadPath,
    showMainWindow,
    activateThread
  })

  taskCompletionBus = new TaskCompletionBus({
    notifyButler: (notice) => {
      butlerManager.notifyCompletionNotice(notice)
    },
    notifyInAppCard: (notice) => {
      broadcastTaskCard(notice)
    },
    notifyThreadHistoryUpdated: (threadId) => {
      broadcastThreadHistoryUpdated(threadId)
    },
    shouldShowDesktopPopup: () => {
      if (!mainWindow) return false
      return !mainWindow.isVisible() || mainWindow.isMinimized()
    },
    enqueueDesktopPopup: (notice) => {
      taskPopupController?.enqueue(notice)
    }
  })
  taskCompletionBus.start()

  ipcMain.on("app:show-main", () => {
    showMainWindow()
  })

  ipcMain.on("app:activate-thread", (_event, threadId: string) => {
    showMainWindow()
    activateThread(threadId)
  })

  ipcMain.on("app:open-settings", () => {
    showMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send("app:open-settings")
    }
  })

  ipcMain.on("app:open-butler", () => {
    showMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send("app:open-butler")
    }
  })

  ipcMain.on("quick-input:hide", () => {
    quickInputWindow?.hide()
  })

  ipcMain.on("task-popup:hover", (_event, payload: unknown) => {
    const hovered =
      typeof payload === "boolean"
        ? payload
        : !!(payload && typeof payload === "object" && (payload as { hovered?: unknown }).hovered)
    taskPopupController?.setHover(hovered)
  })

  ipcMain.on("task-popup:open-thread", (_event, payload: unknown) => {
    let threadId = ""
    let noticeId: string | undefined

    if (typeof payload === "string") {
      threadId = payload
    } else if (payload && typeof payload === "object") {
      const parsed = payload as { threadId?: unknown; noticeId?: unknown }
      if (typeof parsed.threadId === "string") {
        threadId = parsed.threadId
      }
      if (typeof parsed.noticeId === "string") {
        noticeId = parsed.noticeId
      }
    }

    if (!threadId) return
    taskPopupController?.openThread(threadId, noticeId)
  })

  ipcMain.on("task-popup:dismiss", (_event, payload: unknown) => {
    let noticeId: string | undefined

    if (typeof payload === "string") {
      noticeId = payload
    } else if (payload && typeof payload === "object") {
      const parsed = payload as { noticeId?: unknown }
      if (typeof parsed.noticeId === "string") {
        noticeId = parsed.noticeId
      }
    }

    taskPopupController?.dismiss(noticeId)
  })

  startEmailPolling()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  const shortcutRegistered = globalShortcut.register("Control+Alt+Space", () => {
    toggleQuickInput()
  })
  if (!shortcutRegistered) {
    console.warn("[Main] Failed to register global shortcut Control+Alt+Space")
  }
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  isQuitting = true
  globalShortcut.unregisterAll()
  taskCompletionBus?.stop()
  taskCompletionBus = null
  taskPopupController?.dispose()
  taskPopupController = null
  stopEmailPolling()
  loopManager.stopAll()
  butlerManager.shutdown()
  void stopMemoryService()
  void flushMemoryDatabase()
})
