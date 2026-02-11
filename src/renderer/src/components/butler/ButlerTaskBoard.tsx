import { Badge } from "@/components/ui/badge"
import type { ButlerTask } from "@/types"

function toStatusVariant(
  status: ButlerTask["status"]
): "outline" | "info" | "nominal" | "critical" {
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
    <div className="h-full overflow-y-auto p-5 space-y-4 tech-gradient">
      {tasks.length === 0 && (
        <div className="text-sm text-muted-foreground rounded-2xl border border-border/40 p-8 text-center glass-panel">
          <div className="text-accent/50 text-xl mb-2">&#9671;</div>
          暂无任务
        </div>
      )}

      {tasks.map((task) => (
        <div key={task.id} className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-2.5 status-bar-left pl-6 card-hover" style={{ '--status-color': task.status === 'running' ? 'var(--status-info)' : task.status === 'completed' ? 'var(--status-nominal)' : task.status === 'failed' || task.status === 'cancelled' ? 'var(--status-critical)' : 'var(--accent)' } as React.CSSProperties}>
          <div className="flex items-center justify-between gap-3">
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
              className="text-xs text-accent hover:text-accent/80 hover:neon-text disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-200"
            >
              查看线程
            </button>
          </div>

          {isSettledStatus(task.status) ? (
            <details className="rounded-lg border border-border/40 bg-background/30 backdrop-blur-sm p-3">
              <summary className="cursor-pointer text-xs text-muted-foreground font-semibold">详细结果</summary>
              <div className="mt-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs rounded-lg border border-border/40 bg-background/50 backdrop-blur-sm p-3">
                {resolveTaskDetail(task)}
              </div>
            </details>
          ) : (
            task.resultBrief && (
              <div className="text-xs rounded-lg border border-border/40 bg-background/40 backdrop-blur-sm p-3 whitespace-pre-wrap">
                {task.resultBrief}
              </div>
            )
          )}
        </div>
      ))}
    </div>
  )
}
