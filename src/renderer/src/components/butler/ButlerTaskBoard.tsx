import { Badge } from "@/components/ui/badge"
import type { ButlerTask } from "@/types"

function toStatusVariant(status: ButlerTask["status"]): "outline" | "info" | "nominal" | "critical" {
  if (status === "running") return "info"
  if (status === "completed") return "nominal"
  if (status === "failed" || status === "cancelled") return "critical"
  return "outline"
}

function isSettledStatus(status: ButlerTask["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled"
}

function resolveTaskDetail(task: ButlerTask): string {
  const detail = task.resultDetail?.trim()
  if (detail) return detail
  const brief = task.resultBrief?.trim()
  if (brief) return brief
  return "暂无任务结果内容。"
}

interface ButlerTaskBoardProps {
  tasks: ButlerTask[]
  onOpenThread: (threadId: string) => void
}

export function ButlerTaskBoard({ tasks, onOpenThread }: ButlerTaskBoardProps): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {tasks.length === 0 && (
        <div className="text-xs text-muted-foreground rounded-md border border-border p-3">
          暂无任务
        </div>
      )}

      {tasks.map((task) => (
        <div key={task.id} className="rounded-md border border-border bg-card/70 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium truncate" title={task.title}>
              {task.title}
            </div>
            <Badge variant={toStatusVariant(task.status)}>{task.status}</Badge>
          </div>

          <div className="text-[11px] text-muted-foreground">模式: {task.mode}</div>
          <div className="text-[11px] text-muted-foreground">发起者: {task.requester}</div>
          <div className="text-[11px] text-muted-foreground" title={task.workspacePath}>
            目录: {task.workspacePath}
          </div>
          <div className="text-[11px] text-muted-foreground">
            创建时间: {new Date(task.createdAt).toLocaleString()}
          </div>
          {task.completedAt && (
            <div className="text-[11px] text-muted-foreground">
              完成时间: {new Date(task.completedAt).toLocaleString()}
            </div>
          )}

          <div className="pt-1">
            <button
              type="button"
              disabled={!task.threadId}
              onClick={() => {
                if (!task.threadId) return
                onOpenThread(task.threadId)
              }}
              className="text-xs text-blue-500 hover:text-blue-400 disabled:text-muted-foreground disabled:cursor-not-allowed"
            >
              查看线程
            </button>
          </div>

          {isSettledStatus(task.status) ? (
            <details className="rounded-sm border border-border/60 bg-background/40 p-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">详细结果</summary>
              <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs rounded-sm border border-border/60 bg-background/70 p-2">
                {resolveTaskDetail(task)}
              </div>
            </details>
          ) : (
            task.resultBrief && (
              <div className="text-xs rounded-sm border border-border/60 bg-background/60 p-2 whitespace-pre-wrap">
                {task.resultBrief}
              </div>
            )
          )}
        </div>
      ))}
    </div>
  )
}
