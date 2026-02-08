import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { ButlerTaskBoard } from "./ButlerTaskBoard"
import type { ButlerState, ButlerTask } from "@/types"

export function ButlerWorkspace(): React.JSX.Element {
  const [state, setState] = useState<ButlerState | null>(null)
  const [tasks, setTasks] = useState<ButlerTask[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    const [nextState, nextTasks] = await Promise.all([
      window.api.butler.getState(),
      window.api.butler.listTasks()
    ])
    setState(nextState)
    setTasks(nextTasks)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const cleanups: Array<() => void> = []
    cleanups.push(
      window.api.butler.onTaskUpdate((nextTasks) => {
        setTasks(nextTasks)
      })
    )
    cleanups.push(
      window.electron.ipcRenderer.on("butler:state-changed", (...args: unknown[]) => {
        const nextState = args[0] as ButlerState
        setState(nextState)
      })
    )
    cleanups.push(
      window.api.butler.onTaskCompleted((card) => {
        // 管家页收到完成卡后切回传统模式并定位线程由卡片点击处理，这里仅刷新数据。
        void load()
        console.log("[Butler] Task completed:", card.threadId)
      })
    )
    return () => {
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [load])

  const rounds = state?.recentRounds || []

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending])

  const handleSend = async (): Promise<void> => {
    const message = input.trim()
    if (!message || sending) return
    setSending(true)
    try {
      const nextState = await window.api.butler.send(message)
      setInput("")
      setState(nextState)
      const nextTasks = await window.api.butler.listTasks()
      setTasks(nextTasks)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col border-r border-border">
        <header className="h-10 px-3 border-b border-border flex items-center text-xs text-muted-foreground uppercase tracking-[0.18em]">
          Butler AI
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {rounds.length === 0 && (
            <div className="text-xs text-muted-foreground rounded-md border border-border p-3">
              暂无对话，输入你的任务需求后，管家会自动路由。
            </div>
          )}
          {rounds.map((round) => (
            <div key={round.id} className="space-y-2">
              <div className="rounded-md border border-border bg-card p-3 text-sm whitespace-pre-wrap">
                {round.user}
              </div>
              <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-sm whitespace-pre-wrap">
                {round.assistant}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void handleSend()
              }
            }}
            placeholder="给管家输入需求..."
            className="min-h-[44px] max-h-[180px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button onClick={() => void handleSend()} disabled={!canSend}>
            {sending ? "处理中..." : "发送"}
          </Button>
        </div>
      </section>

      <aside className="w-[380px] shrink-0">
        <header className="h-10 px-3 border-b border-border flex items-center justify-between text-xs text-muted-foreground uppercase tracking-[0.18em]">
          <span>执行任务</span>
          <span>{tasks.filter((task) => task.status === "running").length} Running</span>
        </header>
        <ButlerTaskBoard tasks={tasks} />
      </aside>
    </div>
  )
}
