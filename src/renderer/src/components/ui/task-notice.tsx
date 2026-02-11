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
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3.5 w-[420px]">
      {cards.map((card) => (
        <div
          key={card.id}
          role="button"
          tabIndex={0}
          className="cursor-pointer rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 shadow-lg card-hover glow-border"
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
          <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
            {card.resultBrief}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            {new Date(card.completedAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
