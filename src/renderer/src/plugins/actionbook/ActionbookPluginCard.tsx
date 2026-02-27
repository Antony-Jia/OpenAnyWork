import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import { useActionbookPlugin } from "./useActionbookPlugin"

function formatTime(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString()
}

function StatusDot({ ok }: { ok: boolean }): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex h-2 w-2 rounded-full",
        ok ? "bg-status-nominal" : "bg-status-critical"
      )}
    />
  )
}

interface ActionbookPluginCardProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function ActionbookPluginCard({
  collapsed,
  onToggleCollapsed
}: ActionbookPluginCardProps): React.JSX.Element {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const {
    plugin,
    runtime,
    loading,
    busy,
    error,
    toggleEnabled,
    refreshChecks,
    startBridge,
    stopBridge,
    runStatus,
    runPing
  } = useActionbookPlugin()

  const canStart = useMemo(() => {
    if (!runtime?.enabled) return false
    if (runtime.bridge.managed) return false
    if (runtime.bridge.running && !runtime.bridge.managed) return false
    return true
  }, [runtime?.bridge.managed, runtime?.bridge.running, runtime?.enabled])

  const canStop = useMemo(() => {
    return !!runtime?.bridge.managed
  }, [runtime?.bridge.managed])

  const handleCopyToken = async (): Promise<void> => {
    if (!runtime?.token) return
    try {
      await navigator.clipboard.writeText(runtime.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignored in UI
    }
  }

  if (loading && !runtime) {
    return (
      <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (!plugin || !runtime) {
    return (
      <div className="rounded-lg border border-border p-4 text-xs text-status-critical">
        {t("plugin.actionbook.unavailable")}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 px-5 py-3.5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {collapsed ? (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-[15px] font-semibold">{plugin.name}</span>
        </button>
        <label className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={runtime.enabled}
            onChange={(event) => void toggleEnabled(event.target.checked)}
            disabled={!!busy["toggle"]}
          />
          {t("plugin.actionbook.enabled")}
        </label>
      </div>
      {!collapsed && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-5">
          <div className="space-y-1.5">
            <div className="text-[13px] text-muted-foreground">{plugin.description}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("plugin.actionbook.manual_mode_hint")}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2.5">
                <StatusDot ok={runtime.checks.cli.ok} />
                <span>{t("plugin.actionbook.check_cli")}</span>
              </div>
              <div className="mt-1.5 text-muted-foreground break-all text-[12px]">
                {runtime.checks.cli.message}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2.5">
                <StatusDot ok={runtime.checks.skill.ok} />
                <span>{t("plugin.actionbook.check_skill")}</span>
              </div>
              <div className="mt-1.5 text-muted-foreground break-all text-[12px]">
                {runtime.checks.skill.message}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2.5">
                <StatusDot ok={runtime.checks.extension.ok} />
                <span>{t("plugin.actionbook.check_extension")}</span>
              </div>
              <div className="mt-1.5 text-muted-foreground break-all text-[12px]">
                {runtime.checks.extension.message}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border p-3.5 space-y-1.5 text-[13px]">
            <div>
              {t("plugin.actionbook.bridge_status")}:{" "}
              <span
                className={cn(
                  runtime.bridge.running ? "text-status-nominal" : "text-muted-foreground"
                )}
              >
                {runtime.bridge.running
                  ? runtime.bridge.managed
                    ? t("plugin.actionbook.bridge_managed_running")
                    : t("plugin.actionbook.bridge_external_running")
                  : t("plugin.actionbook.bridge_stopped")}
              </span>
            </div>
            <div className="text-muted-foreground">
              {t("plugin.actionbook.extension_connected")}:{" "}
              {runtime.checks.extension.extensionConnected
                ? t("plugin.actionbook.connected")
                : t("plugin.actionbook.not_connected")}
            </div>
            <div className="text-muted-foreground">
              {t("plugin.actionbook.checked_at")}: {formatTime(runtime.checks.checkedAt)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshChecks()}
              disabled={!!busy["refresh"]}
            >
              {t("plugin.actionbook.refresh_checks")}
            </Button>
            <Button
              size="sm"
              onClick={() => void startBridge()}
              disabled={!canStart || !!busy["start"]}
            >
              {t("plugin.actionbook.start_bridge")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void stopBridge()}
              disabled={!canStop || !!busy["stop"]}
            >
              {t("plugin.actionbook.stop_bridge")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void runStatus()}
              disabled={!!busy["status"]}
            >
              {t("plugin.actionbook.status_check")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void runPing()}
              disabled={!!busy["ping"]}
            >
              {t("plugin.actionbook.ping_check")}
            </Button>
          </div>

          <div className="rounded-md border border-border p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted-foreground">
                {t("plugin.actionbook.session_token")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleCopyToken()}
                disabled={!runtime.token}
              >
                {copied ? t("plugin.actionbook.copied") : t("plugin.actionbook.copy_token")}
              </Button>
            </div>
            <div className="font-mono text-[13px] break-all text-foreground/90">
              {runtime.token || t("plugin.actionbook.token_missing")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t("plugin.actionbook.token_source")}: {runtime.tokenSource ?? "-"}
            </div>
          </div>

          {(runtime.lastStatusMessage || runtime.lastPingMessage || runtime.lastError || error) && (
            <div className="rounded-md border border-border p-3.5 space-y-1.5 text-[13px]">
              {runtime.lastStatusMessage && (
                <div className="text-muted-foreground break-all">
                  {t("plugin.actionbook.last_status")}: {runtime.lastStatusMessage}
                </div>
              )}
              {runtime.lastPingMessage && (
                <div className="text-muted-foreground break-all">
                  {t("plugin.actionbook.last_ping")}: {runtime.lastPingMessage}
                </div>
              )}
              {runtime.lastError && (
                <div className="text-status-critical break-all">{runtime.lastError}</div>
              )}
              {error && <div className="text-status-critical break-all">{error}</div>}
            </div>
          )}

          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setDetailsExpanded((prev) => !prev)}
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] hover:bg-muted/30"
            >
              {detailsExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span>
                {t("plugin.actionbook.logs")} / {t("plugin.actionbook.milestones")}
              </span>
            </button>
            {detailsExpanded && (
              <div className="border-t border-border p-3.5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-md border border-border p-3.5">
                    <div className="text-[13px] text-muted-foreground mb-2.5">
                      {t("plugin.actionbook.milestones")}
                    </div>
                    <div className="max-h-40 overflow-auto space-y-1.5 text-[12px]">
                      {runtime.milestones.length === 0 ? (
                        <div className="text-muted-foreground">
                          {t("plugin.actionbook.empty_milestones")}
                        </div>
                      ) : (
                        runtime.milestones
                          .slice()
                          .reverse()
                          .map((milestone) => (
                            <div key={milestone.id} className="break-words">
                              <span
                                className={cn(
                                  milestone.ok ? "text-status-nominal" : "text-status-critical"
                                )}
                              >
                                [{formatTime(milestone.at)}]
                              </span>{" "}
                              {milestone.message}
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-border p-3.5">
                    <div className="text-[13px] text-muted-foreground mb-2.5">
                      {t("plugin.actionbook.logs")}
                    </div>
                    <div className="max-h-40 overflow-auto">
                      {runtime.logs.length === 0 ? (
                        <div className="text-[12px] text-muted-foreground">
                          {t("plugin.actionbook.empty_logs")}
                        </div>
                      ) : (
                        <pre className="text-[12px] whitespace-pre-wrap break-words">
                          {runtime.logs
                            .map(
                              (entry) => `[${formatTime(entry.at)}][${entry.source}] ${entry.line}`
                            )
                            .join("\n")}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
