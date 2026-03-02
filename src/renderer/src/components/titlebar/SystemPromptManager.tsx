import { useCallback, useEffect, useMemo, useState } from "react"
import { FileWarning, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { AppSettings } from "@/types"

type SystemPromptTab = "butler" | "agent"

interface SystemPromptFormState {
  butlerPrefix: string
  agentPrefix: string
}

const emptyForm: SystemPromptFormState = {
  butlerPrefix: "",
  agentPrefix: ""
}

export function SystemPromptManager(): React.JSX.Element {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SystemPromptTab>("butler")
  const [form, setForm] = useState<SystemPromptFormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const settings = (await window.api.settings.get()) as AppSettings
      setForm({
        butlerPrefix: settings.systemPrompts?.butlerPrefix || "",
        agentPrefix: settings.systemPrompts?.agentPrefix || ""
      })
      setError(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : t("system_prompts.load_failed")
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!open) return
    void loadSettings()
  }, [open, loadSettings])

  const handleOpenChange = (next: boolean): void => {
    setOpen(next)
    if (!next) {
      setActiveTab("butler")
      setSaved(false)
      setError(null)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await window.api.settings.update({
        updates: {
          systemPrompts: {
            butlerPrefix: form.butlerPrefix,
            agentPrefix: form.agentPrefix
          }
        }
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (e) {
      const message = e instanceof Error ? e.message : t("system_prompts.save_failed")
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const warningText = t("system_prompts.warning")
  const activeLabel = useMemo(() => {
    return activeTab === "butler"
      ? t("system_prompts.butler.label")
      : t("system_prompts.agent.label")
  }, [activeTab, t])

  const openButtonClass = cn(
    "h-8 w-8 rounded-lg border border-transparent",
    open
      ? "bg-background/70 text-foreground border-border/80"
      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={openButtonClass}
        title={t("titlebar.system_prompts")}
        aria-label={t("titlebar.system_prompts")}
        onClick={() => setOpen(true)}
      >
        <FileWarning className="size-4" />
      </Button>

      <DialogContent className="w-[920px] h-[660px] max-w-[92vw] max-h-[88vh] p-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {t("system_prompts.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-1.5 px-6 py-3 border-b border-border">
            {(
              [
                { id: "butler", label: t("system_prompts.tab.butler") },
                { id: "agent", label: t("system_prompts.tab.agent") }
              ] as const
            ).map((tab) => (
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

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
            <div className="rounded-md border border-status-critical/50 bg-status-critical/10 p-3 text-sm text-status-critical">
              {warningText}
            </div>
            {error ? <div className="text-sm text-status-critical">{error}</div> : null}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{activeLabel}</label>
              {loading ? (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : (
                <textarea
                  value={activeTab === "butler" ? form.butlerPrefix : form.agentPrefix}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      [activeTab === "butler" ? "butlerPrefix" : "agentPrefix"]: event.target.value
                    }))
                  }
                  placeholder={t("system_prompts.placeholder")}
                  className="w-full min-h-[430px] resize-y rounded-md border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-background/70">
            {saved ? <span className="text-[11px] text-green-500">{t("system_prompts.saved")}</span> : null}
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={saving || loading} onClick={() => void handleSave()}>
              <Check className="size-3.5" />
              {saving ? t("prompts.saving") : t("system_prompts.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
