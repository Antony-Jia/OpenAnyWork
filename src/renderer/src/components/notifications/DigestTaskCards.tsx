import { Badge } from "@/components/ui/badge"
import type { ButlerDigestTaskCard } from "@/types"

function toStatusVariant(
  status: ButlerDigestTaskCard["status"]
): "outline" | "info" | "nominal" | "critical" {
  if (status === "running") return "info"
  if (status === "completed") return "nominal"
  if (status === "failed" || status === "cancelled") return "critical"
  return "outline"
}

interface DigestTaskCardsProps {
  tasks: ButlerDigestTaskCard[]
  onOpenThread: (threadId: string) => void
  onMuteTask?: (taskIdentity: string) => void
}

export function DigestTaskCards({
  tasks,
  onOpenThread,
  onMuteTask
}: DigestTaskCardsProps): React.JSX.Element | null {
  if (tasks.length === 0) return null

  return (
    <div className="mt-3 space-y-2.5">
      {tasks.map((task) => (
        <div
          key={task.taskIdentity}
          className="rounded-xl border border-border/40 bg-card/45 p-3 backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium" title={task.title}>
                {task.title}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {task.mode} / {task.source}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {new Date(task.updatedAt).toLocaleString()}
              </div>
            </div>
            <Badge variant={toStatusVariant(task.status)}>{task.status}</Badge>
          </div>

          <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
            {task.resultBrief || "暂无摘要。"}
          </div>

          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={!task.threadId}
              onClick={(event) => {
                event.stopPropagation()
                if (!task.threadId) return
                onOpenThread(task.threadId)
              }}
              className="text-xs text-accent hover:text-accent/80 disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              查看线程
            </button>
            {onMuteTask ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onMuteTask(task.taskIdentity)
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                不再提示
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
