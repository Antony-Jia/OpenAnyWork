import type { TaskCompletionNotice } from "@/types"

export type TaskNoticeCard = TaskCompletionNotice

export function TaskNoticeContainer(props: {
  cards: TaskNoticeCard[]
  onClose: (id: string) => void
  onOpenThread: (card: TaskNoticeCard) => void
}): React.JSX.Element | null {
  const { cards, onClose, onOpenThread } = props
  if (cards.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[60vh] w-[380px] flex-col gap-2 overflow-y-auto">
      {cards.map((card) => (
        <div
          key={card.id}
          role="button"
          tabIndex={0}
          className="w-full rounded-lg border border-border bg-card px-3 py-3 text-left shadow-lg hover:border-blue-500/60"
          onClick={() => onOpenThread(card)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onOpenThread(card)
            }
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-[0.15em]">
                {card.noticeType === "event" ? "事件提醒" : "Task Done"}
              </div>
              <div className="text-sm font-medium truncate">{card.title}</div>
            </div>
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
          <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{card.resultBrief}</div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            {new Date(card.completedAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
