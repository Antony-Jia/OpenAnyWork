import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { AppSettings, ButlerPersonaSettings } from "@/types"

interface PersonaFormState extends ButlerPersonaSettings {}

function toTextareaValue(values: string[]): string {
  return values.join("\n")
}

function fromTextareaValue(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const emptyPersona: PersonaFormState = {
  name: "",
  role: "",
  relationshipToUser: "",
  tone: "",
  principles: [],
  dos: [],
  donts: [],
  commentStyle: "balanced",
  initiativeLevel: "medium"
}

export function ButlerPersonaManager(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PersonaFormState>(emptyPersona)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const settings = (await window.api.settings.get()) as AppSettings
      setForm(settings.butler?.persona || emptyPersona)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Butler persona settings.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadSettings()
  }, [open, loadSettings])

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const currentSettings = (await window.api.settings.get()) as AppSettings
      await window.api.settings.update({
        updates: {
          butler: {
            ...currentSettings.butler,
            persona: {
              ...form,
              principles: fromTextareaValue(toTextareaValue(form.principles)),
              dos: fromTextareaValue(toTextareaValue(form.dos)),
              donts: fromTextareaValue(toTextareaValue(form.donts))
            }
          }
        }
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save Butler persona settings.")
    } finally {
      setSaving(false)
    }
  }, [form, saving])

  const openButtonClass = cn(
    "h-8 w-8 rounded-lg border border-transparent",
    open
      ? "bg-background/70 text-foreground border-border/80"
      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
  )

  const textareaClass =
    "min-h-[100px] w-full resize-y rounded-md border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
  const inputClass =
    "h-9 w-full rounded-md border border-border bg-muted/30 px-3 text-sm outline-none focus:ring-1 focus:ring-ring"

  const hint = useMemo(() => {
    return "人格配置决定 Butler 在普通对话、事件提醒、服务汇总和任务评论中的稳定语气与立场。"
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={openButtonClass}
        title="Butler Persona"
        aria-label="Butler Persona"
        onClick={() => setOpen(true)}
      >
        <Bot className="size-4" />
      </Button>

      <DialogContent className="w-[980px] h-[760px] max-w-[94vw] max-h-[92vh] p-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Butler Persona
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
            <div className="rounded-md border border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
              {hint}
            </div>
            {error ? (
              <div className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-sm text-status-critical">
                {error}
              </div>
            ) : null}
            {loading ? (
              <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Name</div>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </label>
                <label className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Role</div>
                  <input
                    className={inputClass}
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                  />
                </label>
                <label className="space-y-2 col-span-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Relationship To User</div>
                  <input
                    className={inputClass}
                    value={form.relationshipToUser}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, relationshipToUser: event.target.value }))
                    }
                  />
                </label>
                <label className="space-y-2 col-span-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tone</div>
                  <input
                    className={inputClass}
                    value={form.tone}
                    onChange={(event) => setForm((prev) => ({ ...prev, tone: event.target.value }))}
                  />
                </label>
                <label className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Comment Style</div>
                  <select
                    className={inputClass}
                    value={form.commentStyle}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        commentStyle: event.target.value as ButlerPersonaSettings["commentStyle"]
                      }))
                    }
                  >
                    <option value="concise">concise</option>
                    <option value="balanced">balanced</option>
                    <option value="reflective">reflective</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Initiative Level</div>
                  <select
                    className={inputClass}
                    value={form.initiativeLevel}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        initiativeLevel: event.target.value as ButlerPersonaSettings["initiativeLevel"]
                      }))
                    }
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Principles</div>
                  <textarea
                    className={textareaClass}
                    value={toTextareaValue(form.principles)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, principles: fromTextareaValue(event.target.value) }))
                    }
                  />
                </label>
                <label className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Do</div>
                  <textarea
                    className={textareaClass}
                    value={toTextareaValue(form.dos)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, dos: fromTextareaValue(event.target.value) }))
                    }
                  />
                </label>
                <label className="space-y-2 col-span-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Don't</div>
                  <textarea
                    className={textareaClass}
                    value={toTextareaValue(form.donts)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, donts: fromTextareaValue(event.target.value) }))
                    }
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-background/70 px-6 py-4">
            {saved ? <span className="text-[11px] text-green-500">Saved</span> : null}
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button size="sm" disabled={loading || saving} onClick={() => void handleSave()}>
              <Check className="size-3.5" />
              {saving ? "Saving..." : "Save Persona"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
