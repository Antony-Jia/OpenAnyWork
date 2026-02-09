import { useCallback, useEffect, useMemo, useState } from "react"
import { Brain, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { DailyProfile, MemorySummary } from "@/types"

interface ConversationMemoryGroup {
  threadId: string
  title: string
  items: MemorySummary[]
  latestAt: string
}

export function MemoryManager(): React.JSX.Element {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<MemorySummary[]>([])
  const [dailyProfiles, setDailyProfiles] = useState<DailyProfile[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [conversation, profileList] = await Promise.all([
        window.api.memory.listConversationSummaries(500),
        window.api.memory.listDailyProfiles(180)
      ])
      setSummaries(conversation)
      setDailyProfiles(profileList)
    } catch (e) {
      const message = e instanceof Error ? e.message : t("memory.load_failed")
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [t])

  const handleClearAll = useCallback(async () => {
    if (clearing) return
    const confirmed = window.confirm(t("memory.clear_confirm"))
    if (!confirmed) return

    setClearing(true)
    setError(null)
    setInfo(null)
    try {
      await window.api.memory.clearAll()
      setInfo(t("memory.cleared"))
      await loadData()
    } catch (e) {
      const message = e instanceof Error ? e.message : t("memory.clear_failed")
      setError(message)
    } finally {
      setClearing(false)
    }
  }, [clearing, loadData, t])

  useEffect(() => {
    if (!open) return
    void loadData()
  }, [open, loadData])

  const groupedSummaries = useMemo<ConversationMemoryGroup[]>(() => {
    const groups = new Map<string, ConversationMemoryGroup>()

    for (const item of summaries) {
      const existing = groups.get(item.threadId)
      if (!existing) {
        groups.set(item.threadId, {
          threadId: item.threadId,
          title: item.title?.trim() || `${t("memory.thread_fallback")} ${item.threadId}`,
          items: [item],
          latestAt: item.createdAt
        })
        continue
      }

      existing.items.push(item)
      if (item.createdAt > existing.latestAt) {
        existing.latestAt = item.createdAt
      }
      if (!existing.title || existing.title.startsWith(t("memory.thread_fallback"))) {
        const nextTitle = item.title?.trim()
        if (nextTitle) {
          existing.title = nextTitle
        }
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }))
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
  }, [summaries, t])

  const openButtonClass = cn(
    "h-7 w-7 rounded-md border border-transparent",
    open
      ? "bg-background/70 text-foreground border-border/80"
      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={openButtonClass}
        title={t("titlebar.memory")}
        aria-label={t("titlebar.memory")}
        onClick={() => setOpen(true)}
      >
        <Brain className="size-4" />
      </Button>

      <DialogContent className="w-[980px] h-[700px] max-w-[94vw] max-h-[90vh] p-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                {t("memory.title")}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadData()}
                  disabled={loading || clearing}
                >
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                  {t("memory.refresh")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleClearAll()}
                  disabled={loading || clearing}
                >
                  <Trash2 className="size-3.5" />
                  {clearing ? t("memory.clearing") : t("memory.clear_all")}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-scroll px-6 pb-6 pt-4 space-y-6">
            <section className="space-y-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("memory.section.conversation")}
              </div>

              {loading ? (
                <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : groupedSummaries.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {t("memory.empty_conversation")}
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedSummaries.map((group) => (
                    <div key={group.threadId} className="rounded-sm border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" title={group.title}>
                            {group.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground break-all">
                            {group.threadId}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {group.items.length} {t("memory.items")}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <details key={item.id} className="rounded-sm border border-border/70 bg-background/60 p-2">
                            <summary className="cursor-pointer">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">
                                  {new Date(item.createdAt).toLocaleString()} | {item.mode}
                                </div>
                                <div className="text-sm line-clamp-2">{item.summaryBrief}</div>
                              </div>
                            </summary>
                            <div className="mt-2 whitespace-pre-wrap rounded-sm border border-border/60 bg-background/80 p-2 text-xs">
                              {item.summaryDetail}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("memory.section.global")}
              </div>

              {loading ? (
                <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : dailyProfiles.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {t("memory.empty_global")}
                </div>
              ) : (
                <div className="space-y-3">
                  {dailyProfiles.map((profile) => (
                    <div key={profile.day} className="rounded-sm border border-border p-3 space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {profile.day} | {new Date(profile.createdAt).toLocaleString()}
                      </div>
                      <div className="whitespace-pre-wrap rounded-sm border border-border/60 bg-background/70 p-2 text-xs">
                        {profile.profileText}
                      </div>
                      <div className="whitespace-pre-wrap rounded-sm border border-border/60 bg-background/70 p-2 text-xs text-muted-foreground">
                        {profile.comparisonText}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {info && <div className="text-xs text-status-nominal">{info}</div>}
            {error && <div className="text-xs text-status-critical">{error}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
