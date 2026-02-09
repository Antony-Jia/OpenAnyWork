import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import type {
  ButlerMonitorSnapshot,
  CalendarWatchEvent,
  CountdownWatchItem,
  MailWatchMessage,
  MailWatchRule
} from "@/types"

type MonitorTab = "calendar" | "countdown" | "mail"

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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [pullResult, setPullResult] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextSnapshot, events, countdowns, rules, mails] = await Promise.all([
        window.api.butlerMonitor.getSnapshot(),
        window.api.butlerMonitor.listCalendarEvents(),
        window.api.butlerMonitor.listCountdownTimers(),
        window.api.butlerMonitor.listMailRules(),
        window.api.butlerMonitor.listRecentMails(20)
      ])
      setSnapshot(nextSnapshot)
      setCalendarEvents(events)
      setCountdownTimers(countdowns)
      setMailRules(rules)
      setRecentMails(mails)
    } catch (loadError) {
      console.error("[ButlerMonitorBoard] load failed:", loadError)
      setError(loadError instanceof Error ? loadError.message : "加载监听任务失败。")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    if (!snapshot) return "loading..."
    return `日历 ${snapshot.calendarEvents.length} / 倒计时 ${snapshot.countdownTimers.length} / 规则 ${snapshot.mailRules.length}`
  }, [snapshot])

  const handleCreateCalendar = async (): Promise<void> => {
    const title = window.prompt("事件标题")
    if (title === null || !title.trim()) return
    const startInput = window.prompt("开始时间 (YYYY-MM-DDTHH:mm)")
    if (startInput === null || !startInput.trim()) return
    const endInput = window.prompt("结束时间 (可空)", "")
    if (endInput === null) return
    const description = window.prompt("说明 (可空)", "")
    if (description === null) return
    const location = window.prompt("地点 (可空)", "")
    if (location === null) return

    try {
      await window.api.butlerMonitor.createCalendarEvent({
        title: title.trim(),
        startAt: fromInputDateTime(startInput.trim()),
        endAt: endInput.trim() ? fromInputDateTime(endInput.trim()) : undefined,
        description: description.trim() || undefined,
        location: location.trim() || undefined
      })
      await load()
    } catch (createError) {
      console.error("[ButlerMonitorBoard] create calendar failed:", createError)
      setError(createError instanceof Error ? createError.message : "创建日历事件失败。")
    }
  }

  const handleEditCalendar = async (event: CalendarWatchEvent): Promise<void> => {
    const title = window.prompt("标题", event.title)
    if (title === null) return
    const startInput = window.prompt("开始时间 (YYYY-MM-DDTHH:mm)", toInputDateTime(event.startAt))
    if (startInput === null) return
    const endInput = window.prompt("结束时间 (可空)", toInputDateTime(event.endAt))
    if (endInput === null) return
    const description = window.prompt("说明 (可空)", event.description || "")
    if (description === null) return
    const location = window.prompt("地点 (可空)", event.location || "")
    if (location === null) return

    try {
      await window.api.butlerMonitor.updateCalendarEvent(event.id, {
        title: title.trim(),
        startAt: fromInputDateTime(startInput),
        endAt: endInput.trim() ? fromInputDateTime(endInput.trim()) : "",
        description: description.trim(),
        location: location.trim()
      })
      await load()
    } catch (updateError) {
      console.error("[ButlerMonitorBoard] edit calendar failed:", updateError)
      setError(updateError instanceof Error ? updateError.message : "更新日历事件失败。")
    }
  }

  const handleCreateCountdown = async (): Promise<void> => {
    const title = window.prompt("倒计时标题")
    if (title === null || !title.trim()) return
    const dueAtInput = window.prompt("到点时间 (YYYY-MM-DDTHH:mm)")
    if (dueAtInput === null || !dueAtInput.trim()) return
    const description = window.prompt("说明 (可空)", "")
    if (description === null) return

    try {
      await window.api.butlerMonitor.createCountdownTimer({
        title: title.trim(),
        dueAt: fromInputDateTime(dueAtInput.trim()),
        description: description.trim() || undefined
      })
      await load()
    } catch (createError) {
      console.error("[ButlerMonitorBoard] create countdown failed:", createError)
      setError(createError instanceof Error ? createError.message : "创建倒计时失败。")
    }
  }

  const handleEditCountdown = async (timer: CountdownWatchItem): Promise<void> => {
    const title = window.prompt("标题", timer.title)
    if (title === null) return
    const dueAtInput = window.prompt("到点时间 (YYYY-MM-DDTHH:mm)", toInputDateTime(timer.dueAt))
    if (dueAtInput === null) return
    const description = window.prompt("说明 (可空)", timer.description || "")
    if (description === null) return

    try {
      await window.api.butlerMonitor.updateCountdownTimer(timer.id, {
        title: title.trim(),
        dueAt: fromInputDateTime(dueAtInput),
        description: description.trim()
      })
      await load()
    } catch (updateError) {
      console.error("[ButlerMonitorBoard] edit countdown failed:", updateError)
      setError(updateError instanceof Error ? updateError.message : "更新倒计时失败。")
    }
  }

  const handleCreateMailRule = async (): Promise<void> => {
    const name = window.prompt("规则名称")
    if (name === null || !name.trim()) return
    const folder = window.prompt("邮箱文件夹 (默认 INBOX)", "INBOX")
    if (folder === null) return
    const fromContains = window.prompt("发件人包含 (可空)", "")
    if (fromContains === null) return
    const subjectContains = window.prompt("主题包含 (可空)", "")
    if (subjectContains === null) return

    try {
      await window.api.butlerMonitor.createMailRule({
        name: name.trim(),
        folder: folder.trim() || "INBOX",
        fromContains: fromContains.trim() || undefined,
        subjectContains: subjectContains.trim() || undefined,
        enabled: true
      })
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

  const handlePullMailNow = async (): Promise<void> => {
    if (pulling) return
    setPulling(true)
    setPullResult("")
    setError(null)
    try {
      const inserted = await window.api.butlerMonitor.pullMailNow()
      setPullResult(`本次拉取到 ${inserted.length} 封新邮件。`)
      const [rules, mails, nextSnapshot] = await Promise.all([
        window.api.butlerMonitor.listMailRules(),
        window.api.butlerMonitor.listRecentMails(20),
        window.api.butlerMonitor.getSnapshot()
      ])
      setMailRules(rules)
      setRecentMails(mails)
      setSnapshot(nextSnapshot)
    } catch (pullError) {
      console.error("[ButlerMonitorBoard] pull mail failed:", pullError)
      setError(pullError instanceof Error ? pullError.message : "邮件拉取失败。")
    } finally {
      setPulling(false)
    }
  }

  if (loading) {
    return <div className="h-full p-3 text-xs text-muted-foreground">加载监听任务中...</div>
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground">{stats}</div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void load()}>
          刷新
        </Button>
      </div>

      <div className="px-3 py-2 border-b border-border flex items-center gap-1">
        {([
          { id: "calendar", label: "日历状态" },
          { id: "countdown", label: "计时提醒" },
          { id: "mail", label: "邮件拉取" }
        ] as Array<{ id: MonitorTab; label: string }>).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`h-7 px-2 rounded text-xs border ${
              activeTab === tab.id
                ? "border-blue-500/50 bg-blue-500/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-3 mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {activeTab === "calendar" && (
          <>
            <div className="flex items-center justify-end">
              <Button className="h-7 px-2 text-xs" onClick={() => void handleCreateCalendar()}>
                创建日历事件
              </Button>
            </div>

            {calendarEvents.length === 0 && (
              <div className="text-xs text-muted-foreground rounded border border-border p-3">
                暂无日历事件
              </div>
            )}
            {calendarEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-border p-3 space-y-2">
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
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void handleEditCalendar(event)}>
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-300 hover:text-red-200"
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
              <Button className="h-7 px-2 text-xs" onClick={() => void handleCreateCountdown()}>
                创建倒计时
              </Button>
            </div>

            {countdownTimers.length === 0 && (
              <div className="text-xs text-muted-foreground rounded border border-border p-3">
                暂无倒计时
              </div>
            )}
            {countdownTimers.map((timer) => (
              <div key={timer.id} className="rounded-md border border-border p-3 space-y-2">
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
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void handleEditCountdown(timer)}>
                    编辑
                  </Button>
                  {timer.status !== "running" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
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
                    className="h-7 px-2 text-xs text-red-300 hover:text-red-200"
                    onClick={() => {
                      void window.api.butlerMonitor.deleteCountdownTimer(timer.id).then(() => load())
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
            <div className="flex items-center justify-end gap-2">
              <Button className="h-7 px-2 text-xs" onClick={() => void handleCreateMailRule()}>
                创建邮件规则
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={pulling}
                onClick={() => void handlePullMailNow()}
              >
                {pulling ? "拉取中..." : "立即拉取"}
              </Button>
            </div>
            <div>
              {pullResult && <div className="text-[11px] text-blue-300">{pullResult}</div>}
            </div>

            <div className="space-y-2">
              {mailRules.length === 0 && (
                <div className="text-xs text-muted-foreground rounded border border-border p-3">
                  暂无邮件规则
                </div>
              )}
              {mailRules.map((rule) => (
                <div key={rule.id} className="rounded-md border border-border p-3 space-y-2">
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
                  <div className="text-[11px] text-muted-foreground">文件夹: {rule.folder || "INBOX"}</div>
                  {rule.fromContains && (
                    <div className="text-[11px] text-muted-foreground">发件人包含: {rule.fromContains}</div>
                  )}
                  {rule.subjectContains && (
                    <div className="text-[11px] text-muted-foreground">主题包含: {rule.subjectContains}</div>
                  )}
                  {typeof rule.lastSeenUid === "number" && (
                    <div className="text-[11px] text-muted-foreground">lastSeenUid: {rule.lastSeenUid}</div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void handleEditMailRule(rule)}>
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-300 hover:text-red-200"
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

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-[0.12em]">最近邮件</div>
              {recentMails.length === 0 && (
                <div className="text-xs text-muted-foreground rounded border border-border p-3">
                  暂无邮件记录
                </div>
              )}
              {recentMails.map((mail) => (
                <details key={mail.id} className="rounded-md border border-border p-2">
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
      </div>
    </div>
  )
}
