import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { useAppStore } from "@/lib/store"
import { ButlerTaskBoard } from "./ButlerTaskBoard"
import { ButlerMonitorBoard } from "./ButlerMonitorBoard"
import { DigestTaskCards } from "@/components/notifications/DigestTaskCards"
import { StreamingMarkdown } from "@/components/chat/StreamingMarkdown"
import type {
  AppSettings,
  ButlerDigestPayload,
  ButlerState,
  ButlerTask,
  QQExternalSourceInfo,
  TaskCompletionNotice,
  TaskLifecycleNotice
} from "@/types"

const TASK_NOTICE_MARKER = "[TASK_NOTICE_JSON]"
const TASK_DIGEST_MARKER = "[TASK_DIGEST_JSON]"
type DigestDetailTab = "overview" | "tasks"

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

type TaskNoticeSnapshot = TaskCompletionNotice | TaskLifecycleNotice

function resolveTaskDetail(card: ButlerNoticeCard): string {
  const detail = card.resultDetail?.trim()
  if (detail) return detail
  const brief = card.resultBrief?.trim()
  if (brief) return brief
  return "暂无任务结果内容。"
}

interface DispatchSummary {
  taskGroup: string | null
  createdCount: number | null
  taskLines: string[]
}

interface DispatchDetailField {
  label: string
  value: string
}

interface DispatchStructuredPayload {
  title: string
  detailFields: DispatchDetailField[]
  queryItems: string[]
  outputItems: string[]
  progressLines: string[]
  capabilityLine: string
  summary: DispatchSummary
}

function parseDispatchSummary(text: string): DispatchSummary {
  const normalized = text.trim()
  if (!normalized) {
    return { taskGroup: null, createdCount: null, taskLines: [] }
  }

  const groupMatch = normalized.match(/任务组:\s*([^\r\n]+)/)
  const countMatch = normalized.match(/共创建\s*(\d+)\s*个任务/)
  const taskLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))

  return {
    taskGroup: groupMatch?.[1]?.trim() || null,
    createdCount: countMatch?.[1] ? Number.parseInt(countMatch[1], 10) : null,
    taskLines
  }
}

function parseDispatchStructuredPayload(text: string): DispatchStructuredPayload | null {
  const normalized = text.trim()
  if (!normalized) return null

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) return null

  const looksLikeDispatch =
    lines.some((line) => line.includes("已成功创建查询任务")) ||
    lines.some((line) => line.includes("任务详情")) ||
    lines.some((line) => line.includes("查询内容"))
  if (!looksLikeDispatch) return null

  let section: "none" | "details" | "query" | "output" = "none"
  let title = "已成功创建查询任务"
  const detailFields: DispatchDetailField[] = []
  const queryItems: string[] = []
  const outputItems: string[] = []
  const progressLines: string[] = []
  let capabilityLine = ""
  const summarySeedLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.replace(/\*\*/g, "").trim()
    if (!line) continue

    if (/^✅?\s*已成功创建.*任务/.test(line)) {
      title = line.replace(/^✅\s*/, "").trim()
      continue
    }
    if (/^任务详情[：:]?$/.test(line)) {
      section = "details"
      continue
    }
    if (/^查询内容[：:]?$/.test(line)) {
      section = "query"
      continue
    }
    if (/^输出格式[：:]?$/.test(line) && !line.startsWith("-")) {
      section = "output"
      continue
    }

    if (
      /^任务组[：:]/.test(line) ||
      /^共创建\s*\d+\s*个任务/.test(line) ||
      /^\d+\.\s+\[/.test(line)
    ) {
      summarySeedLines.push(line)
      section = "none"
      continue
    }

    if (line.startsWith("能力目录已同步")) {
      capabilityLine = line
      section = "none"
      continue
    }

    if (/任务已启动|正在为您|将同时覆盖|提供客观准确/.test(line)) {
      progressLines.push(line)
      section = "none"
      continue
    }

    if (section === "details" && line.startsWith("-")) {
      const detail = line.replace(/^-\s*/, "").trim()
      const kv = detail.match(/^([^：:]+)[：:]\s*(.+)$/)
      if (kv) {
        detailFields.push({
          label: kv[1].trim(),
          value: kv[2].trim()
        })
      } else {
        detailFields.push({ label: "说明", value: detail })
      }
      continue
    }

    if (section === "query") {
      const item = line.replace(/^\d+\.\s*/, "").trim()
      if (item) queryItems.push(item)
      continue
    }

    if (section === "output" && line.startsWith("-")) {
      const item = line.replace(/^-\s*/, "").trim()
      if (item) outputItems.push(item)
      continue
    }
  }

  return {
    title,
    detailFields,
    queryItems,
    outputItems,
    progressLines,
    capabilityLine,
    summary: parseDispatchSummary(summarySeedLines.join("\n"))
  }
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

function isTaskLifecycleNotice(value: unknown): value is TaskLifecycleNotice {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    (record.phase === "started" || record.phase === "completed") &&
    typeof record.threadId === "string" &&
    typeof record.title === "string" &&
    typeof record.mode === "string" &&
    typeof record.source === "string" &&
    typeof record.at === "string"
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

function extractNoticeSnapshot(text: string, marker: string): TaskNoticeSnapshot | null {
  const markerIndex = text.lastIndexOf(marker)
  if (markerIndex < 0) return null

  const jsonText = text.slice(markerIndex + marker.length).trim()
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (isTaskCompletionNotice(parsed)) return parsed
    if (isTaskLifecycleNotice(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

function stripNoticeSnapshot(text: string, marker: string): string {
  const markerIndex = text.lastIndexOf(marker)
  if (markerIndex < 0) return text
  return text.slice(0, markerIndex).trimEnd()
}

function inferSnapshotStatus(notice: TaskNoticeSnapshot): ButlerTask["status"] {
  if ("phase" in notice && notice.phase === "started") {
    return "running"
  }
  const normalized = `${notice.resultBrief}\n${notice.resultDetail}`.toLowerCase()
  return normalized.includes("任务失败") || normalized.includes("错误:") ? "failed" : "completed"
}

function isDigestNotice(notice: TaskNoticeSnapshot | null): notice is TaskCompletionNotice & {
  noticeType: "digest"
  digest: ButlerDigestPayload
} {
  return (
    !!notice &&
    !("phase" in notice) &&
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

function resolveRoundLabel(round: ButlerState["recentRounds"][number]): string {
  if (round.kind === "event_comment") return "事件评论"
  if (round.kind === "digest_comment") return "服务汇总"
  if (round.kind === "task_comment") return "管家"
  return "管家"
}

function describeExternalReplyTarget(target: QQExternalSourceInfo["replyTarget"]): string {
  if (target.scene === "group") {
    return `group:${target.groupId || "unknown"}`
  }
  if (target.scene === "guild") {
    return `guild:${target.channelId || "unknown"}`
  }
  if (target.scene === "dm") {
    return `dm:${target.userId || "unknown"}`
  }
  return `c2c:${target.userId || "unknown"}`
}

function parseLegacyReplyTarget(raw: string): QQExternalSourceInfo["replyTarget"] | null {
  const value = raw.trim()
  if (!value) return null
  const [scene, id] = value.split(":", 2)
  if (scene === "group") {
    return { scene: "group", groupId: id?.trim() || undefined }
  }
  if (scene === "guild") {
    return { scene: "guild", channelId: id?.trim() || undefined }
  }
  if (scene === "dm") {
    return { scene: "dm", userId: id?.trim() || undefined }
  }
  if (scene === "c2c") {
    return { scene: "c2c", userId: id?.trim() || undefined }
  }
  return null
}

function parseLegacyExternalSource(text: string): QQExternalSourceInfo | null {
  if (!text.includes("[External Source]")) return null

  const lines = text.split(/\r?\n/)
  const findValue = (prefix: string): string =>
    lines
      .find((line) => line.startsWith(prefix))
      ?.slice(prefix.length)
      .trim() || ""
  const findIndex = (label: string): number => lines.findIndex((line) => line.trim() === label)
  const collectList = (label: string): string[] => {
    const start = findIndex(label)
    if (start < 0) return []
    const result: string[] = []
    for (let index = start + 1; index < lines.length; index += 1) {
      const line = lines[index]
      if (!line.startsWith("- ")) break
      const item = line.slice(2).trim()
      if (item && item !== "none") {
        result.push(item)
      }
    }
    return result
  }
  const collectBlock = (label: string, stopLabels: string[]): string => {
    const start = findIndex(label)
    if (start < 0) return ""
    const result: string[] = []
    for (let index = start + 1; index < lines.length; index += 1) {
      const line = lines[index]
      if (stopLabels.includes(line.trim())) break
      result.push(line)
    }
    return result.join("\n").trim()
  }

  const messageType = findValue("messageType: ")
  const replyTarget = parseLegacyReplyTarget(findValue("replyTarget: "))
  if (!replyTarget) return null
  if (
    messageType !== "c2c" &&
    messageType !== "group" &&
    messageType !== "guild" &&
    messageType !== "dm"
  ) {
    return null
  }

  return {
    source: "qqbot",
    senderOpenId: findValue("senderOpenId: "),
    senderName: findValue("senderName: ") || undefined,
    messageId: findValue("messageId: "),
    messageType,
    timestamp: findValue("timestamp: "),
    replyTarget,
    originalText: collectBlock("originalText:", ["attachments:", "voiceNotes:"]),
    attachmentPaths: collectList("attachments:"),
    voiceNotes: collectList("voiceNotes:")
  }
}

function findTaskForNotice(
  round: ButlerState["recentRounds"][number],
  tasks: ButlerTask[]
): ButlerTask | null {
  const threadId = round.relatedThreadId || extractNoticeThreadId(round.assistant)
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
  snapshot: TaskNoticeSnapshot | null
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
        ("completedAt" in snapshot ? snapshot.completedAt : snapshot.at) ||
        matchedTask?.completedAt ||
        matchedTask?.createdAt ||
        round.ts
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isAtBottomRef = useRef(true)
  const [expandedDigestDetails, setExpandedDigestDetails] = useState<Record<string, boolean>>({})
  const [expandedEventDetails, setExpandedEventDetails] = useState<Record<string, boolean>>({})
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({})
  const [digestDetailTabs, setDigestDetailTabs] = useState<Record<string, DigestDetailTab>>({})
  const [digestPreset, setDigestPreset] = useState<"0" | "1" | "5" | "60" | "custom">("1")
  const [digestCustomValue, setDigestCustomValue] = useState("1")
  const [savingDigestInterval, setSavingDigestInterval] = useState(false)
  const [confirmClearHistoryOpen, setConfirmClearHistoryOpen] = useState(false)
  const [confirmClearTasksOpen, setConfirmClearTasksOpen] = useState(false)

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

  const rounds = useMemo(() => state?.recentRounds || [], [state?.recentRounds])
  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending])
  const pendingChoice = state?.pendingDispatchChoice
  const hasPendingDispatchChoice = pendingChoice?.awaiting === true
  const pendingChoiceHint = pendingChoice?.hint || "当前有待确认的任务编排方案。"

  const handleScroll = useCallback((): void => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll)
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  useEffect(() => {
    const el = scrollRef.current
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [rounds])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
      isAtBottomRef.current = true
    }
  }, [])

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

  const toggleDigestDetails = useCallback((noticeId: string): void => {
    setExpandedDigestDetails((prev) => ({
      ...prev,
      [noticeId]: !prev[noticeId]
    }))
  }, [])

  const toggleEventDetails = useCallback((noticeId: string): void => {
    setExpandedEventDetails((prev) => ({
      ...prev,
      [noticeId]: !prev[noticeId]
    }))
  }, [])

  const toggleCardCollapse = useCallback((cardId: string): void => {
    setCollapsedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId]
    }))
  }, [])

  const collapsibleCardIds = useMemo(() => {
    const ids = new Set<string>()

    for (const round of rounds) {
      const isSystemNotice = round.kind !== "chat" || round.noticeType !== undefined
      const externalSource =
        !isSystemNotice && round.externalSource?.source === "qqbot"
          ? round.externalSource
          : !isSystemNotice
            ? parseLegacyExternalSource(round.user)
            : null
      const assistantText = isSystemNotice
        ? stripNoticeSnapshot(
            stripNoticeSnapshot(round.assistant, TASK_DIGEST_MARKER),
            TASK_NOTICE_MARKER
          )
        : round.assistant
      const hasAssistantContent = assistantText.trim().length > 0

      if (externalSource) {
        ids.add(`qq:${round.id}`)
      }
      if (isSystemNotice || hasAssistantContent) {
        ids.add(`assistant:${round.id}`)
      }
    }

    return [...ids]
  }, [rounds])

  const allCardsCollapsed = useMemo(() => {
    return (
      collapsibleCardIds.length > 0 &&
      collapsibleCardIds.every((cardId) => collapsedCards[cardId] === true)
    )
  }, [collapsibleCardIds, collapsedCards])

  const handleToggleCollapseAllCards = useCallback((): void => {
    setCollapsedCards((prev) => {
      const shouldCollapse = !(
        collapsibleCardIds.length > 0 &&
        collapsibleCardIds.every((cardId) => prev[cardId] === true)
      )
      const next = { ...prev }
      for (const cardId of collapsibleCardIds) {
        next[cardId] = shouldCollapse
      }
      return next
    })
  }, [collapsibleCardIds])

  const setDigestDetailTab = useCallback((noticeId: string, tab: DigestDetailTab): void => {
    setDigestDetailTabs((prev) => ({
      ...prev,
      [noticeId]: tab
    }))
  }, [])

  const handleSaveDigestInterval = useCallback(async (): Promise<void> => {
    if (savingDigestInterval) return
    const value =
      digestPreset === "custom"
        ? Number.parseInt(digestCustomValue, 10)
        : Number.parseInt(digestPreset, 10)
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
    setSending(true)
    setInput("")

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

    setClearingHistory(true)
    try {
      const nextState = await window.api.butler.clearHistory()
      setState(nextState)
      setInput("")
      setSending(false)
      setConfirmClearHistoryOpen(false)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    } finally {
      setClearingHistory(false)
    }
  }

  const handleClearTasks = async (): Promise<void> => {
    if (clearingTasks) return

    setClearingTasks(true)
    try {
      const nextTasks = await window.api.butler.clearTasks()
      setTasks(nextTasks)
      setConfirmClearTasksOpen(false)
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleCollapseAllCards}
              disabled={collapsibleCardIds.length === 0}
              className="h-7 px-3 text-xs rounded-lg"
            >
              {allCardsCollapsed ? "展开所有卡片" : "折叠所有卡片"}
            </Button>
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
              disabled={clearingHistory || sending}
              onClick={() => setConfirmClearHistoryOpen(true)}
              className="h-7 px-3 text-xs rounded-lg"
            >
              {clearingHistory ? "清空中..." : "清空聊天"}
            </Button>
          </div>
        </header>
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 tech-gradient">
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
            const isSystemNotice = round.kind !== "chat" || round.noticeType !== undefined
            const externalSource =
              !isSystemNotice && round.externalSource?.source === "qqbot"
                ? round.externalSource
                : !isSystemNotice
                  ? parseLegacyExternalSource(round.user)
                  : null
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
            const digestNoticeId = digestNotice?.id || round.id
            const digestDetailExpanded =
              !!digestNotice && expandedDigestDetails[digestNoticeId] === true
            const digestDetailTab = digestDetailTabs[digestNoticeId] || "overview"
            const eventNoticeId = taskSnapshot?.id || round.id
            const eventDetailExpanded =
              !!noticeCard && !digestNotice && expandedEventDetails[eventNoticeId] === true
            const taskSnapshotIdentity = taskSnapshot?.taskIdentity?.trim() || ""
            const eventTaskThreadId = noticeCard?.threadId.trim() || ""
            const eventTargetThreadId = eventTaskThreadId
            const isDispatchNotice =
              !!taskSnapshot && "phase" in taskSnapshot && taskSnapshot.phase === "started"
            const dispatchStructured = parseDispatchStructuredPayload(assistantText)
            const hasStructuredDispatch = dispatchStructured !== null
            const noticeVariant =
              isSystemNotice && digestNotice
                ? "digest"
                : (isSystemNotice && isDispatchNotice) || hasStructuredDispatch
                  ? "dispatch"
                  : "default"
            const dispatchSummary =
              noticeVariant === "dispatch"
                ? dispatchStructured?.summary ||
                  parseDispatchSummary(noticeCard?.resultDetail || assistantText)
                : { taskGroup: null, createdCount: null, taskLines: [] }
            const styledNotice = noticeVariant === "digest" || noticeVariant === "dispatch"
            const qqCardId = `qq:${round.id}`
            const assistantCardId = `assistant:${round.id}`
            const qqCardCollapsed = collapsedCards[qqCardId] === true
            const assistantCardCollapsed = collapsedCards[assistantCardId] === true
            const digestPrimaryThreadId =
              digestTasks.find((task) => task.threadId.trim())?.threadId || ""
            const primaryTitle =
              digestNotice?.title ||
              noticeCard?.title ||
              dispatchStructured?.title ||
              (noticeVariant === "dispatch" ? "已成功创建查询任务" : "系统通知")
            return (
              <div key={round.id} className="space-y-4">
                {!isSystemNotice && (
                  <div className="flex justify-end">
                    {externalSource ? (
                      <Card className="max-w-[85%] border-accent/20 bg-accent/8 shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-[0.15em] text-accent/70 font-bold">
                                QQ Bot
                              </div>
                              <CardTitle className="mt-1 truncate text-sm font-semibold">
                                {externalSource.senderName?.trim() || "unknown"}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="info">{externalSource.messageType}</Badge>
                              <button
                                type="button"
                                onClick={() => {
                                  toggleCardCollapse(qqCardId)
                                }}
                                className="text-[10px] text-accent hover:text-accent/80"
                              >
                                {qqCardCollapsed ? "展开卡片" : "折叠卡片"}
                              </button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                          {qqCardCollapsed ? (
                            <div className="text-xs text-muted-foreground">
                              已折叠，点击“展开卡片”查看 QQ 消息详情。
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 gap-2 text-muted-foreground sm:grid-cols-2">
                                <div className="butler-notice-kv">
                                  <div className="butler-notice-kv__label">来源</div>
                                  <div className="butler-notice-kv__value">QQ Bot</div>
                                </div>
                                <div className="butler-notice-kv">
                                  <div className="butler-notice-kv__label">OpenID</div>
                                  <div className="butler-notice-kv__value break-all">
                                    {externalSource.senderOpenId}
                                  </div>
                                </div>
                                <div className="butler-notice-kv">
                                  <div className="butler-notice-kv__label">消息 ID</div>
                                  <div className="butler-notice-kv__value break-all">
                                    {externalSource.messageId}
                                  </div>
                                </div>
                                <div className="butler-notice-kv">
                                  <div className="butler-notice-kv__label">时间</div>
                                  <div className="butler-notice-kv__value">
                                    {new Date(externalSource.timestamp).toLocaleString()}
                                  </div>
                                </div>
                                <div className="butler-notice-kv sm:col-span-2">
                                  <div className="butler-notice-kv__label">回复目标</div>
                                  <div className="butler-notice-kv__value break-all">
                                    {describeExternalReplyTarget(externalSource.replyTarget)}
                                  </div>
                                </div>
                              </div>

                              <div className="butler-notice-section text-muted-foreground">
                                <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                  正文
                                </div>
                                <div className="whitespace-pre-wrap rounded-lg border border-border/40 bg-background/50 p-3">
                                  {externalSource.originalText || "(empty)"}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 text-muted-foreground sm:grid-cols-2">
                                <div className="butler-notice-section">
                                  <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                    附件
                                  </div>
                                  <div className="space-y-1">
                                    {externalSource.attachmentPaths.length > 0 ? (
                                      externalSource.attachmentPaths.map((item) => (
                                        <div key={item} className="whitespace-pre-wrap break-all">
                                          {item}
                                        </div>
                                      ))
                                    ) : (
                                      <div>none</div>
                                    )}
                                  </div>
                                </div>
                                <div className="butler-notice-section">
                                  <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                    语音转写
                                  </div>
                                  <div className="space-y-1">
                                    {externalSource.voiceNotes.length > 0 ? (
                                      externalSource.voiceNotes.map((item) => (
                                        <div key={item} className="whitespace-pre-wrap break-all">
                                          {item}
                                        </div>
                                      ))
                                    ) : (
                                      <div>none</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-accent/20 bg-accent/8 p-4 text-sm whitespace-pre-wrap shadow-sm">
                        {round.user}
                      </div>
                    )}
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
                    <Card
                      className={cn(
                        "max-w-[85%] border-border/50 bg-card/75",
                        styledNotice && "butler-notice-shell",
                        noticeVariant === "dispatch" && "butler-notice-shell--dispatch",
                        noticeVariant === "digest" && "butler-notice-shell--digest"
                      )}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.15em] text-accent/70 font-bold">
                              {noticeVariant === "dispatch"
                                ? "任务编排"
                                : noticeVariant === "digest"
                                  ? "服务汇总"
                                  : isSystemNotice
                                    ? resolveRoundLabel(round)
                                    : "管家"}
                            </div>
                            {isSystemNotice || noticeVariant === "dispatch" ? (
                              <CardTitle
                                className="mt-1 truncate text-sm font-semibold"
                                title={primaryTitle}
                              >
                                {primaryTitle}
                              </CardTitle>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {noticeVariant === "dispatch" ? (
                              <Badge variant="info">已创建</Badge>
                            ) : noticeVariant === "digest" ? (
                              <Badge variant="nominal">{digestTasks.length} 项更新</Badge>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                toggleCardCollapse(assistantCardId)
                              }}
                              className="text-[10px] text-accent hover:text-accent/80"
                            >
                              {assistantCardCollapsed ? "展开卡片" : "折叠卡片"}
                            </button>
                            {isSystemNotice && digestNotice ? (
                              <button
                                type="button"
                                onClick={() => {
                                  toggleDigestDetails(digestNoticeId)
                                }}
                                className="text-[10px] text-accent hover:text-accent/80"
                              >
                                {digestDetailExpanded ? "收起明细" : "展开明细"}
                              </button>
                            ) : isSystemNotice &&
                              !digestNotice &&
                              noticeCard &&
                              !isDispatchNotice ? (
                              <button
                                type="button"
                                onClick={() => {
                                  toggleEventDetails(eventNoticeId)
                                }}
                                className="text-[10px] text-accent hover:text-accent/80"
                              >
                                {eventDetailExpanded ? "收起明细" : "展开明细"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {assistantCardCollapsed ? (
                          <div className="text-xs text-muted-foreground">
                            已折叠，点击“展开卡片”查看详情。
                          </div>
                        ) : null}

                        {!assistantCardCollapsed &&
                        !(noticeVariant === "dispatch" && dispatchStructured) ? (
                          <div
                            className={cn(
                              "rounded-lg border border-border/40 bg-background/45 p-3 text-sm",
                              styledNotice && "butler-notice-section"
                            )}
                          >
                            <StreamingMarkdown variant="card">
                              {assistantText || "处理中..."}
                            </StreamingMarkdown>
                          </div>
                        ) : null}

                        {!assistantCardCollapsed && noticeVariant === "dispatch" ? (
                          <>
                            {dispatchStructured?.detailFields.length ? (
                              <div className="butler-notice-section space-y-2">
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                  任务详情
                                </div>
                                <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                  {dispatchStructured.detailFields.map((field) => (
                                    <div
                                      key={`${field.label}:${field.value}`}
                                      className="butler-notice-kv"
                                    >
                                      <div className="butler-notice-kv__label">{field.label}</div>
                                      <div className="butler-notice-kv__value">{field.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {dispatchStructured?.queryItems.length ? (
                              <div className="butler-notice-section text-xs text-muted-foreground">
                                <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                  查询内容
                                </div>
                                <div className="space-y-1">
                                  {dispatchStructured.queryItems.map((item) => (
                                    <div key={item}>
                                      <StreamingMarkdown variant="compact">{item}</StreamingMarkdown>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {dispatchStructured?.outputItems.length ? (
                              <div className="butler-notice-section text-xs text-muted-foreground">
                                <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                  输出格式
                                </div>
                                <div className="space-y-1">
                                  {dispatchStructured.outputItems.map((item) => (
                                    <div key={item}>
                                      <StreamingMarkdown variant="compact">{item}</StreamingMarkdown>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {dispatchStructured?.progressLines.length ? (
                              <div className="butler-notice-section text-xs text-muted-foreground">
                                <div className="space-y-1">
                                  {dispatchStructured.progressLines.map((line) => (
                                    <div key={line}>
                                      <StreamingMarkdown variant="compact">{line}</StreamingMarkdown>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="butler-notice-section grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                              <div className="butler-notice-kv">
                                <div className="butler-notice-kv__label">任务组</div>
                                <div className="butler-notice-kv__value">
                                  {dispatchSummary.taskGroup || "未提供"}
                                </div>
                              </div>
                              <div className="butler-notice-kv">
                                <div className="butler-notice-kv__label">新建任务数</div>
                                <div className="butler-notice-kv__value">
                                  {dispatchSummary.createdCount ?? "未提供"}
                                </div>
                              </div>
                            </div>

                            {dispatchSummary.taskLines.length > 0 ? (
                              <div className="butler-notice-section text-xs text-muted-foreground">
                                <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                  任务清单
                                </div>
                                <div className="space-y-1">
                                  {dispatchSummary.taskLines.map((line) => (
                                    <div key={line}>
                                      <StreamingMarkdown variant="compact">{line}</StreamingMarkdown>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {!dispatchStructured ? (
                              <div className="butler-notice-section max-h-44 overflow-y-auto text-xs text-muted-foreground">
                                <StreamingMarkdown variant="compact">
                                  {resolveTaskDetail(
                                    noticeCard || {
                                      threadId: "",
                                      title: "",
                                      status: "queued",
                                      resultBrief: assistantText,
                                      resultDetail: assistantText,
                                      completedAt: round.ts
                                    }
                                  )}
                                </StreamingMarkdown>
                              </div>
                            ) : null}

                            {dispatchStructured?.capabilityLine ? (
                              <div className="butler-notice-section text-xs text-muted-foreground">
                                <StreamingMarkdown variant="compact">
                                  {dispatchStructured.capabilityLine}
                                </StreamingMarkdown>
                              </div>
                            ) : null}

                            <div className="butler-notice-actions">
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
                              {eventTargetThreadId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void openTaskThread(eventTargetThreadId)
                                  }}
                                  className="text-xs text-accent hover:text-accent/80"
                                >
                                  查看任务线程
                                </button>
                              ) : null}
                            </div>
                          </>
                        ) : null}

                        {!assistantCardCollapsed && noticeVariant === "digest" && digestNotice ? (
                          <div className="butler-notice-section space-y-2">
                            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                              <div className="butler-notice-kv">
                                <div className="butler-notice-kv__label">时间窗开始</div>
                                <div className="butler-notice-kv__value">
                                  {new Date(digestNotice.digest.windowStart).toLocaleString()}
                                </div>
                              </div>
                              <div className="butler-notice-kv">
                                <div className="butler-notice-kv__label">时间窗结束</div>
                                <div className="butler-notice-kv__value">
                                  {new Date(digestNotice.digest.windowEnd).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-xs text-muted-foreground">
                              <StreamingMarkdown variant="compact">
                                {digestNotice.digest.summaryText}
                              </StreamingMarkdown>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              更新时间：{new Date(digestNotice.completedAt).toLocaleString()}
                            </div>
                            {digestPrimaryThreadId ? (
                              <div className="butler-notice-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void openTaskThread(digestPrimaryThreadId)
                                  }}
                                  className="text-xs text-accent hover:text-accent/80"
                                >
                                  查看任务线程
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {isSystemNotice && digestNotice && digestDetailExpanded ? (
                          <Card className="border-border/40 bg-background/45 shadow-none">
                            <CardContent className="space-y-3 pt-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-card/40 p-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDigestDetailTab(digestNoticeId, "overview")
                                    }}
                                    className={
                                      digestDetailTab === "overview"
                                        ? "rounded-md bg-accent/15 px-2 py-1 text-[11px] text-accent"
                                        : "rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                                    }
                                  >
                                    概览
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDigestDetailTab(digestNoticeId, "tasks")
                                    }}
                                    className={
                                      digestDetailTab === "tasks"
                                        ? "rounded-md bg-accent/15 px-2 py-1 text-[11px] text-accent"
                                        : "rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                                    }
                                  >
                                    任务
                                  </button>
                                </div>
                                <Badge variant="info">{digestTasks.length} tasks</Badge>
                              </div>

                              {digestDetailTab === "overview" ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                    <div className="rounded-lg border border-border/40 bg-background/50 p-2">
                                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                        时间窗开始
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {new Date(digestNotice.digest.windowStart).toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-border/40 bg-background/50 p-2">
                                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                        时间窗结束
                                      </div>
                                      <div className="mt-1 text-foreground">
                                        {new Date(digestNotice.digest.windowEnd).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-xs text-muted-foreground">
                                    <StreamingMarkdown variant="compact">
                                      {digestNotice.digest.summaryText}
                                    </StreamingMarkdown>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    更新时间：{new Date(digestNotice.completedAt).toLocaleString()}
                                  </div>
                                </div>
                              ) : digestTasks.length > 0 ? (
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
                                <div className="text-xs text-muted-foreground">
                                  当前汇总任务均已静默。
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ) : null}

                        {isSystemNotice &&
                        !digestNotice &&
                        !isDispatchNotice &&
                        noticeCard &&
                        eventDetailExpanded ? (
                          <Card className="border-border/40 bg-background/45 shadow-none">
                            <CardContent className="space-y-3 pt-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                  <div className="rounded-lg border border-border/40 bg-background/50 p-2">
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                      更新时间
                                    </div>
                                    <div className="mt-1 text-foreground">
                                      {new Date(noticeCard.completedAt).toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="rounded-lg border border-border/40 bg-background/50 p-2">
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                                      状态
                                    </div>
                                    <div className="mt-1">
                                      <Badge variant={toStatusVariant(noticeCard.status)}>
                                        {noticeCard.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="max-h-44 overflow-y-auto rounded-lg border border-border/40 bg-background/50 p-3 text-xs text-muted-foreground">
                                <StreamingMarkdown variant="compact">
                                  {resolveTaskDetail(noticeCard)}
                                </StreamingMarkdown>
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
                                {eventTargetThreadId ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void openTaskThread(eventTargetThreadId)
                                    }}
                                    className="text-xs text-accent hover:text-accent/80"
                                  >
                                    查看任务线程
                                  </button>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="border-t border-border/40 p-5 flex items-center gap-3 glass-panel">
          <textarea
            ref={inputRef}
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
            {sending ? "正在处理任务中" : "发送"}
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
                disabled={clearingTasks || sending}
                onClick={() => setConfirmClearTasksOpen(true)}
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

      <Dialog
        open={confirmClearHistoryOpen}
        onOpenChange={(open) => {
          if (!clearingHistory) {
            setConfirmClearHistoryOpen(open)
          }
        }}
      >
        <DialogContent className="w-[420px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>确认清空聊天记录？</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            仅清空管家主会话展示内容，不会删除已创建的任务线程。
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={clearingHistory}
              onClick={() => setConfirmClearHistoryOpen(false)}
            >
              取消
            </Button>
            <Button disabled={clearingHistory} onClick={() => void handleClearHistory()}>
              {clearingHistory ? "清空中..." : "确认清空"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmClearTasksOpen}
        onOpenChange={(open) => {
          if (!clearingTasks) {
            setConfirmClearTasksOpen(open)
          }
        }}
      >
        <DialogContent className="w-[420px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>确认清空任务列表？</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            仅清理已结束任务，运行中的任务不会被删除。
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={clearingTasks}
              onClick={() => setConfirmClearTasksOpen(false)}
            >
              取消
            </Button>
            <Button disabled={clearingTasks} onClick={() => void handleClearTasks()}>
              {clearingTasks ? "清空中..." : "确认清空"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
