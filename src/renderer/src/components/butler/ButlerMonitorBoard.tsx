import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import type {
  ButlerMonitorBusEvent,
  ButlerMonitorPullResult,
  ButlerMonitorSnapshot,
  CalendarWatchEvent,
  CountdownWatchItem,
  MailWatchMessage,
  MailWatchRule,
  RssWatchItem,
  RssWatchSubscription
} from "@/types"

type MonitorTab = "calendar" | "countdown" | "mail" | "rss"
const FALLBACK_PULL_INTERVAL_MS = 45_000

function toInputDateTime(iso?: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function fromInputDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("时间格式无效。")
  }
  return date.toISOString()
}

export function ButlerMonitorBoard(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<MonitorTab>("calendar")
  const [snapshot, setSnapshot] = useState<ButlerMonitorSnapshot | null>(null)
  const [calendarEvents, setCalendarEvents] = useState<CalendarWatchEvent[]>([])
  const [countdownTimers, setCountdownTimers] = useState<CountdownWatchItem[]>([])
  const [mailRules, setMailRules] = useState<MailWatchRule[]>([])
  const [recentMails, setRecentMails] = useState<MailWatchMessage[]>([])
  const [rssSubscriptions, setRssSubscriptions] = useState<RssWatchSubscription[]>([])
  const [recentRssItems, setRecentRssItems] = useState<RssWatchItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [pullResult, setPullResult] = useState("")
  const [calendarDraftOpen, setCalendarDraftOpen] = useState(false)
  const [calendarEditingId, setCalendarEditingId] = useState<string | null>(null)
  const [calendarDraftTitle, setCalendarDraftTitle] = useState("")
  const [calendarDraftStartAt, setCalendarDraftStartAt] = useState("")
  const [calendarDraftEndAt, setCalendarDraftEndAt] = useState("")
  const [calendarDraftDescription, setCalendarDraftDescription] = useState("")
  const [calendarDraftLocation, setCalendarDraftLocation] = useState("")
  const [countdownDraftOpen, setCountdownDraftOpen] = useState(false)
  const [countdownEditingId, setCountdownEditingId] = useState<string | null>(null)
  const [countdownDraftTitle, setCountdownDraftTitle] = useState("")
  const [countdownDraftDueAt, setCountdownDraftDueAt] = useState("")
  const [countdownDraftDescription, setCountdownDraftDescription] = useState("")
  const [mailDraftOpen, setMailDraftOpen] = useState(false)
  const [mailDraftName, setMailDraftName] = useState("")
  const [mailDraftFolder, setMailDraftFolder] = useState("INBOX")
  const [mailDraftFromContains, setMailDraftFromContains] = useState("")
  const [mailDraftSubjectContains, setMailDraftSubjectContains] = useState("")
  const [rssDraftOpen, setRssDraftOpen] = useState(false)
  const [rssEditingId, setRssEditingId] = useState<string | null>(null)
  const [rssDraftName, setRssDraftName] = useState("")
  const [rssDraftFeedUrl, setRssDraftFeedUrl] = useState("")

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
    }
    setError(null)
    try {
      const [nextSnapshot, events, countdowns, rules, mails, subscriptions, rssItems] =
        await Promise.all([
          window.api.butlerMonitor.getSnapshot(),
          window.api.butlerMonitor.listCalendarEvents(),
          window.api.butlerMonitor.listCountdownTimers(),
          window.api.butlerMonitor.listMailRules(),
          window.api.butlerMonitor.listRecentMails(20),
          window.api.butlerMonitor.listRssSubscriptions(),
          window.api.butlerMonitor.listRecentRssItems(20)
        ])
      setSnapshot(nextSnapshot)
      setCalendarEvents(events)
      setCountdownTimers(countdowns)
      setMailRules(rules)
      setRecentMails(mails)
      setRssSubscriptions(subscriptions)
      setRecentRssItems(rssItems)
    } catch (loadError) {
      console.error("[ButlerMonitorBoard] load failed:", loadError)
      setError(loadError instanceof Error ? loadError.message : "加载监听任务失败。")
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!window.api?.butlerMonitor?.onEvent) {
      return
    }

    const handleEvent = (event: ButlerMonitorBusEvent): void => {
      if (event.type === "snapshot_changed") {
        setSnapshot(event.snapshot)
        setCalendarEvents(event.snapshot.calendarEvents)
        setCountdownTimers(event.snapshot.countdownTimers)
        setMailRules(event.snapshot.mailRules)
        setRecentMails(event.snapshot.recentMails)
        setRssSubscriptions(event.snapshot.rssSubscriptions)
        setRecentRssItems(event.snapshot.recentRssItems)
        setLoading(false)
        return
      }

      if (event.type === "perception_notice") {
        setPullResult(`新提醒：${event.notice.title}`)
      }
    }

    const unsubscribe = window.api.butlerMonitor.onEvent(handleEvent)
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load({ silent: true })
    }, FALLBACK_PULL_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [load])

  const stats = useMemo(() => {
    if (!snapshot) return "loading..."
    return `日历 ${snapshot.calendarEvents.length} / 倒计时 ${snapshot.countdownTimers.length} / 规则 ${snapshot.mailRules.length} / RSS订阅 ${snapshot.rssSubscriptions.length}`
  }, [snapshot])

  const openCalendarDraft = (): void => {
    const now = new Date().toISOString()
    setCalendarDraftOpen(true)
    setCalendarEditingId(null)
    setCalendarDraftTitle("")
    setCalendarDraftStartAt(toInputDateTime(now))
    setCalendarDraftEndAt("")
    setCalendarDraftDescription("")
    setCalendarDraftLocation("")
    setError(null)
  }

  const closeCalendarDraft = (): void => {
    setCalendarDraftOpen(false)
    setCalendarEditingId(null)
    setCalendarDraftTitle("")
    setCalendarDraftStartAt("")
    setCalendarDraftEndAt("")
    setCalendarDraftDescription("")
    setCalendarDraftLocation("")
  }

  const handleCreateCalendar = async (): Promise<void> => {
    const title = calendarDraftTitle.trim()
    const startInput = calendarDraftStartAt.trim()
    const endInput = calendarDraftEndAt.trim()
    const description = calendarDraftDescription.trim()
    const location = calendarDraftLocation.trim()
    if (!title) {
      setError("请填写事件标题。")
      return
    }
    if (!startInput) {
      setError("请填写开始时间。")
      return
    }

    try {
      if (calendarEditingId) {
        await window.api.butlerMonitor.updateCalendarEvent(calendarEditingId, {
          title,
          startAt: fromInputDateTime(startInput),
          endAt: endInput ? fromInputDateTime(endInput) : undefined,
          description: description || undefined,
          location: location || undefined
        })
      } else {
        await window.api.butlerMonitor.createCalendarEvent({
          title,
          startAt: fromInputDateTime(startInput),
          endAt: endInput ? fromInputDateTime(endInput) : undefined,
          description: description || undefined,
          location: location || undefined
        })
      }
      closeCalendarDraft()
      await load()
    } catch (createError) {
      console.error("[ButlerMonitorBoard] create calendar failed:", createError)
      setError(
        createError instanceof Error
          ? createError.message
          : calendarEditingId
            ? "更新日历事件失败。"
            : "创建日历事件失败。"
      )
    }
  }

  const handleEditCalendar = (event: CalendarWatchEvent): void => {
    setCalendarDraftOpen(true)
    setCalendarEditingId(event.id)
    setCalendarDraftTitle(event.title)
    setCalendarDraftStartAt(toInputDateTime(event.startAt))
    setCalendarDraftEndAt(toInputDateTime(event.endAt))
    setCalendarDraftDescription(event.description || "")
    setCalendarDraftLocation(event.location || "")
    setError(null)
  }

  const openCountdownDraft = (): void => {
    const now = new Date().toISOString()
    setCountdownDraftOpen(true)
    setCountdownEditingId(null)
    setCountdownDraftTitle("")
    setCountdownDraftDueAt(toInputDateTime(now))
    setCountdownDraftDescription("")
    setError(null)
  }

  const closeCountdownDraft = (): void => {
    setCountdownDraftOpen(false)
    setCountdownEditingId(null)
    setCountdownDraftTitle("")
    setCountdownDraftDueAt("")
    setCountdownDraftDescription("")
  }

  const handleCreateCountdown = async (): Promise<void> => {
    const title = countdownDraftTitle.trim()
    const dueAtInput = countdownDraftDueAt.trim()
    const description = countdownDraftDescription.trim()
    if (!title) {
      setError("请填写倒计时标题。")
      return
    }
    if (!dueAtInput) {
      setError("请填写到点时间。")
      return
    }

    try {
      if (countdownEditingId) {
        await window.api.butlerMonitor.updateCountdownTimer(countdownEditingId, {
          title,
          dueAt: fromInputDateTime(dueAtInput),
          description: description || undefined
        })
      } else {
        await window.api.butlerMonitor.createCountdownTimer({
          title,
          dueAt: fromInputDateTime(dueAtInput),
          description: description || undefined
        })
      }
      closeCountdownDraft()
      await load()
    } catch (createError) {
      console.error("[ButlerMonitorBoard] create countdown failed:", createError)
      setError(
        createError instanceof Error
          ? createError.message
          : countdownEditingId
            ? "更新倒计时失败。"
            : "创建倒计时失败。"
      )
    }
  }

  const handleEditCountdown = (timer: CountdownWatchItem): void => {
    setCountdownDraftOpen(true)
    setCountdownEditingId(timer.id)
    setCountdownDraftTitle(timer.title)
    setCountdownDraftDueAt(toInputDateTime(timer.dueAt))
    setCountdownDraftDescription(timer.description || "")
    setError(null)
  }

  const openMailDraft = (): void => {
    setMailDraftOpen(true)
    setMailDraftName("")
    setMailDraftFolder("INBOX")
    setMailDraftFromContains("")
    setMailDraftSubjectContains("")
    setError(null)
  }

  const handleCreateMailRule = async (): Promise<void> => {
    const name = mailDraftName.trim()
    const folder = mailDraftFolder.trim()
    const fromContains = mailDraftFromContains.trim()
    const subjectContains = mailDraftSubjectContains.trim()
    if (!name) {
      setError("请填写规则名称。")
      return
    }

    try {
      await window.api.butlerMonitor.createMailRule({
        name,
        folder: folder || "INBOX",
        fromContains: fromContains || undefined,
        subjectContains: subjectContains || undefined,
        enabled: true
      })
      setMailDraftOpen(false)
      setMailDraftName("")
      setMailDraftFolder("INBOX")
      setMailDraftFromContains("")
      setMailDraftSubjectContains("")
      await load()
    } catch (createError) {
      console.error("[ButlerMonitorBoard] create mail rule failed:", createError)
      setError(createError instanceof Error ? createError.message : "创建邮件规则失败。")
    }
  }

  const handleEditMailRule = async (rule: MailWatchRule): Promise<void> => {
    const name = window.prompt("规则名", rule.name)
    if (name === null) return
    const folder = window.prompt("邮箱文件夹", rule.folder || "INBOX")
    if (folder === null) return
    const fromContains = window.prompt("发件人包含 (可空)", rule.fromContains || "")
    if (fromContains === null) return
    const subjectContains = window.prompt("主题包含 (可空)", rule.subjectContains || "")
    if (subjectContains === null) return

    try {
      await window.api.butlerMonitor.updateMailRule(rule.id, {
        name: name.trim(),
        folder: folder.trim() || "INBOX",
        fromContains: fromContains.trim(),
        subjectContains: subjectContains.trim()
      })
      await load()
    } catch (updateError) {
      console.error("[ButlerMonitorBoard] edit mail rule failed:", updateError)
      setError(updateError instanceof Error ? updateError.message : "更新邮件规则失败。")
    }
  }

  const openRssDraft = (): void => {
    setRssDraftOpen(true)
    setRssEditingId(null)
    setRssDraftName("")
    setRssDraftFeedUrl("")
    setError(null)
  }

  const closeRssDraft = (): void => {
    setRssDraftOpen(false)
    setRssEditingId(null)
    setRssDraftName("")
    setRssDraftFeedUrl("")
  }

  const handleCreateRssSubscription = async (): Promise<void> => {
    const name = rssDraftName.trim()
    const feedUrl = rssDraftFeedUrl.trim()
    if (!name) {
      setError("请填写 RSS 订阅名称。")
      return
    }
    if (!feedUrl) {
      setError("请填写 RSS 地址。")
      return
    }

    try {
      if (rssEditingId) {
        await window.api.butlerMonitor.updateRssSubscription(rssEditingId, {
          name,
          feedUrl
        })
      } else {
        await window.api.butlerMonitor.createRssSubscription({
          name,
          feedUrl,
          enabled: true
        })
      }
      closeRssDraft()
      await load()
    } catch (createError) {
      console.error("[ButlerMonitorBoard] create rss subscription failed:", createError)
      setError(
        createError instanceof Error
          ? createError.message
          : rssEditingId
            ? "更新 RSS 订阅失败。"
            : "创建 RSS 订阅失败。"
      )
    }
  }

  const handleEditRssSubscription = (subscription: RssWatchSubscription): void => {
    setRssDraftOpen(true)
    setRssEditingId(subscription.id)
    setRssDraftName(subscription.name)
    setRssDraftFeedUrl(subscription.feedUrl)
    setError(null)
  }

  const handlePullNow = async (): Promise<void> => {
    if (pulling) return
    setPulling(true)
    setPullResult("")
    setError(null)
    try {
      const result: ButlerMonitorPullResult = await window.api.butlerMonitor.pullNow()
      setPullResult(`本次拉取：邮件 ${result.mailCount} 封，RSS ${result.rssCount} 条。`)
      const [rules, mails, subscriptions, rssItems, nextSnapshot] = await Promise.all([
        window.api.butlerMonitor.listMailRules(),
        window.api.butlerMonitor.listRecentMails(20),
        window.api.butlerMonitor.listRssSubscriptions(),
        window.api.butlerMonitor.listRecentRssItems(20),
        window.api.butlerMonitor.getSnapshot()
      ])
      setMailRules(rules)
      setRecentMails(mails)
      setRssSubscriptions(subscriptions)
      setRecentRssItems(rssItems)
      setSnapshot(nextSnapshot)
    } catch (pullError) {
      console.error("[ButlerMonitorBoard] pull now failed:", pullError)
      setError(pullError instanceof Error ? pullError.message : "拉取失败。")
    } finally {
      setPulling(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full p-5 text-xs text-muted-foreground shimmer-bg">加载监听任务中...</div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="px-5 py-2.5 border-b border-border/40 flex items-center justify-between gap-3 glass-panel">
        <div className="text-[11px] text-accent/60 font-bold tracking-wider">{stats}</div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-3 text-xs rounded-lg"
          onClick={() => void load({ silent: true })}
        >
          刷新
        </Button>
      </div>

      <div className="px-5 py-2.5 border-b border-border/40 flex items-center gap-2">
        {(
          [
            { id: "calendar", label: "日历状态" },
            { id: "countdown", label: "计时提醒" },
            { id: "mail", label: "邮件规则" },
            { id: "rss", label: "RSS订阅" }
          ] as Array<{ id: MonitorTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`h-7 px-3 rounded-lg text-xs border transition-all duration-300 ${
              activeTab === tab.id
                ? "border-accent/50 bg-accent/10 text-foreground font-bold shadow-[0_0_12px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
                : "border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-accent/30"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.1)]">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 tech-gradient">
        {activeTab === "calendar" && (
          <>
            <div className="flex items-center justify-end">
              <Button className="h-7 px-3 text-xs rounded-lg" onClick={openCalendarDraft}>
                创建日历事件
              </Button>
            </div>
            {calendarDraftOpen && (
              <div className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-3 card-hover">
                <div className="text-xs text-muted-foreground">
                  {calendarEditingId ? "编辑日历事件" : "新建日历事件"}
                </div>
                <input
                  className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                  value={calendarDraftTitle}
                  onChange={(event) => setCalendarDraftTitle(event.target.value)}
                  placeholder="事件标题"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="datetime-local"
                    className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                    value={calendarDraftStartAt}
                    onChange={(event) => setCalendarDraftStartAt(event.target.value)}
                  />
                  <input
                    type="datetime-local"
                    className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                    value={calendarDraftEndAt}
                    onChange={(event) => setCalendarDraftEndAt(event.target.value)}
                  />
                </div>
                <input
                  className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                  value={calendarDraftDescription}
                  onChange={(event) => setCalendarDraftDescription(event.target.value)}
                  placeholder="说明（可空）"
                />
                <input
                  className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                  value={calendarDraftLocation}
                  onChange={(event) => setCalendarDraftLocation(event.target.value)}
                  placeholder="地点（可空）"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-lg"
                    onClick={closeCalendarDraft}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs rounded-lg"
                    onClick={() => void handleCreateCalendar()}
                  >
                    {calendarEditingId ? "保存修改" : "保存事件"}
                  </Button>
                </div>
              </div>
            )}

            {calendarEvents.length === 0 && (
              <div className="text-sm text-muted-foreground rounded-2xl border border-border/40 p-6 text-center glass-panel">
                暂无日历事件
              </div>
            )}
            {calendarEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-2.5 card-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium truncate" title={event.title}>
                    {event.title}
                  </div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <input
                      type="checkbox"
                      checked={event.enabled}
                      onChange={(inputEvent) => {
                        void window.api.butlerMonitor
                          .updateCalendarEvent(event.id, { enabled: inputEvent.target.checked })
                          .then(() => load())
                      }}
                    />
                    启用
                  </label>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  开始: {new Date(event.startAt).toLocaleString()}
                </div>
                {event.endAt && (
                  <div className="text-[11px] text-muted-foreground">
                    结束: {new Date(event.endAt).toLocaleString()}
                  </div>
                )}
                {event.reminderSentAt && (
                  <div className="text-[11px] text-blue-300">
                    已提醒: {new Date(event.reminderSentAt).toLocaleString()}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-lg"
                    onClick={() => handleEditCalendar(event)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-lg text-red-300 hover:text-red-200"
                    onClick={() => {
                      void window.api.butlerMonitor.deleteCalendarEvent(event.id).then(() => load())
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === "countdown" && (
          <>
            <div className="flex items-center justify-end">
              <Button className="h-7 px-3 text-xs rounded-lg" onClick={openCountdownDraft}>
                创建倒计时
              </Button>
            </div>
            {countdownDraftOpen && (
              <div className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-3 card-hover">
                <div className="text-xs text-muted-foreground">
                  {countdownEditingId ? "编辑倒计时" : "新建倒计时"}
                </div>
                <input
                  className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                  value={countdownDraftTitle}
                  onChange={(event) => setCountdownDraftTitle(event.target.value)}
                  placeholder="倒计时标题"
                />
                <input
                  type="datetime-local"
                  className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                  value={countdownDraftDueAt}
                  onChange={(event) => setCountdownDraftDueAt(event.target.value)}
                />
                <input
                  className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                  value={countdownDraftDescription}
                  onChange={(event) => setCountdownDraftDescription(event.target.value)}
                  placeholder="说明（可空）"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-lg"
                    onClick={closeCountdownDraft}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs rounded-lg"
                    onClick={() => void handleCreateCountdown()}
                  >
                    {countdownEditingId ? "保存修改" : "保存倒计时"}
                  </Button>
                </div>
              </div>
            )}

            {countdownTimers.length === 0 && (
              <div className="text-sm text-muted-foreground rounded-2xl border border-border/40 p-6 text-center glass-panel">
                暂无倒计时
              </div>
            )}
            {countdownTimers.map((timer) => (
              <div
                key={timer.id}
                className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-2.5 card-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium truncate" title={timer.title}>
                    {timer.title}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{timer.status}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  到点: {new Date(timer.dueAt).toLocaleString()}
                </div>
                {timer.reminderSentAt && (
                  <div className="text-[11px] text-blue-300">
                    已提醒: {new Date(timer.reminderSentAt).toLocaleString()}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-lg"
                    onClick={() => handleEditCountdown(timer)}
                  >
                    编辑
                  </Button>
                  {timer.status !== "running" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg"
                      onClick={() => {
                        void window.api.butlerMonitor
                          .updateCountdownTimer(timer.id, {
                            status: "running",
                            reminderSentAt: "",
                            completedAt: ""
                          })
                          .then(() => load())
                      }}
                    >
                      重置
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-lg text-red-300 hover:text-red-200"
                    onClick={() => {
                      void window.api.butlerMonitor
                        .deleteCountdownTimer(timer.id)
                        .then(() => load())
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === "mail" && (
          <>
            <div className="flex items-center justify-end gap-3">
              <Button className="h-7 px-3 text-xs rounded-lg" onClick={openMailDraft}>
                创建邮件规则
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs rounded-lg"
                disabled={pulling}
                onClick={() => void handlePullNow()}
              >
                {pulling ? "拉取中..." : "立即拉取全部"}
              </Button>
            </div>
            <div>{pullResult && <div className="text-[11px] text-blue-300">{pullResult}</div>}</div>

            <div className="space-y-3">
              {mailDraftOpen && (
                <div className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-3 card-hover">
                  <div className="text-xs text-muted-foreground">新建邮件规则</div>
                  <input
                    className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                    value={mailDraftName}
                    onChange={(event) => setMailDraftName(event.target.value)}
                    placeholder="规则名称"
                  />
                  <input
                    className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                    value={mailDraftFolder}
                    onChange={(event) => setMailDraftFolder(event.target.value)}
                    placeholder="邮箱文件夹（默认 INBOX）"
                  />
                  <input
                    className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                    value={mailDraftFromContains}
                    onChange={(event) => setMailDraftFromContains(event.target.value)}
                    placeholder="发件人包含（可空）"
                  />
                  <input
                    className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                    value={mailDraftSubjectContains}
                    onChange={(event) => setMailDraftSubjectContains(event.target.value)}
                    placeholder="主题包含（可空）"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg"
                      onClick={() => setMailDraftOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg"
                      onClick={() => void handleCreateMailRule()}
                    >
                      保存规则
                    </Button>
                  </div>
                </div>
              )}
              {mailRules.length === 0 && (
                <div className="text-sm text-muted-foreground rounded-2xl border border-border/40 p-6 text-center glass-panel">
                  暂无邮件规则
                </div>
              )}
              {mailRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-2.5 card-hover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium truncate" title={rule.name}>
                      {rule.name}
                    </div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(event) => {
                          void window.api.butlerMonitor
                            .updateMailRule(rule.id, { enabled: event.target.checked })
                            .then(() => load())
                        }}
                      />
                      启用
                    </label>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    文件夹: {rule.folder || "INBOX"}
                  </div>
                  {rule.fromContains && (
                    <div className="text-[11px] text-muted-foreground">
                      发件人包含: {rule.fromContains}
                    </div>
                  )}
                  {rule.subjectContains && (
                    <div className="text-[11px] text-muted-foreground">
                      主题包含: {rule.subjectContains}
                    </div>
                  )}
                  {typeof rule.lastSeenUid === "number" && (
                    <div className="text-[11px] text-muted-foreground">
                      lastSeenUid: {rule.lastSeenUid}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg"
                      onClick={() => void handleEditMailRule(rule)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg text-red-300 hover:text-red-200"
                      onClick={() => {
                        void window.api.butlerMonitor.deleteMailRule(rule.id).then(() => load())
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-xs text-accent/60 uppercase tracking-[0.15em] font-bold">
                最近邮件
              </div>
              {recentMails.length === 0 && (
                <div className="text-sm text-muted-foreground rounded-2xl border border-border/40 p-6 text-center glass-panel">
                  暂无邮件记录
                </div>
              )}
              {recentMails.map((mail) => (
                <details
                  key={mail.id}
                  className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-3.5"
                >
                  <summary className="cursor-pointer">
                    <div className="text-xs font-medium truncate">{mail.subject || "(无主题)"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {mail.from || "未知发件人"} · {new Date(mail.receivedAt).toLocaleString()}
                    </div>
                  </summary>
                  <div className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
                    {mail.text || "(空正文)"}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}

        {activeTab === "rss" && (
          <>
            <div className="flex items-center justify-end gap-3">
              <Button className="h-7 px-3 text-xs rounded-lg" onClick={openRssDraft}>
                创建RSS订阅
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs rounded-lg"
                disabled={pulling}
                onClick={() => void handlePullNow()}
              >
                {pulling ? "拉取中..." : "立即拉取全部"}
              </Button>
            </div>
            <div>{pullResult && <div className="text-[11px] text-blue-300">{pullResult}</div>}</div>

            <div className="space-y-3">
              {rssDraftOpen && (
                <div className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-3 card-hover">
                  <div className="text-xs text-muted-foreground">
                    {rssEditingId ? "编辑 RSS 订阅" : "新建 RSS 订阅"}
                  </div>
                  <input
                    className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                    value={rssDraftName}
                    onChange={(event) => setRssDraftName(event.target.value)}
                    placeholder="订阅名称"
                  />
                  <input
                    className="w-full h-8 rounded-lg border border-border/40 bg-background/50 px-2 text-xs"
                    value={rssDraftFeedUrl}
                    onChange={(event) => setRssDraftFeedUrl(event.target.value)}
                    placeholder="RSS 地址（http/https）"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg"
                      onClick={closeRssDraft}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg"
                      onClick={() => void handleCreateRssSubscription()}
                    >
                      {rssEditingId ? "保存修改" : "保存订阅"}
                    </Button>
                  </div>
                </div>
              )}
              {rssSubscriptions.length === 0 && (
                <div className="text-sm text-muted-foreground rounded-2xl border border-border/40 p-6 text-center glass-panel">
                  暂无 RSS 订阅
                </div>
              )}
              {rssSubscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-2.5 card-hover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium truncate" title={subscription.name}>
                      {subscription.name}
                    </div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={subscription.enabled}
                        onChange={(event) => {
                          void window.api.butlerMonitor
                            .updateRssSubscription(subscription.id, {
                              enabled: event.target.checked
                            })
                            .then(() => load())
                        }}
                      />
                      启用
                    </label>
                  </div>
                  <div className="text-[11px] text-muted-foreground break-all">
                    地址: {subscription.feedUrl}
                  </div>
                  {subscription.lastSeenItemKey && (
                    <div className="text-[11px] text-muted-foreground break-all">
                      lastSeenItemKey: {subscription.lastSeenItemKey}
                    </div>
                  )}
                  {subscription.lastPulledAt && (
                    <div className="text-[11px] text-muted-foreground">
                      最近拉取: {new Date(subscription.lastPulledAt).toLocaleString()}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg"
                      onClick={() => handleEditRssSubscription(subscription)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-lg text-red-300 hover:text-red-200"
                      onClick={() => {
                        void window.api.butlerMonitor
                          .deleteRssSubscription(subscription.id)
                          .then(() => load())
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-xs text-accent/60 uppercase tracking-[0.15em] font-bold">
                最近RSS
              </div>
              {recentRssItems.length === 0 && (
                <div className="text-sm text-muted-foreground rounded-2xl border border-border/40 p-6 text-center glass-panel">
                  暂无 RSS 记录
                </div>
              )}
              {recentRssItems.map((item) => (
                <details
                  key={item.id}
                  className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-3.5"
                >
                  <summary className="cursor-pointer">
                    <div className="text-xs font-medium truncate">{item.title || "(无标题)"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {new Date(item.publishedAt).toLocaleString()}
                    </div>
                  </summary>
                  {item.link && (
                    <a
                      className="mt-2 block text-xs text-blue-300 break-all hover:text-blue-200"
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.link}
                    </a>
                  )}
                  <div className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
                    {item.summary || "(无摘要)"}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
