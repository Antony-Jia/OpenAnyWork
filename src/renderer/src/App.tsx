import { useEffect, useState, useCallback, useRef, useLayoutEffect, useMemo } from "react"
import { ThreadSidebar } from "@/components/sidebar/ThreadSidebar"
import { TabbedPanel, TabBar } from "@/components/tabs"
import { RightPanel } from "@/components/panels/RightPanel"
import { ResizeHandle } from "@/components/ui/resizable"
import { ToastContainer, ToastMessage } from "@/components/ui/toast"
import { TaskNoticeContainer, type TaskNoticeCard } from "@/components/ui/task-notice"
import { useAppStore } from "@/lib/store"
import { ThreadProvider } from "@/lib/thread-context"
import { TitleBar } from "@/components/titlebar/TitleBar"
import { QuickInput } from "@/components/quick-input/QuickInput"
import { ButlerWorkspace } from "@/components/butler/ButlerWorkspace"
import { DesktopTaskPopup } from "@/components/notifications/DesktopTaskPopup"

// Badge customization - unused in new titlebar but kept if logic needs reference
const BADGE_MIN_SCREEN_WIDTH = 270
const LEFT_MAX = 350
const LEFT_DEFAULT = 240
const RIGHT_MIN = 250
const RIGHT_MAX = 450
const RIGHT_DEFAULT = 320

function MainApp(): React.JSX.Element {
  const { currentThreadId, loadThreads, createThread, appMode, setAppMode } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [taskCards, setTaskCards] = useState<TaskNoticeCard[]>([])

  const addToast = useCallback((type: ToastMessage["type"], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const removeTaskCard = useCallback((id: string) => {
    setTaskCards((prev) => prev.filter((card) => card.id !== id))
  }, [])

  const openTaskCardThread = useCallback(
    async (threadId: string) => {
      setAppMode("classic")
      await useAppStore.getState().selectThread(threadId)
      setTaskCards((prev) => prev.filter((card) => card.threadId !== threadId))
    },
    [setAppMode]
  )

  // Track drag start widths
  const dragStartWidths = useRef<{ left: number; right: number } | null>(null)

  // Track zoom level changes and update CSS custom properties for safe areas
  useLayoutEffect(() => {
    const updateZoom = (): void => {
      // Detect zoom by comparing outer/inner window dimensions
      const detectedZoom = Math.round((window.outerWidth / window.innerWidth) * 100) / 100
      if (detectedZoom > 0.5 && detectedZoom < 3) {
        setZoomLevel(detectedZoom)

        // Titlebar is 36px CSS (9*4), which becomes 36*zoom screen pixels
        // We set logic here if we need zoom-aware padding.
        // For standard Windows titlebar, this is less critical than macOS traffic lights,
        // but we keep the listener for robustness.
        const TRAFFIC_LIGHT_BOTTOM_SCREEN = 40
        const TITLEBAR_HEIGHT_CSS = 36
        const titlebarScreenHeight = TITLEBAR_HEIGHT_CSS * detectedZoom
        const extraPaddingScreen = Math.max(0, TRAFFIC_LIGHT_BOTTOM_SCREEN - titlebarScreenHeight)
        const extraPaddingCss = Math.round(extraPaddingScreen / detectedZoom)

        document.documentElement.style.setProperty("--sidebar-safe-padding", `${extraPaddingCss}px`)
      }
    }

    updateZoom()
    window.addEventListener("resize", updateZoom)
    return () => window.removeEventListener("resize", updateZoom)
  }, [])

  // Calculate zoom-compensated minimum width
  const leftMinWidth = Math.ceil(BADGE_MIN_SCREEN_WIDTH / zoomLevel)

  // Enforce minimum width when zoom changes
  useEffect(() => {
    if (leftWidth < leftMinWidth) {
      setLeftWidth(leftMinWidth)
    }
  }, [leftMinWidth, leftWidth])

  const handleLeftResize = useCallback(
    (totalDelta: number) => {
      if (!dragStartWidths.current) {
        dragStartWidths.current = { left: leftWidth, right: rightWidth }
      }
      const newWidth = dragStartWidths.current.left + totalDelta
      setLeftWidth(Math.min(LEFT_MAX, Math.max(leftMinWidth, newWidth)))
    },
    [leftWidth, rightWidth, leftMinWidth]
  )

  const handleRightResize = useCallback(
    (totalDelta: number) => {
      if (!dragStartWidths.current) {
        dragStartWidths.current = { left: leftWidth, right: rightWidth }
      }
      const newWidth = dragStartWidths.current.right - totalDelta
      setRightWidth(Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, newWidth)))
    },
    [leftWidth, rightWidth]
  )

  // Reset drag start on mouse up
  useEffect(() => {
    const handleMouseUp = (): void => {
      dragStartWidths.current = null
    }
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [])

  useEffect(() => {
    async function init(): Promise<void> {
      try {
        await loadThreads()
        // Create a default thread if none exist
        const threads = useAppStore.getState().threads
        const nonButlerThreads = threads.filter((thread) => thread.metadata?.butlerMain !== true)
        if (nonButlerThreads.length === 0) {
          await createThread()
        }
      } catch (error) {
        console.error("Failed to initialize:", error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [loadThreads, createThread])

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on("threads:changed", () => {
      loadThreads()
    })
    return () => {
      if (typeof cleanup === "function") cleanup()
    }
  }, [loadThreads])

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on("threads:activate", (...args: unknown[]) => {
      const threadId = args[0]
      if (typeof threadId === "string") {
        useAppStore.getState().selectThread(threadId)
      }
    })
    return () => {
      if (typeof cleanup === "function") cleanup()
    }
  }, [])

  // Listen for toast messages from main process
  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on("app:toast", (...args: unknown[]) => {
      const data = args[0] as { type: ToastMessage["type"]; message: string }
      if (data && data.type && data.message) {
        addToast(data.type, data.message)
      }
    })
    return () => {
      if (typeof cleanup === "function") cleanup()
    }
  }, [addToast])

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on("app:task-card", (...args: unknown[]) => {
      const card = args[0] as TaskNoticeCard
      if (!card?.id || !card.threadId) return
      setTaskCards((prev) => {
        const next = prev.filter((item) => item.id !== card.id)
        return [card, ...next]
      })
    })
    return () => {
      if (typeof cleanup === "function") cleanup()
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Initializing...</div>
      </div>
    )
  }

  return (
    <ThreadProvider>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <TaskNoticeContainer
        cards={taskCards}
        onClose={removeTaskCard}
        onOpenThread={(threadId) => void openTaskCardThread(threadId)}
      />
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        {/* Global Window Title Bar */}
        <TitleBar threadId={currentThreadId} />

        {appMode === "butler" ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ButlerWorkspace />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left + Center Layout */}
            <div className="flex flex-1 min-w-0 min-h-0">
              {/* Sidebar (Thread List) */}
              <div
                style={{ width: leftWidth }}
                className="shrink-0 flex flex-col border-r border-border bg-sidebar/50"
              >
                <ThreadSidebar />
              </div>

              <ResizeHandle onDrag={handleLeftResize} />

              {/* Center Panel (Chat) */}
              <main className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden bg-background/50 relative">
                {/* Center Header with Tabs */}
                {currentThreadId && (
                  <div className="h-9 border-b border-border flex items-center px-1 shrink-0 bg-background/50 backdrop-blur-sm">
                    <TabBar className="h-full border-b-0 w-full" />
                  </div>
                )}

                <div className="flex-1 flex flex-col min-h-0">
                  {currentThreadId ? (
                    <TabbedPanel threadId={currentThreadId} showTabBar={false} />
                  ) : (
                    <div className="flex flex-1 items-center justify-center text-muted-foreground h-full text-sm">
                      Select or create a thread to begin
                    </div>
                  )}
                </div>
              </main>
            </div>

            <ResizeHandle onDrag={handleRightResize} />

            {/* Right Panel */}
            <div
              style={{ width: rightWidth }}
              className="shrink-0 border-l border-border bg-sidebar"
            >
              <RightPanel />
            </div>
          </div>
        )}
      </div>
    </ThreadProvider>
  )
}

function QuickInputApp(): React.JSX.Element {
  useEffect(() => {
    document.documentElement.classList.add("quick-input-mode")
    document.body.classList.add("quick-input-mode")
    return () => {
      document.documentElement.classList.remove("quick-input-mode")
      document.body.classList.remove("quick-input-mode")
    }
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent text-foreground flex items-center justify-center">
      <QuickInput />
    </div>
  )
}

function TaskPopupApp(): React.JSX.Element {
  useEffect(() => {
    document.documentElement.classList.add("task-popup-mode")
    document.body.classList.add("task-popup-mode")
    return () => {
      document.documentElement.classList.remove("task-popup-mode")
      document.body.classList.remove("task-popup-mode")
    }
  }, [])

  return <DesktopTaskPopup />
}

export default function App(): React.JSX.Element {
  const isTaskPopup = useMemo(() => {
    return new URLSearchParams(window.location.search).get("taskPopup") === "1"
  }, [])

  const isQuickInput = useMemo(() => {
    return new URLSearchParams(window.location.search).get("quickInput") === "1"
  }, [])

  if (isTaskPopup) {
    return <TaskPopupApp />
  }

  return isQuickInput ? <QuickInputApp /> : <MainApp />
}
