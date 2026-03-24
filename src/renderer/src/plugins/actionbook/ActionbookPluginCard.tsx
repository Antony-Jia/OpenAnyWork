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
  const { plugin, runtime, loading, busy, error, toggleEnabled, refreshChecks } =
    useActionbookPlugin()

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
        <div className="space-y-5 border-t border-border px-5 pb-5 pt-4">
          <div className="space-y-1.5">
            <div className="text-[13px] text-muted-foreground">{plugin.description}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("plugin.actionbook.manual_mode_hint")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t("plugin.actionbook.setup_hint")}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-[13px] md:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2.5">
                <StatusDot ok={runtime.checks.cli.ok} />
                <span>{t("plugin.actionbook.check_cli")}</span>
              </div>
              <div className="mt-1.5 break-all text-[12px] text-muted-foreground">
                {runtime.checks.cli.message}
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2.5">
                <StatusDot ok={runtime.checks.skill.ok} />
                <span>{t("plugin.actionbook.check_skill")}</span>
              </div>
              <div className="mt-1.5 break-all text-[12px] text-muted-foreground">
                {runtime.checks.skill.message}
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2.5">
                <StatusDot ok={runtime.checks.extension.ok} />
                <span>{t("plugin.actionbook.check_extension")}</span>
              </div>
              <div className="mt-1.5 break-all text-[12px] text-muted-foreground">
                {runtime.checks.extension.message}
              </div>
              {runtime.checks.extension.path && (
                <div className="mt-2 break-all text-[11px] text-muted-foreground">
                  {t("plugin.actionbook.extension_path")}: {runtime.checks.extension.path}
                </div>
              )}
              {runtime.checks.extension.version && (
                <div className="mt-1 break-all text-[11px] text-muted-foreground">
                  {t("plugin.actionbook.extension_version")}: {runtime.checks.extension.version}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3.5 text-[13px]">
            <div className="text-muted-foreground">
              {t("plugin.actionbook.checked_at")}: {formatTime(runtime.checks.checkedAt)}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshChecks()}
              disabled={!!busy["refresh"]}
            >
              {t("plugin.actionbook.refresh_checks")}
            </Button>
          </div>

          {(runtime.lastError || error) && (
            <div className="space-y-1.5 rounded-md border border-border p-3.5 text-[13px]">
              {runtime.lastError && (
                <div className="break-all text-status-critical">{runtime.lastError}</div>
              )}
              {error && <div className="break-all text-status-critical">{error}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
