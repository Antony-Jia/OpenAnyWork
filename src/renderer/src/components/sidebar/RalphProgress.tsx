import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronRight, RefreshCw, FileText, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/i18n"
import { useAppStore } from "@/lib/store"
import { useThreadState } from "@/lib/thread-context"
import { cn } from "@/lib/utils"
import type { RalphState, ThreadMode, RalphLogEntry } from "@/types"

interface RalphPlan {
  project?: string
  branchName?: string
  description?: string
  userStories?: Array<{
    id: string
    title: string
    description?: string
    acceptanceCriteria?: string[]
    priority?: number
    passes?: boolean
    notes?: string
  }>
}

interface ProgressSection {
  title: string
  content: string[]
}

function parseProgress(content: string): ProgressSection[] {
  const sections: ProgressSection[] = []
  const lines = content.split("\n")
  let currentSection: ProgressSection | null = null

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = { title: line.slice(3).trim(), content: [] }
    } else if (currentSection && line.trim() && line !== "---") {
      currentSection.content.push(line)
    }
  }

  if (currentSection) {
    sections.push(currentSection)
  }

  return sections.reverse() // Show newest first
}

export function RalphProgress(): React.JSX.Element | null {
  const { t } = useLanguage()
  const { threads, currentThreadId } = useAppStore()
  const threadState = useThreadState(currentThreadId)

  const [planExpanded, setPlanExpanded] = useState(true)
  const [progressExpanded, setProgressExpanded] = useState(true)
  const [logExpanded, setLogExpanded] = useState(true)
  const [plan, setPlan] = useState<RalphPlan | null>(null)
  const [progress, setProgress] = useState<ProgressSection[]>([])
  const [loading, setLoading] = useState(false)

  const currentThread = threads.find((t) => t.thread_id === currentThreadId)
  const mode = (currentThread?.metadata?.mode as ThreadMode) || "default"
  const ralph = (currentThread?.metadata?.ralph as RalphState) || null
  const ralphLog = threadState?.ralphLog ?? []
  const subagents = threadState?.subagents ?? []

  const loadRalphData = useCallback(async () => {
    if (!currentThreadId || mode !== "ralph") return
    setLoading(true)
    try {
      // Load ralph_plan.json
      const planResult = await window.api.workspace.readFile(currentThreadId, "ralph_plan.json")
      if (planResult.success && planResult.content) {
        try {
          setPlan(JSON.parse(planResult.content) as RalphPlan)
        } catch {
          setPlan(null)
        }
      } else {
        setPlan(null)
      }

      // Load progress.txt
      const progressResult = await window.api.workspace.readFile(currentThreadId, "progress.txt")
      if (progressResult.success && progressResult.content) {
        setProgress(parseProgress(progressResult.content))
      } else {
        setProgress([])
      }
    } catch (error) {
      console.error("[RalphProgress] Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }, [currentThreadId, mode])

  useEffect(() => {
    void loadRalphData()
  }, [loadRalphData])

  // Don't render if not in ralph mode
  if (mode !== "ralph") {
    return null
  }

  const phaseLabel = ralph?.phase
    ? {
        init: t("ralph.phase.init"),
        awaiting_confirm: t("ralph.phase.awaiting_confirm"),
        running: t("ralph.phase.running"),
        verifying: t("ralph.phase.verifying"),
        replanning: t("ralph.phase.replanning"),
        awaiting_continue: t("ralph.phase.awaiting_continue"),
        done: t("ralph.phase.done")
      }[ralph.phase] || ralph.phase
    : "-"

  const activeSubagent = subagents.find((agent) => agent.status === "running") || null
  const activeToolCallId = activeSubagent?.toolCallId
  const filteredLog = activeToolCallId
    ? ralphLog.filter((entry) => entry.toolCallId === activeToolCallId)
    : ralphLog
  const visibleLog = filteredLog.slice(-50).reverse()

  const renderLogEntry = (entry: RalphLogEntry): React.JSX.Element => {
    const timestamp = entry.ts ? new Date(entry.ts) : null
    const timeLabel = timestamp ? timestamp.toLocaleTimeString() : ""
    const dateLabel = timestamp
      ? timestamp.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : ""

    const getBadgeVariant = (): "info" | "nominal" | "warning" | "secondary" => {
      if (entry.role === "tool_call") return "info"
      if (entry.role === "tool") return "nominal"
      if (entry.role === "user") return "warning"
      return "secondary"
    }

    const getActionLabel = (): string => {
      if (entry.role === "tool_call") return entry.toolName || "tool"
      if (entry.role === "tool") return entry.toolName || "result"
      if (entry.role === "user") return "user"
      return "assistant"
    }

    return (
      <Card
        key={entry.id}
        className="p-2 bg-card/50 hover:bg-card/80 transition-colors border-border/50"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant={getBadgeVariant()} className="text-[9px] px-1.5 py-0">
            {getActionLabel()}
          </Badge>
          <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">
            {dateLabel} {timeLabel}
          </span>
        </div>
        {entry.content && (
          <div className="text-[11px] text-foreground/80 line-clamp-3 break-words leading-relaxed">
            {entry.content}
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="bg-sidebar h-full flex flex-col">
      {/* Iteration & Phase Info */}
      <div className="rounded-md bg-emerald-50/50 dark:bg-emerald-950/30 p-2 mx-2 mb-2 text-xs space-y-1 shrink-0">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("ralph.progress.iteration")}</span>
          <span className="font-medium">{ralph?.iterations ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("ralph.progress.phase")}</span>
          <span className="font-medium">{phaseLabel}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-5"
          onClick={() => loadRalphData()}
          disabled={loading}
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
        </Button>
      </div>

      <div className="px-2 pb-2 flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
        {/* Plan Section */}
        {plan && (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setPlanExpanded(!planExpanded)}
            >
              {planExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              <ListChecks className="size-3" />
              <span>ralph_plan.json</span>
            </button>

            {planExpanded && (
              <div className="ml-4 mt-1 space-y-1.5 text-xs">
                {plan.project && (
                  <div>
                    <span className="text-muted-foreground">{t("ralph.plan.project")}: </span>
                    <span className="font-medium">{plan.project}</span>
                  </div>
                )}
                {plan.description && (
                  <div className="text-muted-foreground text-[10px]">{plan.description}</div>
                )}
                {plan.userStories && plan.userStories.length > 0 && (
                  <div className="space-y-1 mt-2">
                    <div className="text-muted-foreground font-medium">
                      {t("ralph.plan.stories")} ({plan.userStories.length})
                    </div>
                    {plan.userStories.map((story) => (
                      <div
                        key={story.id}
                        className={cn(
                          "rounded px-1.5 py-1 border-l-2",
                          story.passes
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                            : "border-muted bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{story.id}</span>
                          <span className="truncate">{story.title}</span>
                          {story.passes && (
                            <span className="ml-auto text-emerald-600 dark:text-emerald-400">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress Section */}
        {progress.length > 0 && (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setProgressExpanded(!progressExpanded)}
            >
              {progressExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              <FileText className="size-3" />
              <span>progress.txt</span>
              <span className="ml-1 text-[10px]">({progress.length})</span>
            </button>

            {progressExpanded && (
              <div className="ml-4 mt-1 space-y-2 text-xs">
                {progress.slice(0, 5).map((section, idx) => (
                  <div key={idx} className="rounded bg-muted/30 p-1.5">
                    <div className="font-medium text-[10px] text-muted-foreground truncate">
                      {section.title}
                    </div>
                    <div className="mt-0.5 text-[10px] line-clamp-3">
                      {section.content.slice(0, 3).map((line, lineIdx) => (
                        <div key={lineIdx} className="truncate">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {progress.length > 5 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{progress.length - 5} {t("ralph.progress.more")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Checkpoint Log */}
        <div>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setLogExpanded(!logExpanded)}
          >
            {logExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <FileText className="size-3" />
            <span>{t("ralph.log.title")}</span>
            {visibleLog.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                {visibleLog.length}
              </Badge>
            )}
          </button>

          {logExpanded && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-[10px] text-muted-foreground">
                  {activeSubagent
                    ? `${t("ralph.log.active_agent")}: ${activeSubagent.name}`
                    : t("ralph.log.all_agents")}
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              {visibleLog.length > 0 ? (
                <div className="space-y-2">{visibleLog.map((entry) => renderLogEntry(entry))}</div>
              ) : (
                <Card className="p-4 text-center">
                  <div className="text-xs text-muted-foreground">{t("ralph.log.empty")}</div>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Empty state */}
        {!plan && progress.length === 0 && !loading && (
          <div className="text-xs text-muted-foreground text-center py-2">
            {t("ralph.progress.empty")}
          </div>
        )}
      </div>
    </div>
  )
}
