import { BrowserWindow, screen } from "electron"
import type { TaskCompletionNotice } from "../types"

interface TaskPopupControllerOptions {
  rendererUrl?: string
  rendererHtmlPath: string
  preloadPath: string
  showMainWindow: () => void
  activateThread: (threadId: string) => void
  autoCloseMs?: number
}

const DEFAULT_POPUP_WIDTH = 420
const DEFAULT_POPUP_HEIGHT = 188
const DEFAULT_MARGIN = 16
const DEFAULT_AUTO_CLOSE_MS = 8_000

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export class TaskPopupController {
  private readonly pendingQueue: TaskCompletionNotice[] = []
  private readonly autoCloseMs: number
  private popupWindow: BrowserWindow | null = null
  private popupReady: Promise<void> | null = null
  private activeNotice: TaskCompletionNotice | null = null
  private autoCloseTimer: NodeJS.Timeout | null = null
  private timerStartedAt = 0
  private timerRemainingMs: number
  private hovered = false

  constructor(private readonly options: TaskPopupControllerOptions) {
    this.autoCloseMs = options.autoCloseMs ?? DEFAULT_AUTO_CLOSE_MS
    this.timerRemainingMs = this.autoCloseMs
  }

  enqueue(notice: TaskCompletionNotice): void {
    this.pendingQueue.push(notice)
    void this.showNextIfIdle()
  }

  setHover(hovered: boolean): void {
    this.hovered = hovered
    if (!this.activeNotice) return

    if (hovered) {
      this.pauseTimer()
    } else {
      this.resumeTimer()
    }
  }

  openThread(threadId: string, noticeId?: string): void {
    if (!threadId) return
    if (noticeId && this.activeNotice && this.activeNotice.id !== noticeId) return
    this.options.showMainWindow()
    this.options.activateThread(threadId)
    this.dismiss(noticeId)
  }

  dismiss(noticeId?: string): void {
    if (noticeId) {
      const queuedIndex = this.pendingQueue.findIndex((item) => item.id === noticeId)
      if (queuedIndex >= 0) {
        this.pendingQueue.splice(queuedIndex, 1)
      }
    }

    if (!this.activeNotice) return
    if (noticeId && this.activeNotice.id !== noticeId) return
    this.finishActiveAndContinue()
  }

  clear(): void {
    this.pendingQueue.length = 0
    this.finishActiveOnly()
  }

  dispose(): void {
    this.clear()
    if (this.popupWindow && !this.popupWindow.isDestroyed()) {
      this.popupWindow.destroy()
    }
    this.popupWindow = null
    this.popupReady = null
  }

  private async showNextIfIdle(): Promise<void> {
    if (this.activeNotice || this.pendingQueue.length === 0) {
      return
    }

    const next = this.pendingQueue.shift()
    if (!next) return
    this.activeNotice = next
    this.hovered = false
    this.timerRemainingMs = this.autoCloseMs

    const popup = await this.ensurePopupWindow()
    if (!this.activeNotice || popup.isDestroyed()) return

    this.positionPopupWindow(popup)
    popup.webContents.send("task-popup:show", this.activeNotice)
    if (!popup.isVisible()) {
      popup.showInactive()
    } else {
      popup.moveTop()
    }
    this.resumeTimer()
  }

  private finishActiveAndContinue(): void {
    this.finishActiveOnly()
    void this.showNextIfIdle()
  }

  private finishActiveOnly(): void {
    if (!this.activeNotice) return
    const closedId = this.activeNotice.id
    this.activeNotice = null
    this.hovered = false
    this.timerRemainingMs = this.autoCloseMs
    this.clearTimer()
    const popup = this.popupWindow
    if (popup && !popup.isDestroyed()) {
      popup.webContents.send("task-popup:close", { id: closedId })
      popup.hide()
    }
  }

  private resumeTimer(): void {
    if (!this.activeNotice || this.hovered) return
    this.clearTimer()
    this.timerStartedAt = Date.now()
    this.autoCloseTimer = setTimeout(() => {
      this.finishActiveAndContinue()
    }, this.timerRemainingMs)
  }

  private pauseTimer(): void {
    if (!this.autoCloseTimer) return
    const elapsed = Date.now() - this.timerStartedAt
    this.timerRemainingMs = clamp(this.timerRemainingMs - elapsed, 50, this.autoCloseMs)
    this.clearTimer()
  }

  private clearTimer(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer)
      this.autoCloseTimer = null
    }
  }

  private async ensurePopupWindow(): Promise<BrowserWindow> {
    if (this.popupWindow && !this.popupWindow.isDestroyed()) {
      if (this.popupReady) {
        await this.popupReady
      }
      return this.popupWindow
    }

    this.popupWindow = new BrowserWindow({
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      frame: false,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: true,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: this.options.preloadPath,
        sandbox: false
      }
    })

    this.popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.popupWindow.setAlwaysOnTop(true, "screen-saver")
    this.popupWindow.on("closed", () => {
      this.popupWindow = null
      this.popupReady = null
    })

    this.popupReady = this.loadPopupWindow(this.popupWindow)
    await this.popupReady
    return this.popupWindow
  }

  private async loadPopupWindow(window: BrowserWindow): Promise<void> {
    if (this.options.rendererUrl) {
      const url = new URL(this.options.rendererUrl)
      url.searchParams.set("taskPopup", "1")
      await window.loadURL(url.toString())
      return
    }

    await window.loadFile(this.options.rendererHtmlPath, {
      query: { taskPopup: "1" }
    })
  }

  private positionPopupWindow(window: BrowserWindow): void {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const workArea = display.workArea
    const x = Math.round(workArea.x + workArea.width - DEFAULT_POPUP_WIDTH - DEFAULT_MARGIN)
    const y = Math.round(workArea.y + workArea.height - DEFAULT_POPUP_HEIGHT - DEFAULT_MARGIN)
    window.setBounds({
      x,
      y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT
    })
  }
}

