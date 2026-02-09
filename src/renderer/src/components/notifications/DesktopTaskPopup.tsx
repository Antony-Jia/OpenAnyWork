import { useCallback, useEffect, useState } from "react"
import type { TaskCompletionNotice } from "@/types"

export function DesktopTaskPopup(): React.JSX.Element {
  const [notice, setNotice] = useState<TaskCompletionNotice | null>(null)

  useEffect(() => {
    const cleanups: Array<() => void> = []

    cleanups.push(
      window.electron.ipcRenderer.on("task-popup:show", (...args: unknown[]) => {
        const next = args[0] as TaskCompletionNotice
        if (!next?.id) return
        setNotice(next)
      })
    )

    cleanups.push(
      window.electron.ipcRenderer.on("task-popup:close", (...args: unknown[]) => {
        const payload = args[0] as { id?: string } | undefined
        setNotice((current) => {
          if (!current) return null
          if (!payload?.id || payload.id === current.id) {
            return null
          }
          return current
        })
      })
    )

    return () => {
      window.electron.ipcRenderer.send("task-popup:hover", false)
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [])

  const openThread = useCallback(() => {
    if (!notice) return
    if (notice.noticeType === "event") {
      window.electron.ipcRenderer.send("app:open-butler")
      window.electron.ipcRenderer.send("task-popup:dismiss", { noticeId: notice.id })
      return
    }
    window.electron.ipcRenderer.send("task-popup:open-thread", {
      noticeId: notice.id,
      threadId: notice.threadId
    })
  }, [notice])

  const dismiss = useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation()
      if (!notice) return
      window.electron.ipcRenderer.send("task-popup:dismiss", { noticeId: notice.id })
    },
    [notice]
  )

  return (
    <div
      className="h-screen w-screen bg-transparent p-3"
      onMouseEnter={() => window.electron.ipcRenderer.send("task-popup:hover", true)}
      onMouseLeave={() => window.electron.ipcRenderer.send("task-popup:hover", false)}
    >
      {notice ? (
        <div
          role="button"
          tabIndex={0}
          className="h-full w-full rounded-xl border border-blue-400/35 bg-card/98 p-3 shadow-2xl backdrop-blur"
          onClick={openThread}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              openThread()
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em] text-blue-500">
                {notice.noticeType === "event" ? "事件提醒" : "Task Completed"}
              </div>
              <div className="truncate text-sm font-semibold">{notice.title}</div>
            </div>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground"
              onClick={dismiss}
            >
              关闭
            </button>
          </div>
          <div className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
            {notice.resultBrief}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="uppercase tracking-[0.12em]">
              {notice.noticeType === "event" && notice.eventKind
                ? `${notice.eventKind} / ${notice.source}`
                : `${notice.mode} / ${notice.source}`}
            </span>
            <span>{new Date(notice.completedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
