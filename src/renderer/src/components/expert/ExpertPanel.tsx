import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n"
import type { ExpertConfig } from "@/types"
import { ExpertConfigDialog } from "./ExpertConfigDialog"

function previewPrompt(input: string, maxLength = 180): string {
  const text = input.trim().replace(/\s+/g, " ")
  if (!text) return ""
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

export function ExpertPanel({ threadId }: { threadId: string }): React.JSX.Element | null {
  const { t } = useLanguage()
  const [config, setConfig] = useState<ExpertConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const cfg = await window.api.expert.getConfig(threadId)
      setConfig(cfg)
    } catch (error) {
      console.error("[ExpertPanel] Failed to load expert config:", error)
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }, [threadId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on("threads:changed", () => {
      void load()
    })
    return () => {
      if (typeof cleanup === "function") cleanup()
    }
  }, [load])

  if (loading) {
    return null
  }

  const experts = config?.experts ?? []
  const loopEnabled = config?.loop.enabled === true
  const maxCycles = config?.loop.maxCycles ?? 5

  return (
    <div className="rounded-md border border-border bg-card/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("expert.panel_title")}
          </div>
          <Badge variant="outline">{t("expert.mode_label")}</Badge>
          <Badge variant="outline">
            {t("expert.experts_count")}: {experts.length}
          </Badge>
          <Badge variant="outline">
            {loopEnabled ? t("expert.loop_on") : t("expert.loop_off")} · {t("expert.max_cycles")}{" "}
            {maxCycles}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          {t("expert.edit")}
        </Button>
      </div>

      {experts.length === 0 ? (
        <div className="text-xs text-muted-foreground">{t("expert.no_config")}</div>
      ) : (
        <details className="rounded-md border border-border/50 bg-background/60">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground uppercase tracking-[0.15em]">
            {t("expert.panel_details")}
          </summary>
          <div className="space-y-2 p-3 pt-0">
            {experts.map((expert, index) => (
              <div key={expert.id} className="rounded-md border border-border/50 p-2 space-y-1">
                <div className="text-xs text-muted-foreground">
                  #{index + 1} · {expert.role}
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {previewPrompt(expert.prompt) || t("expert.prompt_empty")}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <ExpertConfigDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        threadId={threadId}
        initialConfig={config}
      />
    </div>
  )
}
