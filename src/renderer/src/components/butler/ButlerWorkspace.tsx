import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAppStore } from "@/lib/store"
import { ButlerTaskBoard } from "./ButlerTaskBoard"
import { ButlerMonitorBoard } from "./ButlerMonitorBoard"
import { DigestTaskCards } from "@/components/notifications/DigestTaskCards"
import type {
  AppSettings,
  ButlerDigestPayload,
  ButlerState,
  ButlerTask,
  TaskCompletionNotice
} from "@/types"

const TASK_NOTICE_MARKER = "[TASK_NOTICE_JSON]"
const TASK_DIGEST_MARKER = "[TASK_DIGEST_JSON]"

function toStatusVariant(
  status: ButlerTask["status"]
): "outline" | "info" | "nominal" | "critical" {
  if (status === "running") return "info"
  if (status === "completed") return "nominal"
  if (status === "failed" || status === "cancelled") return "critical"
  return "outline"
}

function isSettledTask(task: ButlerTask): boolean {
  return task.status === "completed" || task.status === "failed" || task.status === "cancelled"
}

interface ButlerNoticeCard {
  threadId: string
  title: string
  status: ButlerTask["status"]
  resultBrief: string
  resultDetail: string
  completedAt: string
}

function resolveTaskDetail(card: ButlerNoticeCard): string {
  const detail = card.resultDetail?.trim()
  if (detail) return detail
  const brief = card.resultBrief?.trim()
  if (brief) return brief
  return "暂无任务结果内容。"
}

function isTaskCompletionNotice(value: unknown): value is TaskCompletionNotice {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.threadId === "string" &&
    typeof record.title === "string" &&
    typeof record.resultBrief === "string" &&
    typeof record.resultDetail === "string" &&
    typeof record.completedAt === "string" &&
    typeof record.mode === "string" &&
    typeof record.source === "string"
  )
}

function isDigestPayload(value: unknown): value is ButlerDigestPayload {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  if (
    typeof record.id !== "string" ||
    typeof record.windowStart !== "string" ||
    typeof record.windowEnd !== "string" ||
    typeof record.summaryText !== "string" ||
    !Array.isArray(record.tasks)
  ) {
    return false
  }
  return record.tasks.every((task) => {
    if (!task || typeof task !== "object") return false
    const item = task as Record<string, unknown>
    return (
      typeof item.taskIdentity === "string" &&
      typeof item.threadId === "string" &&
      typeof item.title === "string" &&
      typeof item.status === "string" &&
      typeof item.mode === "string" &&
      typeof item.source === "string" &&
      typeof item.updatedAt === "string" &&
      typeof item.resultBrief === "string"
    )
  })
}

function extractNoticeSnapshot(text: string, marker: string): TaskCompletionNotice | null {
  const markerIndex = text.lastIndexOf(marker)
  if (markerIndex < 0) return null

  const jsonText = text.slice(markerIndex + marker.length).trim()
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as unknown
    return isTaskCompletionNotice(parsed) ? parsed : null
  } catch {
    return null
  }
}

function stripNoticeSnapshot(text: string, marker: string): string {
  const markerIndex = text.lastIndexOf(marker)
  if (markerIndex < 0) return text
  return text.slice(0, markerIndex).trimEnd()
}

function inferSnapshotStatus(notice: TaskCompletionNotice): ButlerTask["status"] {
  const normalized = `${notice.resultBrief}\n${notice.resultDetail}`.toLowerCase()
  return normalized.includes("任务失败") || normalized.includes("错误:") ? "failed" : "completed"
}

function isDigestNotice(notice: TaskCompletionNotice | null): notice is TaskCompletionNotice & {
  noticeType: "digest"
  digest: ButlerDigestPayload
} {
  return (
    !!notice &&
    notice.noticeType === "digest" &&
    isDigestPayload((notice as { digest?: unknown }).digest)
  )
}

function extractNoticeThreadId(text: string): string | null {
  const match = text.match(/线程:\s*([^\r\n]+)/)
  if (!match?.[1]) return null
  const threadId = match[1].trim()
  return threadId.length > 0 ? threadId : null
}

function findTaskForNotice(
  round: ButlerState["recentRounds"][number],
  tasks: ButlerTask[]
): ButlerTask | null {
  const threadId = extractNoticeThreadId(round.assistant)
  if (!threadId) return null

  const settled = tasks
    .filter((task) => isSettledTask(task) && task.threadId === threadId)
    .sort((a, b) => {
      const aTs = a.completedAt || a.createdAt
      const bTs = b.completedAt || b.createdAt
      return bTs.localeCompare(aTs)
    })
  if (settled.length === 0) return null

  const noticeTs = round.ts
  const beforeOrEqual = settled.find((task) => {
    const taskTs = task.completedAt || task.createdAt
    return taskTs <= noticeTs
  })

  return beforeOrEqual || settled[0]
}

function mapTaskToNoticeCard(task: ButlerTask): ButlerNoticeCard {
  return {
    threadId: task.threadId,
    title: task.title,
    status: task.status,
    resultBrief: task.resultBrief || "任务已结束。",
    resultDetail: task.resultDetail || task.resultBrief || "暂无任务结果内容。",
    completedAt: task.completedAt || task.createdAt
  }
}

function resolveNoticeCard(
  round: ButlerState["recentRounds"][number],
  assistantText: string,
  tasks: ButlerTask[],
  snapshot: TaskCompletionNotice | null
): ButlerNoticeCard | null {
  if (snapshot) {
    const matchedTask = tasks
      .filter((task) => isSettledTask(task) && task.threadId === snapshot.threadId)
      .sort((a, b) => {
        const aTs = a.completedAt || a.createdAt
        const bTs = b.completedAt || b.createdAt
        return bTs.localeCompare(aTs)
      })[0]

    return {
      threadId: snapshot.threadId,
      title: snapshot.title || matchedTask?.title || "任务已结束",
      status: matchedTask?.status || inferSnapshotStatus(snapshot),
      resultBrief: snapshot.resultBrief || matchedTask?.resultBrief || "任务已结束。",
      resultDetail:
        snapshot.resultDetail ||
        matchedTask?.resultDetail ||
        snapshot.resultBrief ||
        "暂无任务结果内容。",
      completedAt:
        snapshot.completedAt || matchedTask?.completedAt || matchedTask?.createdAt || round.ts
    }
  }

  const fallback = findTaskForNotice({ ...round, assistant: assistantText }, tasks)
  return fallback ? mapTaskToNoticeCard(fallback) : null
}

export function ButlerWorkspace(): React.JSX.Element {
  const setAppMode = useAppStore((state) => state.setAppMode)
  const [state, setState] = useState<ButlerState | null>(null)
  const [tasks, setTasks] = useState<ButlerTask[]>([])
  const [butlerAvatarDataUrl, setButlerAvatarDataUrl] = useState("")
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [clearingTasks, setClearingTasks] = useState(false)
  const [rightTab, setRightTab] = useState<"tasks" | "monitor">("tasks")
  const [mutedTaskIdentities, setMutedTaskIdentities] = useState<Set<string>>(new Set())
  const [digestPreset, setDigestPreset] = useState<"0" | "1" | "5" | "60" | "custom">("1")
  const [digestCustomValue, setDigestCustomValue] = useState("1")
  const [savingDigestInterval, setSavingDigestInterval] = useState(false)

  const loadButlerSettings = useCallback(async (): Promise<void> => {
    try {
      const settings = (await window.api.settings.get()) as AppSettings
      setButlerAvatarDataUrl(settings.butler?.avatarDataUrl || "")
      const interval = settings.butler?.serviceDigestIntervalMin ?? 1
      if (interval === 0 || interval === 1 || interval === 5 || interval === 60) {
        setDigestPreset(String(interval) as "0" | "1" | "5" | "60")
      } else {
        setDigestPreset("custom")
      }
      setDigestCustomValue(String(interval <= 0 ? 1 : interval))
    } catch (error) {
      console.error("[Butler] failed to load settings:", error)
    }
  }, [])

  const loadMutedTaskIdentities = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.notifications.listMutedTasks()
      setMutedTaskIdentities(new Set(list.map((item) => item.trim()).filter(Boolean)))
    } catch (error) {
      console.error("[Butler] failed to load muted task identities:", error)
    }
  }, [])

  const load = useCallback(async () => {
    const [nextState, nextTasks] = await Promise.all([
      window.api.butler.getState(),
      window.api.butler.listTasks()
    ])
    setState(nextState)
    setTasks(nextTasks)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadButlerSettings()
    void loadMutedTaskIdentities()
    const handleSettingsUpdated = (): void => {
      void loadButlerSettings()
      void loadMutedTaskIdentities()
    }
    window.addEventListener("openwork:settings-updated", handleSettingsUpdated)
    return () => {
      window.removeEventListener("openwork:settings-updated", handleSettingsUpdated)
    }
  }, [loadButlerSettings, loadMutedTaskIdentities])

  useEffect(() => {
    const cleanups: Array<() => void> = []
    cleanups.push(
      window.api.butler.onTaskUpdate((nextTasks) => {
        setTasks(nextTasks)
      })
    )
    cleanups.push(
      window.electron.ipcRenderer.on("butler:state-changed", (...args: unknown[]) => {
        const nextState = args[0] as ButlerState
        setState(nextState)
      })
    )
    cleanups.push(
      window.api.butler.onTaskCompleted(() => {
        void load()
      })
    )
    return () => {
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [load])

  const rounds = state?.recentRounds || []
  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending])
  const pendingChoice = state?.pendingDispatchChoice
  const hasPendingDispatchChoice = pendingChoice?.awaiting === true
  const pendingChoiceHint = pendingChoice?.hint || "当前有待确认的任务编排方案。"

  const openTaskThread = useCallback(
    async (threadId: string): Promise<void> => {
      const normalized = threadId.trim()
      if (!normalized) return
      setAppMode("classic")
      await useAppStore.getState().selectThread(normalized)
    },
    [setAppMode]
  )

  const muteTaskIdentity = useCallback(async (taskIdentity: string): Promise<void> => {
    const normalized = taskIdentity.trim()
    if (!normalized) return
    await window.api.notifications.muteTask(normalized)
    setMutedTaskIdentities((prev) => new Set([...prev, normalized]))
  }, [])

  const handleSaveDigestInterval = useCallback(async (): Promise<void> => {
    if (savingDigestInterval) return
    const value =
      digestPreset === "custom" ? Number.parseInt(digestCustomValue, 10) : Number.parseInt(digestPreset, 10)
    const normalized = Number.isFinite(value) ? value : 1
    const finalValue = digestPreset === "0" ? 0 : Math.max(1, normalized)

    setSavingDigestInterval(true)
    try {
      const currentSettings = (await window.api.settings.get()) as AppSettings
      await window.api.settings.update({
        updates: {
          butler: {
            ...currentSettings.butler,
            serviceDigestIntervalMin: finalValue
          }
        }
      })
      window.dispatchEvent(new CustomEvent("openwork:settings-updated"))
    } finally {
      setSavingDigestInterval(false)
    }
  }, [digestCustomValue, digestPreset, savingDigestInterval])

  const handleSend = (): void => {
    const message = input.trim()
    if (!message || sending) return
    setInput("")
    setSending(true)

    window.api.butler
      .send(message)
      .then((nextState) => {
        setState(nextState)
        return window.api.butler.listTasks()
      })
      .then((nextTasks) => {
        setTasks(nextTasks)
      })
      .catch((error: unknown) => {
        console.error("[Butler] send failed:", error)
      })
      .finally(() => {
        setSending(false)
      })
  }

  const handleClearHistory = async (): Promise<void> => {
    if (clearingHistory) return
    const confirmed = window.confirm("确认清空聊天记录吗？")
    if (!confirmed) return

    setClearingHistory(true)
    try {
      const nextState = await window.api.butler.clearHistory()
      setState(nextState)
    } finally {
      setClearingHistory(false)
    }
  }

  const handleClearTasks = async (): Promise<void> => {
    if (clearingTasks) return
    const confirmed = window.confirm("确认清空任务列表吗？运行中的任务不会被清理。")
    if (!confirmed) return

    setClearingTasks(true)
    try {
      const nextTasks = await window.api.butler.clearTasks()
      setTasks(nextTasks)
    } finally {
      setClearingTasks(false)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="h-12 px-5 border-b border-border/40 flex items-center justify-between glass-panel">
          <span className="text-xs text-accent uppercase tracking-[0.2em] font-bold neon-text">
            Butler AI
          </span>
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-muted-foreground">服务频率</div>
            <select
              value={digestPreset}
              onChange={(event) =>
                setDigestPreset(event.target.value as "0" | "1" | "5" | "60" | "custom")
              }
              className="h-7 rounded-lg border border-border bg-background/50 px-2 text-[11px]"
            >
              <option value="0">实时</option>
              <option value="1">每1分钟</option>
              <option value="5">每5分钟</option>
              <option value="60">每60分钟</option>
              <option value="custom">自定义</option>
            </select>
            {digestPreset === "custom" ? (
              <input
                type="number"
                min={1}
                value={digestCustomValue}
                onChange={(event) => setDigestCustomValue(event.target.value)}
                className="h-7 w-20 rounded-lg border border-border bg-background/50 px-2 text-[11px]"
              />
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              disabled={savingDigestInterval}
              onClick={() => void handleSaveDigestInterval()}
              className="h-7 px-3 text-xs rounded-lg"
            >
              {savingDigestInterval ? "保存中..." : "保存频率"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={clearingHistory}
              onClick={() => void handleClearHistory()}
              className="h-7 px-3 text-xs rounded-lg"
            >
              {clearingHistory ? "清空中..." : "清空聊天"}
            </Button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 tech-gradient">
          {hasPendingDispatchChoice && (
            <div className="text-xs rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-[0_0_16px_rgba(245,158,11,0.1)]">
              {pendingChoiceHint}
            </div>
          )}
          {rounds.length === 0 && (
            <div className="text-sm text-muted-foreground rounded-2xl border border-border/40 p-8 text-center glass-panel">
              <div className="text-accent/60 text-2xl mb-3">&#9672;</div>
              暂无对话，输入你的任务需求后，管家会自动路由。
            </div>
          )}
          {rounds.map((round) => {
            const isSystemNotice = round.user === "[系统通知]"
            const digestSnapshot = isSystemNotice
              ? extractNoticeSnapshot(round.assistant, TASK_DIGEST_MARKER)
              : null
            const taskSnapshot = isSystemNotice
              ? extractNoticeSnapshot(round.assistant, TASK_NOTICE_MARKER)
              : null
            const digestNotice = isDigestNotice(digestSnapshot) ? digestSnapshot : null
            const assistantText = isSystemNotice
              ? stripNoticeSnapshot(
                  stripNoticeSnapshot(round.assistant, TASK_DIGEST_MARKER),
                  TASK_NOTICE_MARKER
                )
              : round.assistant
            const hasAssistantContent = assistantText.trim().length > 0
            const noticeCard = isSystemNotice
              ? resolveNoticeCard(round, assistantText, tasks, taskSnapshot)
              : null
            const digestTasks = (digestNotice?.digest.tasks || []).filter(
              (task) => !mutedTaskIdentities.has(task.taskIdentity)
            )
            const taskSnapshotIdentity = taskSnapshot?.taskIdentity?.trim() || ""
            return (
              <div key={round.id} className="space-y-4">
                {!isSystemNotice && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-accent/20 bg-accent/8 p-4 text-sm whitespace-pre-wrap shadow-sm">
                      {round.user}
                    </div>
                  </div>
                )}

                {(isSystemNotice || hasAssistantContent) && (
                  <div className="flex items-start justify-start gap-3">
                    {butlerAvatarDataUrl ? (
                      <img
                        src={butlerAvatarDataUrl}
                        alt="Butler avatar"
                        className="mt-1 size-8 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                        B
                      </div>
                    )}
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border/40 bg-card/60 backdrop-blur-sm p-4 shadow-sm">
                      <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-accent/70 font-bold">
                        {isSystemNotice ? "系统通知" : "管家"}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {assistantText || "处理中..."}
                      </div>
                    </div>
                  </div>
                )}

                {isSystemNotice && digestNotice ? (
                  <div className="flex justify-start">
                    <details className="w-[85%] rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 glow-border">
                      <summary className="cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium" title={digestNotice.title}>
                              {digestNotice.title}
                            </div>
                            <div className="mt-1 max-h-16 overflow-hidden whitespace-pre-wrap text-xs text-muted-foreground">
                              {digestNotice.digest.summaryText}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {new Date(digestNotice.completedAt).toLocaleString()}
                            </div>
                          </div>
                          <Badge variant="info">{digestTasks.length} tasks</Badge>
                        </div>
                      </summary>
                      {digestTasks.length > 0 ? (
                        <DigestTaskCards
                          tasks={digestTasks}
                          onOpenThread={(threadId) => {
                            void openTaskThread(threadId)
                          }}
                          onMuteTask={(taskIdentity) => {
                            void muteTaskIdentity(taskIdentity)
                          }}
                        />
                      ) : (
                        <div className="mt-3 text-xs text-muted-foreground">当前汇总任务均已静默。</div>
                      )}
                    </details>
                  </div>
                ) : null}

                {isSystemNotice && !digestNotice && noticeCard && (
                  <div className="flex justify-start">
                    <details className="w-[85%] rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 glow-border">
                      <summary className="cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium" title={noticeCard.title}>
                              {noticeCard.title}
                            </div>
                            <div className="mt-1 max-h-12 overflow-hidden whitespace-pre-wrap text-xs text-muted-foreground">
                              {noticeCard.resultBrief || "任务已结束。"}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {new Date(noticeCard.completedAt).toLocaleString()}
                            </div>
                          </div>
                          <Badge variant={toStatusVariant(noticeCard.status)}>
                            {noticeCard.status}
                          </Badge>
                        </div>
                      </summary>
                      <div className="mt-3 space-y-2">
                        <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-background/50 backdrop-blur-sm p-3 text-xs">
                          {resolveTaskDetail(noticeCard)}
                        </div>
                        <div className="flex justify-end">
                          {taskSnapshotIdentity ? (
                            <button
                              type="button"
                              onClick={() => {
                                void muteTaskIdentity(taskSnapshotIdentity)
                              }}
                              className="mr-3 text-xs text-muted-foreground hover:text-foreground"
                            >
                              不再提示
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={!noticeCard.threadId}
                            onClick={() => {
                              if (!noticeCard.threadId) return
                              void openTaskThread(noticeCard.threadId)
                            }}
                            className="text-xs text-accent hover:text-accent/80 hover:neon-text disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-200"
                          >
                            查看线程
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="border-t border-border/40 p-5 flex items-center gap-3 glass-panel">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void handleSend()
              }
            }}
            placeholder="给管家输入需求..."
            className="min-h-[52px] max-h-[200px] flex-1 resize-y rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-300 focus:outline-none cyber-input"
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="h-[52px] px-8 rounded-xl text-sm"
          >
            {sending ? "处理中..." : "发送"}
          </Button>
        </div>
      </section>

      <div className="w-[2px] shrink-0 gradient-divider-vertical" />

      <aside className="flex h-full min-h-0 w-[400px] shrink-0 flex-col">
        <header className="h-12 shrink-0 px-5 border-b border-border/40 flex items-center justify-between gap-3 glass-panel">
          <select
            value={rightTab}
            onChange={(event) => setRightTab(event.target.value as "tasks" | "monitor")}
            className="h-8 min-w-[130px] rounded-lg border border-border bg-background/50 backdrop-blur-sm px-3 text-xs font-semibold cursor-pointer transition-all duration-200 hover:border-accent/40 focus:outline-none cyber-input"
          >
            <option value="tasks">执行任务</option>
            <option value="monitor">监听任务</option>
          </select>

          {rightTab === "tasks" ? (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-accent/70 font-bold tracking-wider">
                {tasks.filter((task) => task.status === "running").length} Running
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={clearingTasks}
                onClick={() => void handleClearTasks()}
                className="h-7 px-3 text-xs rounded-lg"
              >
                {clearingTasks ? "清空中..." : "清空任务"}
              </Button>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">监听规则与事件状态</span>
          )}
        </header>
        <div className="flex-1 min-h-0">
          {rightTab === "tasks" ? (
            <ButlerTaskBoard
              tasks={tasks}
              onOpenThread={(threadId) => void openTaskThread(threadId)}
            />
          ) : (
            <ButlerMonitorBoard />
          )}
        </div>
      </aside>
    </div>
  )
}
