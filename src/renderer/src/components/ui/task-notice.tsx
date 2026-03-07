import type { TaskCompletionNotice } from "@/types"
import { DigestTaskCards } from "@/components/notifications/DigestTaskCards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type TaskNoticeCard = TaskCompletionNotice

export function TaskNoticeContainer(props: {
  cards: TaskNoticeCard[]
  onClose: (id: string) => void
  onOpenThread: (card: TaskNoticeCard) => void
  onMuteTask: (taskIdentity: string, card: TaskNoticeCard) => void
}): React.JSX.Element | null {
  const { cards, onClose, onOpenThread, onMuteTask } = props
  if (cards.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3.5 w-[420px]">
      {cards.map((card) => (
        <Card
          key={card.id}
          role="button"
          tabIndex={0}
          className="cursor-pointer border-border/40 bg-card/85 backdrop-blur-xl shadow-lg card-hover glow-border"
          onClick={() => onOpenThread(card)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onOpenThread(card)
            }
          }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground uppercase tracking-[0.15em]">
                  {card.noticeType === "event"
                    ? "事件提醒"
                    : card.noticeType === "digest"
                      ? "管家服务汇总"
                      : "任务更新"}
                </div>
                <CardTitle className="mt-1 truncate text-sm">{card.title}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {card.noticeType === "digest" && card.digest ? (
                  <Badge variant="info">{card.digest.tasks.length} tasks</Badge>
                ) : null}
                {card.noticeType !== "digest" && card.taskIdentity ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onMuteTask(card.taskIdentity as string, card)
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    不再提示
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose(card.id)
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  关闭
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="rounded-lg border border-border/40 bg-background/45 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
              {card.noticeType === "digest" && card.digest
                ? card.digest.summaryText
                : card.resultBrief}
            </div>
            {card.noticeType === "digest" && card.digest ? (
              <DigestTaskCards
                tasks={card.digest.tasks}
                onOpenThread={(threadId) => {
                  onOpenThread({ ...card, threadId, noticeType: "task" })
                }}
                onMuteTask={(taskIdentity) => onMuteTask(taskIdentity, card)}
              />
            ) : null}
            <div className="text-[10px] text-muted-foreground">
              {new Date(card.completedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
