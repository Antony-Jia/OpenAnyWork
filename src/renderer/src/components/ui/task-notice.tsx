import { useState } from "react"
import type { TaskCompletionNotice } from "@/types"
import { DigestTaskCards } from "@/components/notifications/DigestTaskCards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type TaskNoticeCard = TaskCompletionNotice

export function TaskNoticeContainer(props: {
  cards: TaskNoticeCard[]
  onClose: (id: string) => void
  onOpenThread: (card: TaskNoticeCard) => void
  onMuteTask: (taskIdentity: string, card: TaskNoticeCard) => void
}): React.JSX.Element | null {
  const { cards, onClose, onOpenThread, onMuteTask } = props
  const [collapsedDigest, setCollapsedDigest] = useState<Record<string, boolean>>({})
  if (cards.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3.5 w-[420px]">
      {cards.map((card) => {
        const digest = card.noticeType === "digest" && card.digest ? card.digest : null
        const primaryTaskThreadId = digest?.tasks.find((task) => task.threadId.trim())?.threadId || ""
        const targetThreadId = digest ? primaryTaskThreadId : card.threadId.trim()
        const isCollapsed = digest ? collapsedDigest[card.id] === true : false
        return (
          <Card
            key={card.id}
            role="button"
            tabIndex={0}
            className={cn(
              "cursor-pointer border-border/40 bg-card/85 backdrop-blur-xl shadow-lg card-hover glow-border task-notice-card-shell",
              digest && "butler-notice-shell butler-notice-shell--digest"
            )}
            onClick={() => {
              if (!targetThreadId) return
              onOpenThread({ ...card, threadId: targetThreadId, noticeType: "task" })
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                if (!targetThreadId) return
                onOpenThread({ ...card, threadId: targetThreadId, noticeType: "task" })
              }
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-[0.15em]">
                    {card.noticeType === "event"
                      ? "事件提醒"
                      : digest
                        ? "管家服务汇总"
                        : "任务更新"}
                  </div>
                  <CardTitle className="mt-1 truncate text-sm">{card.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {digest ? <Badge variant="nominal">{digest.tasks.length} 项更新</Badge> : null}
                  {digest ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setCollapsedDigest((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                      }}
                      className="text-xs text-accent hover:text-accent/80"
                    >
                      {isCollapsed ? "展开" : "折叠"}
                    </button>
                  ) : null}
                  {!digest && card.taskIdentity ? (
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
              {digest && isCollapsed ? (
                <div className="text-xs text-muted-foreground">已折叠，点击“展开”查看详情。</div>
              ) : null}
              {!isCollapsed ? (
                <div
                  className={cn(
                    "rounded-lg border border-border/40 bg-background/45 p-3 text-xs text-muted-foreground whitespace-pre-wrap",
                    digest && "butler-notice-section"
                  )}
                >
                  {digest ? digest.summaryText : card.resultBrief}
                </div>
              ) : null}
              {digest && !isCollapsed ? (
                <div className="butler-notice-section grid grid-cols-1 gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                  <div className="butler-notice-kv">
                    <div className="butler-notice-kv__label">时间窗开始</div>
                    <div className="butler-notice-kv__value">
                      {new Date(digest.windowStart).toLocaleString()}
                    </div>
                  </div>
                  <div className="butler-notice-kv">
                    <div className="butler-notice-kv__label">时间窗结束</div>
                    <div className="butler-notice-kv__value">
                      {new Date(digest.windowEnd).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : null}
              {digest && !isCollapsed ? (
                <DigestTaskCards
                  tasks={digest.tasks}
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
        )
      })}
    </div>
  )
}
