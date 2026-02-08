import { Badge } from "@/components/ui/badge"
import type { ButlerTask } from "@/types"

function toStatusVariant(status: ButlerTask["status"]): "outline" | "info" | "nominal" | "critical" {
  if (status === "running") return "info"
  if (status === "completed") return "nominal"
  if (status === "failed" || status === "cancelled") return "critical"
  return "outline"
}

export function ButlerTaskBoard({ tasks }: { tasks: ButlerTask[] }): React.JSX.Element {
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
          {task.resultBrief && (
            <div className="text-xs rounded-sm border border-border/60 bg-background/60 p-2 whitespace-pre-wrap">
              {task.resultBrief}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
