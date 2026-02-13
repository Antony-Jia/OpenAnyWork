import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n"
import { useAppStore } from "@/lib/store"
import type { ExpertConfig, ExpertConfigInput } from "@/types"

const DEFAULT_MAX_CYCLES = 5

const inputClass =
  "h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
const textareaClass =
  "w-full rounded-sm border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

interface EditableExpert {
  key: string
  id?: string
  role: string
  prompt: string
  agentThreadId?: string
}

function createEditableExpert(input?: Partial<EditableExpert>): EditableExpert {
  return {
    key: crypto.randomUUID(),
    id: input?.id,
    role: input?.role || "",
    prompt: input?.prompt || "",
    agentThreadId: input?.agentThreadId
  }
}

interface ExpertConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  threadId?: string
  initialConfig?: ExpertConfig | null
  initialTitle?: string
}

export function ExpertConfigDialog({
  open,
  onOpenChange,
  mode,
  threadId,
  initialConfig,
  initialTitle
}: ExpertConfigDialogProps): React.JSX.Element {
  const { t } = useLanguage()
  const { createThread } = useAppStore()
  const [title, setTitle] = useState(initialTitle || "")
  const [loopEnabled, setLoopEnabled] = useState(initialConfig?.loop.enabled === true)
  const [maxCycles, setMaxCycles] = useState(
    String(initialConfig?.loop.maxCycles ?? DEFAULT_MAX_CYCLES)
  )
  const [experts, setExperts] = useState<EditableExpert[]>(
    initialConfig?.experts?.length
      ? initialConfig.experts.map((expert) =>
          createEditableExpert({
            id: expert.id,
            role: expert.role,
            prompt: expert.prompt,
            agentThreadId: expert.agentThreadId
          })
        )
      : [createEditableExpert({ role: "专家1" })]
  )
  const [error, setError] = useState<string | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setTitle(initialTitle || "")
    setLoopEnabled(initialConfig?.loop.enabled === true)
    setMaxCycles(String(initialConfig?.loop.maxCycles ?? DEFAULT_MAX_CYCLES))
    setExperts(
      initialConfig?.experts?.length
        ? initialConfig.experts.map((expert) =>
            createEditableExpert({
              id: expert.id,
              role: expert.role,
              prompt: expert.prompt,
              agentThreadId: expert.agentThreadId
            })
          )
        : [createEditableExpert({ role: "专家1" })]
    )
    setError(null)
  }, [open, initialConfig, initialTitle])
  /* eslint-enable react-hooks/set-state-in-effect */

  const maxCyclesNumber = useMemo(() => {
    const parsed = Number.parseInt(maxCycles, 10)
    if (!Number.isFinite(parsed)) return DEFAULT_MAX_CYCLES
    return Math.max(1, Math.min(20, parsed))
  }, [maxCycles])

  const canSave = useMemo(() => {
    if (experts.length === 0) return false
    return experts.every(
      (expert) => expert.role.trim().length > 0 && expert.prompt.trim().length > 0
    )
  }, [experts])

  const updateExpert = (key: string, updates: Partial<EditableExpert>): void => {
    setExperts((prev) =>
      prev.map((expert) => (expert.key === key ? { ...expert, ...updates } : expert))
    )
  }

  const moveExpert = (from: number, to: number): void => {
    if (to < 0 || to >= experts.length) return
    setExperts((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const removeExpert = (key: string): void => {
    setExperts((prev) => {
      const next = prev.filter((expert) => expert.key !== key)
      return next.length > 0 ? next : [createEditableExpert()]
    })
  }

  const handleSave = async (): Promise<void> => {
    setError(null)
    try {
      const payload: ExpertConfigInput = {
        experts: experts.map((expert) => ({
          ...(expert.id ? { id: expert.id } : {}),
          role: expert.role.trim(),
          prompt: expert.prompt.trim(),
          ...(expert.agentThreadId ? { agentThreadId: expert.agentThreadId } : {})
        })),
        loop: {
          enabled: loopEnabled,
          maxCycles: maxCyclesNumber
        }
      }

      if (mode === "create") {
        await createThread({
          title: title.trim() || undefined,
          mode: "expert",
          expert: payload
        })
      } else if (threadId) {
        await window.api.expert.updateConfig(threadId, payload)
      }

      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : t("expert.error.save_failed")
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[760px] max-w-[94vw] max-h-[88vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {mode === "create" ? t("expert.create") : t("expert.edit")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 space-y-4 overflow-y-auto max-h-[74vh]">
          {mode === "create" && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{t("expert.title")}</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("expert.title_placeholder")}
              />
            </div>
          )}

          <div className="rounded-lg border border-border/50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={loopEnabled}
                  onChange={(event) => setLoopEnabled(event.target.checked)}
                />
                {t("expert.loop_enabled")}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("expert.max_cycles")}</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxCycles}
                  onChange={(event) => setMaxCycles(event.target.value)}
                  className={inputClass}
                  style={{ width: 96 }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("expert.experts")}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExperts((prev) => [...prev, createEditableExpert()])}
                className="h-8 px-3"
              >
                <Plus className="size-3.5 mr-1" />
                {t("expert.add_expert")}
              </Button>
            </div>

            {experts.map((expert, index) => (
              <div key={expert.key} className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {t("expert.order_label")}: {index + 1}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExpert(index, index - 1)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExpert(index, index + 1)}
                      disabled={index === experts.length - 1}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeExpert(expert.key)}
                      disabled={experts.length <= 1}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t("expert.role")}</label>
                  <Input
                    value={expert.role}
                    onChange={(event) => updateExpert(expert.key, { role: event.target.value })}
                    placeholder={t("expert.role_placeholder")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t("expert.prompt")}</label>
                  <textarea
                    className={textareaClass}
                    rows={4}
                    value={expert.prompt}
                    onChange={(event) => updateExpert(expert.key, { prompt: event.target.value })}
                    placeholder={t("expert.prompt_placeholder")}
                  />
                </div>
              </div>
            ))}
          </div>

          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {t("expert.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
