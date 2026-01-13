import { useEffect, useState, useCallback, useRef } from 'react'
import { ThreadSidebar } from '@/components/sidebar/ThreadSidebar'
import { TabbedPanel, TabBar } from '@/components/tabs'
import { RightPanel } from '@/components/panels/RightPanel'
import { ResizeHandle } from '@/components/ui/resizable'
import { useAppStore } from '@/lib/store'

const LEFT_MIN = 180
const LEFT_MAX = 350
const LEFT_DEFAULT = 240

const RIGHT_MIN = 250
const RIGHT_MAX = 450
const RIGHT_DEFAULT = 320

function App(): React.JSX.Element {
  const { currentThreadId, loadThreads, createThread } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)

  // Track drag start widths
  const dragStartWidths = useRef<{ left: number; right: number } | null>(null)

  const handleLeftResize = useCallback(
    (totalDelta: number) => {
      if (!dragStartWidths.current) {
        dragStartWidths.current = { left: leftWidth, right: rightWidth }
      }
      const newWidth = dragStartWidths.current.left + totalDelta
      setLeftWidth(Math.min(LEFT_MAX, Math.max(LEFT_MIN, newWidth)))
    },
    [leftWidth, rightWidth]
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
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  useEffect(() => {
    async function init(): Promise<void> {
      try {
        await loadThreads()
        // Create a default thread if none exist
        const threads = useAppStore.getState().threads
        if (threads.length === 0) {
          await createThread()
        }
      } catch (error) {
        console.error('Failed to initialize:', error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [loadThreads, createThread])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Initializing...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Titlebar row with tabs integrated */}
      <div className="flex h-9 w-full shrink-0 app-drag-region bg-sidebar">
        {/* Left section - app badge area (matches left sidebar width) */}
        <div style={{ width: leftWidth }} className="shrink-0 flex items-center relative">
          <div className="absolute top-1/2 -translate-y-1/2 left-[76px] flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/30 leading-none">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary leading-none">
              OPENWORK
            </span>
            <span className="text-[9px] text-primary/70 font-mono leading-none">
              {__APP_VERSION__}
            </span>
          </div>
        </div>

        {/* Resize handle spacer */}
        <div className="w-[1px] shrink-0" />

        {/* Center section - Tab bar */}
        <div className="flex-1 min-w-0">
          {currentThreadId && <TabBar className="h-full border-b-0" />}
        </div>

        {/* Resize handle spacer */}
        <div className="w-[1px] shrink-0" />

        {/* Right section spacer (matches right panel width) */}
        <div style={{ width: rightWidth }} className="shrink-0" />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Thread List */}
        <div style={{ width: leftWidth }} className="shrink-0">
          <ThreadSidebar />
        </div>

        <ResizeHandle onDrag={handleLeftResize} />

        {/* Center - Content Panel (Agent Chat + File Viewer) */}
        <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {currentThreadId ? (
            <TabbedPanel threadId={currentThreadId} showTabBar={false} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Select or create a thread to begin
            </div>
          )}
        </main>

        <ResizeHandle onDrag={handleRightResize} />

        {/* Right Panel - Status Panels */}
        <div style={{ width: rightWidth }} className="shrink-0">
          <RightPanel />
        </div>
      </div>
    </div>
  )
}

export default App
