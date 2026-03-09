import { useCallback, useEffect, useMemo, useState } from "react"
import { Brain, DatabaseZap, RefreshCw, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type {
  DailyProfile,
  MemoryEntity,
  MemoryEntityType,
  MemoryRangeSummary,
  MemorySearchResult,
  MemorySummary,
  WorkingMemorySnapshot
} from "@/types"

type MemoryTab = "working" | "timeline" | "entities" | "legacy"

interface ConversationMemoryGroup {
  threadId: string
  title: string
  items: MemorySummary[]
  latestAt: string
}

function groupSummaries(summaries: MemorySummary[]): ConversationMemoryGroup[] {
  const groups = new Map<string, ConversationMemoryGroup>()
  for (const item of summaries) {
    const existing = groups.get(item.threadId)
    if (!existing) {
      groups.set(item.threadId, {
        threadId: item.threadId,
        title: item.title?.trim() || `Thread ${item.threadId}`,
        items: [item],
        latestAt: item.createdAt
      })
      continue
    }
    existing.items.push(item)
    if (item.createdAt > existing.latestAt) existing.latestAt = item.createdAt
    if (!existing.title && item.title?.trim()) existing.title = item.title.trim()
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}

function groupEntities(entities: MemoryEntity[]): Array<{ type: MemoryEntityType; items: MemoryEntity[] }> {
  const orderedTypes: MemoryEntityType[] = [
    "fact",
    "preference",
    "habit",
    "interest",
    "tooling_pattern",
    "task_category"
  ]
  return orderedTypes
    .map((type) => ({
      type,
      items: entities.filter((entity) => entity.type === type)
    }))
    .filter((group) => group.items.length > 0)
}

export function MemoryManager(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<MemoryTab>("working")
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [workingSnapshot, setWorkingSnapshot] = useState<WorkingMemorySnapshot | null>(null)
  const [searchResult, setSearchResult] = useState<MemorySearchResult | null>(null)
  const [rangeSummary, setRangeSummary] = useState<MemoryRangeSummary | null>(null)
  const [summaries, setSummaries] = useState<MemorySummary[]>([])
  const [dailyProfiles, setDailyProfiles] = useState<DailyProfile[]>([])
  const [entities, setEntities] = useState<MemoryEntity[]>([])

  const loadData = useCallback(async (searchText = query) => {
    setLoading(true)
    setError(null)
    try {
      const [working, search, profileList, conversation, entityList, range] = await Promise.all([
        window.api.memory.getWorkingSnapshot(),
        window.api.memory.search(searchText || ""),
        window.api.memory.listDailyProfiles(180),
        window.api.memory.listConversationSummaries(500),
        window.api.memory.listEntities(undefined, { text: searchText || "", limit: 120 }),
        window.api.memory.getRangeSummary({ preset: "today" })
      ])
      setWorkingSnapshot(working)
      setSearchResult(search)
      setDailyProfiles(profileList)
      setSummaries(conversation)
      setEntities(entityList)
      setRangeSummary(range)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory data.")
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    if (!open) return
    void loadData()
  }, [open, loadData])

  const handleSearch = useCallback(async () => {
    await loadData(query)
  }, [loadData, query])

  const handleClearAll = useCallback(async () => {
    if (clearing) return
    if (!window.confirm("Clear all memory data?")) return
    setClearing(true)
    setError(null)
    try {
      await window.api.memory.clearAll()
      setInfo("All memory data cleared.")
      await loadData("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear memory.")
    } finally {
      setClearing(false)
    }
  }, [clearing, loadData])

  const handleRebuild = useCallback(async () => {
    if (rebuilding) return
    setRebuilding(true)
    setError(null)
    try {
      const rebuilt = await window.api.memory.rebuild()
      setWorkingSnapshot(rebuilt.workingSnapshot)
      setSearchResult(rebuilt.search)
      setInfo("Memory rebuilt from legacy data.")
      await loadData(query)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rebuild memory.")
    } finally {
      setRebuilding(false)
    }
  }, [loadData, query, rebuilding])

  const groupedSummaries = useMemo(() => groupSummaries(summaries), [summaries])
  const groupedEntities = useMemo(() => groupEntities(entities), [entities])

  const openButtonClass = cn(
    "h-8 w-8 rounded-lg border border-transparent",
    open
      ? "bg-background/70 text-foreground border-border/80"
      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
  )

  const renderWorking = (): React.JSX.Element => (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Working Memory Snapshot</div>
            <div className="text-sm text-muted-foreground">
              Updated: {workingSnapshot ? new Date(workingSnapshot.updatedAt).toLocaleString() : "N/A"}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void window.api.memory.clearWorkingSnapshot().then(setWorkingSnapshot)}>
            Reset Snapshot
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["Recent Overview", workingSnapshot?.recentOverview],
            ["Last 24h Messages", workingSnapshot?.last24hMessages],
            ["Habits", workingSnapshot?.habits],
            ["Preferences", workingSnapshot?.preferences],
            ["Facts", workingSnapshot?.facts],
            ["Open Loops", workingSnapshot?.openLoops],
            ["Tooling Learnings", workingSnapshot?.toolingLearnings],
            ["Recent Task Outcomes", workingSnapshot?.recentTaskOutcomes]
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border/70 bg-background/60 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm">{value || "none"}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Today Summary</div>
        <div className="mt-2 whitespace-pre-wrap text-sm">{rangeSummary?.summaryText || "No summary yet."}</div>
        {rangeSummary?.highlights?.length ? (
          <div className="mt-3 space-y-2">
            {rangeSummary.highlights.map((item, index) => (
              <div key={`${index}-${item}`} className="rounded-md border border-border/60 bg-background/50 p-2 text-xs">
                {item}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )

  const renderTimeline = (): React.JSX.Element => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border border-border bg-muted/30 pl-10 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search memory events, facts, tasks..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSearch()
            }}
          />
        </div>
        <Button size="sm" onClick={() => void handleSearch()} disabled={loading}>
          Search
        </Button>
      </div>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Timeline / Search Result</div>
        {(searchResult?.events || []).length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No events found.
          </div>
        ) : (
          searchResult?.events.map((event) => (
            <details key={event.id} className="rounded-md border border-border/70 bg-background/60 p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {event.category} / {event.sourceType}
                    </div>
                    <div className="mt-1 text-sm font-medium">{event.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{event.summary}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</div>
                </div>
              </summary>
              <div className="mt-3 space-y-2">
                <div className="whitespace-pre-wrap rounded-md border border-border/60 bg-background/70 p-2 text-xs">
                  {event.detail}
                </div>
                {event.keywords.length > 0 ? (
                  <div className="text-[11px] text-muted-foreground">keywords: {event.keywords.join(", ")}</div>
                ) : null}
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  )

  const renderEntities = (): React.JSX.Element => (
    <div className="space-y-4">
      {groupedEntities.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          No facts or preferences extracted yet.
        </div>
      ) : (
        groupedEntities.map((group) => (
          <section key={group.type} className="rounded-lg border border-border p-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{group.type}</div>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map((entity) => (
                <div key={entity.id} className="rounded-md border border-border/70 bg-background/60 p-3">
                  <div className="text-sm font-medium">{entity.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {entity.name} | confidence {entity.confidence.toFixed(2)} | evidence {entity.evidenceCount}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    first {new Date(entity.firstSeenAt).toLocaleString()} / last {new Date(entity.lastSeenAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )

  const renderLegacy = (): React.JSX.Element => (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Legacy Conversation Summaries</div>
        {groupedSummaries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No legacy conversation summaries.
          </div>
        ) : (
          groupedSummaries.map((group) => (
            <div key={group.threadId} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{group.title}</div>
                  <div className="text-[10px] text-muted-foreground break-all">{group.threadId}</div>
                </div>
                <div className="text-[10px] text-muted-foreground">{group.items.length} items</div>
              </div>
              {group.items.map((item) => (
                <details key={item.id} className="rounded-md border border-border/70 bg-background/60 p-2">
                  <summary className="cursor-pointer">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()} | {item.mode}
                      </div>
                      <div className="text-sm line-clamp-2">{item.summaryBrief}</div>
                    </div>
                  </summary>
                  <div className="mt-2 whitespace-pre-wrap rounded-md border border-border/60 bg-background/80 p-2 text-xs">
                    {item.summaryDetail}
                  </div>
                </details>
              ))}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Legacy Daily Profiles</div>
        {dailyProfiles.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No daily profiles.
          </div>
        ) : (
          dailyProfiles.map((profile) => (
            <div key={profile.day} className="rounded-lg border border-border p-3 space-y-2">
              <div className="text-xs text-muted-foreground">
                {profile.day} | {new Date(profile.createdAt).toLocaleString()}
              </div>
              <div className="whitespace-pre-wrap rounded-md border border-border/60 bg-background/70 p-2 text-xs">
                {profile.profileText}
              </div>
              <div className="whitespace-pre-wrap rounded-md border border-border/60 bg-background/70 p-2 text-xs text-muted-foreground">
                {profile.comparisonText}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )

  const tabs: Array<{ id: MemoryTab; label: string }> = [
    { id: "working", label: "Working" },
    { id: "timeline", label: "Timeline" },
    { id: "entities", label: "Facts" },
    { id: "legacy", label: "Legacy" }
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={openButtonClass}
        title="Memory"
        aria-label="Memory"
        onClick={() => setOpen(true)}
      >
        <Brain className="size-4" />
      </Button>

      <DialogContent className="w-[1120px] h-[760px] max-w-[96vw] max-h-[92vh] p-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Butler Memory
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex items-center gap-1.5 border-b border-border px-6 py-3">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={cn("h-8 text-[13px]", activeTab === tab.id && "bg-secondary")}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {error ? (
              <div className="mb-4 rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-sm text-status-critical">
                {error}
              </div>
            ) : null}
            {info ? <div className="mb-4 text-xs text-status-nominal">{info}</div> : null}
            {loading ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : activeTab === "working" ? (
              renderWorking()
            ) : activeTab === "timeline" ? (
              renderTimeline()
            ) : activeTab === "entities" ? (
              renderEntities()
            ) : (
              renderLegacy()
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading || clearing || rebuilding}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleRebuild()}
              disabled={loading || clearing || rebuilding}
            >
              <DatabaseZap className={cn("size-3.5", rebuilding && "animate-pulse")} />
              Rebuild
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleClearAll()}
              disabled={loading || clearing || rebuilding}
            >
              <Trash2 className="size-3.5" />
              {clearing ? "Clearing..." : "Clear All"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
