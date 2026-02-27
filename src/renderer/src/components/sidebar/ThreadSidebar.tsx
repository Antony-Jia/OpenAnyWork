import { useState } from "react"
import { Plus, MessageSquare, Trash2, Pencil, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/lib/store"
import { useThreadStream } from "@/lib/thread-context"
import { cn, formatRelativeTime, truncate } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LoopConfigDialog } from "@/components/loop/LoopConfigDialog"
import { ExpertConfigDialog } from "@/components/expert/ExpertConfigDialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu"
import { useLanguage } from "@/lib/i18n"
import type { Thread, ThreadMode } from "@/types"

// Thread loading indicator that subscribes to the stream context
function ThreadLoadingIcon({ threadId }: { threadId: string }): React.JSX.Element {
  const { isLoading } = useThreadStream(threadId)

  if (isLoading) {
    return <Loader2 className="size-4.5 shrink-0 text-status-info animate-spin" />
  }
  return <MessageSquare className="size-4.5 shrink-0 text-muted-foreground" />
}

// Individual thread list item component
function ThreadListItem({
  thread,
  isSelected,
  isEditing,
  editingTitle,
  onSelect,
  onDelete,
  onStartEditing,
  onSaveTitle,
  onCancelEditing,
  onEditingTitleChange
}: {
  thread: Thread
  isSelected: boolean
  isEditing: boolean
  editingTitle: string
  onSelect: () => void
  onDelete: () => void
  onStartEditing: () => void
  onSaveTitle: () => void
  onCancelEditing: () => void
  onEditingTitleChange: (value: string) => void
}): React.JSX.Element {
  const { t } = useLanguage()
  const mode = (thread.metadata?.mode as ThreadMode) || "default"
  const modeAccent =
    mode === "ralph"
      ? "border-l-2 border-emerald-400/60 bg-emerald-50/30 dark:bg-emerald-950/20"
      : mode === "email"
        ? "border-l-2 border-violet-400/60 bg-violet-50/30 dark:bg-violet-950/20"
        : mode === "loop"
          ? "border-l-2 border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20"
          : mode === "expert"
            ? "border-l-2 border-cyan-400/60 bg-cyan-50/30 dark:bg-cyan-950/20"
            : "border-l-2 border-blue-400/40 bg-blue-50/30 dark:bg-blue-950/20"
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group relative flex items-center gap-3 rounded-xl px-3.5 py-3 cursor-pointer transition-all duration-300 overflow-hidden mx-2",
            modeAccent,
            isSelected
              ? "bg-sidebar-accent text-foreground shadow-md ring-1 ring-accent/30 glow-border"
              : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground"
          )}
          onClick={() => {
            if (!isEditing) {
              onSelect()
            }
          }}
        >
          <ThreadLoadingIcon threadId={thread.thread_id} />
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => onEditingTitleChange(e.target.value)}
                onBlur={onSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveTitle()
                  if (e.key === "Escape") onCancelEditing()
                }}
                className="w-full bg-background/60 backdrop-blur-sm border border-border rounded-lg px-2 py-1 text-sm outline-none cyber-input"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div
                  className="text-[13px] truncate block w-full cursor-text"
                  title={thread.title || thread.thread_id}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onStartEditing()
                  }}
                >
                  {thread.title?.trim() || truncate(thread.thread_id, 20)}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {formatRelativeTime(thread.updated_at)}
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onStartEditing}>
          <Pencil className="size-4 mr-2" />
          {t("sidebar.rename")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4 mr-2" />
          {t("sidebar.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ThreadSidebar(): React.JSX.Element {
  const {
    threads,
    currentThreadId,
    createThread,
    selectThread,
    deleteThread,
    updateThread,
    threadOriginFilter,
    setThreadOriginFilter
  } = useAppStore()
  const { t } = useLanguage()

  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [loopDialogOpen, setLoopDialogOpen] = useState(false)
  const [expertDialogOpen, setExpertDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null)
  const [deleteMemory, setDeleteMemory] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const startEditing = (threadId: string, currentTitle: string): void => {
    setEditingThreadId(threadId)
    setEditingTitle(currentTitle || "")
  }

  const saveTitle = async (): Promise<void> => {
    if (editingThreadId && editingTitle.trim()) {
      await updateThread(editingThreadId, { title: editingTitle.trim() })
    }
    setEditingThreadId(null)
    setEditingTitle("")
  }

  const cancelEditing = (): void => {
    setEditingThreadId(null)
    setEditingTitle("")
  }

  const handleNewThread = async (mode: ThreadMode): Promise<void> => {
    const metadata: Record<string, unknown> = {
      title: `Thread ${new Date().toLocaleDateString()}`,
      mode
    }
    if (mode === "ralph") {
      metadata.ralph = { phase: "init", round: 0, iterations: 0, totalIterations: 0 }
    }
    await createThread(metadata)
    setNewThreadOpen(false)
  }

  const requestDeleteThread = (thread: Thread): void => {
    setDeleteTarget(thread)
    setDeleteMemory(false)
  }

  const closeDeleteDialog = (): void => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteMemory(false)
  }

  const confirmDeleteThread = async (): Promise<void> => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deleteThread(deleteTarget.thread_id, { deleteMemory })
      setDeleteTarget(null)
      setDeleteMemory(false)
    } finally {
      setDeleting(false)
    }
  }

  const filteredThreads = threads.filter((thread) => {
    if (thread.metadata?.butlerMain === true) return false
    const createdBy = thread.metadata?.createdBy as string | undefined
    if (threadOriginFilter === "all") return true
    if (threadOriginFilter === "butler") return createdBy === "butler"
    return createdBy !== "butler"
  })

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/30 bg-sidebar overflow-hidden">
      {/* New Thread Button - with dynamic safe area padding when zoomed out */}
      <div className="p-2" style={{ paddingTop: "calc(8px + var(--sidebar-safe-padding, 0px))" }}>
        <Popover open={newThreadOpen} onOpenChange={setNewThreadOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2.5 rounded-xl text-[13px]"
            >
              <Plus className="size-4.5" />
              {t("sidebar.new_thread")}
              <ChevronDown className="size-3.5 ml-auto text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[280px] p-2.5 space-y-1">
            <button
              type="button"
              onClick={() => handleNewThread("default")}
              className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-accent/10 transition-all duration-200"
            >
              <div className="font-semibold">{t("sidebar.new_thread.default")}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("sidebar.new_thread.default_desc")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleNewThread("ralph")}
              className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-accent/10 transition-all duration-200"
            >
              <div className="font-semibold">{t("sidebar.new_thread.ralph")}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("sidebar.new_thread.ralph_desc")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleNewThread("email")}
              className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-accent/10 transition-all duration-200"
            >
              <div className="font-semibold">{t("sidebar.new_thread.email")}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("sidebar.new_thread.email_desc")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setNewThreadOpen(false)
                setLoopDialogOpen(true)
              }}
              className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-accent/10 transition-all duration-200"
            >
              <div className="font-semibold">{t("sidebar.new_thread.loop")}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("sidebar.new_thread.loop_desc")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setNewThreadOpen(false)
                setExpertDialogOpen(true)
              }}
              className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] hover:bg-accent/10 transition-all duration-200"
            >
              <div className="font-semibold">{t("sidebar.new_thread.expert")}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("sidebar.new_thread.expert_desc")}
              </div>
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="px-2 pb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setThreadOriginFilter("all")}
          className={cn(
            "h-8 px-3.5 rounded-lg text-[11px] border transition-all duration-300",
            threadOriginFilter === "all"
              ? "border-accent/50 text-accent bg-accent/10 font-bold shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
              : "border-border/40 text-muted-foreground hover:border-accent/30 hover:text-foreground"
          )}
        >
          全部
        </button>
        <button
          type="button"
          onClick={() => setThreadOriginFilter("manual")}
          className={cn(
            "h-8 px-3.5 rounded-lg text-[11px] border transition-all duration-300",
            threadOriginFilter === "manual"
              ? "border-accent/50 text-accent bg-accent/10 font-bold shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
              : "border-border/40 text-muted-foreground hover:border-accent/30 hover:text-foreground"
          )}
        >
          人工
        </button>
        <button
          type="button"
          onClick={() => setThreadOriginFilter("butler")}
          className={cn(
            "h-8 px-3.5 rounded-lg text-[11px] border transition-all duration-300",
            threadOriginFilter === "butler"
              ? "border-accent/50 text-accent bg-accent/10 font-bold shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
              : "border-border/40 text-muted-foreground hover:border-accent/30 hover:text-foreground"
          )}
        >
          管家
        </button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1.5 overflow-hidden">
          {filteredThreads.map((thread) => (
            <ThreadListItem
              key={thread.thread_id}
              thread={thread}
              isSelected={currentThreadId === thread.thread_id}
              isEditing={editingThreadId === thread.thread_id}
              editingTitle={editingTitle}
              onSelect={() => selectThread(thread.thread_id)}
              onDelete={() => requestDeleteThread(thread)}
              onStartEditing={() => startEditing(thread.thread_id, thread.title || "")}
              onSaveTitle={saveTitle}
              onCancelEditing={cancelEditing}
              onEditingTitleChange={setEditingTitle}
            />
          ))}

          {filteredThreads.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("sidebar.no_threads")}
            </div>
          )}
        </div>
      </ScrollArea>

      <LoopConfigDialog open={loopDialogOpen} onOpenChange={setLoopDialogOpen} mode="create" />
      <ExpertConfigDialog
        open={expertDialogOpen}
        onOpenChange={setExpertDialogOpen}
        mode="create"
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteDialog()
          }
        }}
      >
        <DialogContent className="w-[420px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>{t("sidebar.delete_confirm_title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{t("sidebar.delete_confirm_desc")}</div>
            <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground break-all">
              {deleteTarget?.title?.trim() || deleteTarget?.thread_id}
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={deleteMemory}
                onChange={(event) => setDeleteMemory(event.target.checked)}
                disabled={deleting}
              />
              {t("sidebar.delete_with_memory")}
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={closeDeleteDialog} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteThread()}
              disabled={deleting}
            >
              {deleting ? t("sidebar.deleting") : t("sidebar.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
