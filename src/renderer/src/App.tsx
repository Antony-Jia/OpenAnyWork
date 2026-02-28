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
import { cn } from "@/lib/utils"

// Badge customization - unused in new titlebar but kept if logic needs reference
const BADGE_MIN_SCREEN_WIDTH = 270
const LEFT_MAX = 350
const LEFT_DEFAULT = 260
const RIGHT_MIN = 250
const RIGHT_MAX = 450
const RIGHT_DEFAULT = 340
const CENTER_SPLIT_MIN = 0.25
const CENTER_SPLIT_MAX = 0.75
const CENTER_SPLIT_DEFAULT = 0.5

type CenterPane = "left" | "right"

function MainApp(): React.JSX.Element {
  const { currentThreadId, threads, loadThreads, createThread, selectThread, appMode, setAppMode } =
    useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)
  const [isDualCenter, setIsDualCenter] = useState(false)
  const [activeCenterPane, setActiveCenterPane] = useState<CenterPane>("left")
  const [leftPaneThreadId, setLeftPaneThreadId] = useState<string | null>(null)
  const [rightPaneThreadId, setRightPaneThreadId] = useState<string | null>(null)
  const [centerSplitRatio, setCenterSplitRatio] = useState(CENTER_SPLIT_DEFAULT)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [taskCards, setTaskCards] = useState<TaskNoticeCard[]>([])
  const centerContainerRef = useRef<HTMLDivElement>(null)
  const centerDragStartRatioRef = useRef<number | null>(null)
  const classicThreads = useMemo(
    () => threads.filter((thread) => thread.metadata?.butlerMain !== true),
    [threads]
  )

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

  const muteTaskIdentity = useCallback(async (taskIdentity: string) => {
    const normalized = taskIdentity.trim()
    if (!normalized) return
    await window.api.notifications.muteTask(normalized)
    setTaskCards((prev) =>
      prev
        .flatMap((card) => {
          if (card.noticeType === "digest" && card.digest) {
            const nextTasks = card.digest.tasks.filter((task) => task.taskIdentity !== normalized)
            if (nextTasks.length === 0) {
              return []
            }
            return [{ ...card, digest: { ...card.digest, tasks: nextTasks } }]
          }
          if (card.taskIdentity === normalized) {
            return []
          }
          return [card]
        })
        .filter(Boolean)
    )
  }, [])

  const openTaskCardThread = useCallback(
    async (card: TaskNoticeCard) => {
      if (card.noticeType === "event" || card.noticeType === "digest") {
        setAppMode("butler")
        setTaskCards((prev) => prev.filter((item) => item.id !== card.id))
        return
      }

      setAppMode("classic")
      await useAppStore.getState().selectThread(card.threadId)
      setTaskCards((prev) => prev.filter((item) => item.threadId !== card.threadId))
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

  const activateCenterPane = useCallback(
    (pane: CenterPane) => {
      setActiveCenterPane(pane)
      const paneThreadId = pane === "left" ? leftPaneThreadId : rightPaneThreadId
      if (!paneThreadId && currentThreadId) {
        if (pane === "left") {
          setLeftPaneThreadId(currentThreadId)
        } else {
          setRightPaneThreadId(currentThreadId)
        }
        return
      }
      if (paneThreadId && paneThreadId !== currentThreadId) {
        void selectThread(paneThreadId)
      }
    },
    [leftPaneThreadId, rightPaneThreadId, currentThreadId, selectThread]
  )

  const handleCenterResize = useCallback(
    (totalDelta: number) => {
      if (!centerContainerRef.current) return
      if (centerDragStartRatioRef.current === null) {
        centerDragStartRatioRef.current = centerSplitRatio
      }
      const totalWidth = centerContainerRef.current.clientWidth
      if (totalWidth <= 0) return
      const ratioDelta = totalDelta / totalWidth
      const nextRatio = Math.min(
        CENTER_SPLIT_MAX,
        Math.max(CENTER_SPLIT_MIN, centerDragStartRatioRef.current + ratioDelta)
      )
      setCenterSplitRatio(nextRatio)
    },
    [centerSplitRatio]
  )

  const handleToggleDualCenter = useCallback(() => {
    if (!isDualCenter) {
      const primary = currentThreadId ?? classicThreads[0]?.thread_id ?? null
      const secondary =
        classicThreads.find((thread) => thread.thread_id !== primary)?.thread_id ?? primary
      setLeftPaneThreadId(primary)
      setRightPaneThreadId(secondary)
      setActiveCenterPane("left")
      setCenterSplitRatio(CENTER_SPLIT_DEFAULT)
      setIsDualCenter(true)
      if (primary && primary !== currentThreadId) {
        void selectThread(primary)
      }
      return
    }

    const activeThreadId = activeCenterPane === "left" ? leftPaneThreadId : rightPaneThreadId
    setIsDualCenter(false)
    if (activeThreadId && activeThreadId !== currentThreadId) {
      void selectThread(activeThreadId)
    }
  }, [
    isDualCenter,
    currentThreadId,
    classicThreads,
    activeCenterPane,
    leftPaneThreadId,
    rightPaneThreadId,
    selectThread
  ])

  // Reset drag start on mouse up
  useEffect(() => {
    const handleMouseUp = (): void => {
      dragStartWidths.current = null
      centerDragStartRatioRef.current = null
    }
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [])

  useEffect(() => {
    if (!currentThreadId) return
    if (!isDualCenter) {
      setLeftPaneThreadId(currentThreadId)
      return
    }
    if (activeCenterPane === "left") {
      setLeftPaneThreadId(currentThreadId)
    } else {
      setRightPaneThreadId(currentThreadId)
    }
  }, [currentThreadId, isDualCenter, activeCenterPane])

  useEffect(() => {
    const availableIds = classicThreads.map((thread) => thread.thread_id)
    const availableSet = new Set(availableIds)
    const fallbackId = availableIds[0] ?? null
    const resolvedLeftId =
      leftPaneThreadId && availableSet.has(leftPaneThreadId) ? leftPaneThreadId : fallbackId

    if (leftPaneThreadId && !availableSet.has(leftPaneThreadId)) {
      setLeftPaneThreadId(fallbackId)
    }

    if (rightPaneThreadId && !availableSet.has(rightPaneThreadId)) {
      const secondaryId = availableIds.find((id) => id !== resolvedLeftId) ?? fallbackId
      setRightPaneThreadId(secondaryId)
    }

    if (isDualCenter) {
      if (!leftPaneThreadId && fallbackId) {
        setLeftPaneThreadId(fallbackId)
      }
      if (!rightPaneThreadId && fallbackId) {
        const secondaryId = availableIds.find((id) => id !== resolvedLeftId) ?? fallbackId
        setRightPaneThreadId(secondaryId)
      }
    }
  }, [classicThreads, isDualCenter, leftPaneThreadId, rightPaneThreadId])

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

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on("app:open-butler", () => {
      setAppMode("butler")
    })
    return () => {
      if (typeof cleanup === "function") cleanup()
    }
  }, [setAppMode])

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on("window:maximized", (...args: unknown[]) => {
      const isMaximized = args[0] as boolean
      document.documentElement.classList.toggle("window-maximized", isMaximized)
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
      if (!card?.id) return
      if (card.noticeType !== "digest" && !card.threadId) return
      if (useAppStore.getState().appMode === "butler") return
      setTaskCards((prev) => {
        const next = prev.filter((item) => item.id !== card.id)
        return [card, ...next]
      })
    })
    return () => {
      if (typeof cleanup === "function") cleanup()
    }
  }, [])

  useEffect(() => {
    if (appMode === "butler") {
      setTaskCards([])
    }
  }, [appMode])

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
      {appMode !== "butler" && (
        <TaskNoticeContainer
          cards={taskCards}
          onClose={removeTaskCard}
          onOpenThread={(card) => void openTaskCardThread(card)}
          onMuteTask={(taskIdentity) => void muteTaskIdentity(taskIdentity)}
        />
      )}
      <div className="app-shell flex h-screen w-screen flex-col overflow-hidden text-foreground">
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
                className="shrink-0 flex flex-col border-r border-border/50 bg-sidebar/40 backdrop-blur-sm"
              >
                <ThreadSidebar />
              </div>

              <ResizeHandle onDrag={handleLeftResize} />

              {/* Center Panel (Chat) */}
              <main className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden bg-background/50 relative">
                {/* Center Header with Tabs */}
                {currentThreadId && (
                  <div className="h-12 border-b border-border/50 flex items-center px-2.5 shrink-0 bg-background/40 backdrop-blur-md gap-2">
                    <TabBar
                      className="h-full border-b-0 flex-1 min-w-0"
                      threadId={currentThreadId}
                    />
                    <button
                      type="button"
                      onClick={handleToggleDualCenter}
                      className={cn(
                        "h-8 shrink-0 rounded-md border px-2.5 text-[11px] font-medium transition-all",
                        isDualCenter
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                      title={isDualCenter ? "切换为单窗" : "切换为双窗"}
                    >
                      {isDualCenter ? "单窗" : "双窗"}
                    </button>
                  </div>
                )}

                <div className="flex-1 flex flex-col min-h-0">
                  {currentThreadId ? (
                    isDualCenter ? (
                      <div
                        ref={centerContainerRef}
                        className="flex flex-1 min-w-0 min-h-0 overflow-hidden p-2"
                      >
                        <section
                          onMouseDownCapture={() => activateCenterPane("left")}
                          style={{ width: `calc(${(centerSplitRatio * 100).toFixed(4)}% - 3px)` }}
                          className={cn(
                            "min-w-[220px] flex min-h-0 shrink-0 overflow-hidden rounded-lg border bg-background/70 transition-all",
                            activeCenterPane === "left"
                              ? "ring-2 ring-accent/60 glow-border border-accent/40"
                              : "ring-1 ring-border/40 border-border/50"
                          )}
                        >
                          {leftPaneThreadId ? (
                            <TabbedPanel
                              threadId={leftPaneThreadId}
                              showTabBar={false}
                              autoFocus={activeCenterPane === "left"}
                            />
                          ) : (
                            <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                              No thread available
                            </div>
                          )}
                        </section>

                        <ResizeHandle onDrag={handleCenterResize} />

                        <section
                          onMouseDownCapture={() => activateCenterPane("right")}
                          style={{
                            width: `calc(${((1 - centerSplitRatio) * 100).toFixed(4)}% - 3px)`
                          }}
                          className={cn(
                            "min-w-[220px] flex min-h-0 shrink-0 overflow-hidden rounded-lg border bg-background/70 transition-all",
                            activeCenterPane === "right"
                              ? "ring-2 ring-accent/60 glow-border border-accent/40"
                              : "ring-1 ring-border/40 border-border/50"
                          )}
                        >
                          {rightPaneThreadId ? (
                            <TabbedPanel
                              threadId={rightPaneThreadId}
                              showTabBar={false}
                              autoFocus={activeCenterPane === "right"}
                            />
                          ) : (
                            <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                              No thread available
                            </div>
                          )}
                        </section>
                      </div>
                    ) : (
                      <TabbedPanel threadId={currentThreadId} showTabBar={false} />
                    )
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground h-full text-sm gap-3">
                      <div className="text-accent/40 text-3xl">&#9670;</div>
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
              className="shrink-0 border-l border-border/50 bg-sidebar/60 backdrop-blur-sm"
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
