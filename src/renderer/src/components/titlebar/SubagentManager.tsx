import { useCallback, useEffect, useState } from "react"
import { Bot, Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import type { SubagentConfig } from "@/types"

interface SubagentFormState {
  name: string
  description: string
  systemPrompt: string
  interruptOn: boolean
}

const emptyForm: SubagentFormState = {
  name: "",
  description: "",
  systemPrompt: "",
  interruptOn: false
}

export function SubagentManager(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [subagents, setSubagents] = useState<SubagentConfig[]>([])
  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [form, setForm] = useState<SubagentFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { t } = useLanguage()

  const loadSubagents = useCallback(async () => {
    const items = await window.api.subagents.list()
    setSubagents(items)
  }, [])

  useEffect(() => {
    if (!open) return
    loadSubagents()
  }, [open, loadSubagents])

  const resetForm = (): void => {
    setForm(emptyForm)
    setEditingId(null)
    setError(null)
    setMode("list")
  }

  const startCreate = (): void => {
    setForm(emptyForm)
    setEditingId(null)
    setError(null)
    setMode("create")
  }

  const startEdit = (agent: SubagentConfig): void => {
    setForm({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      interruptOn: agent.interruptOn ?? false
    })
    setEditingId(agent.id)
    setError(null)
    setMode("edit")
  }

  const handleSave = async (): Promise<void> => {
    try {
      setError(null)
      if (mode === "create") {
        await window.api.subagents.create({
          name: form.name,
          description: form.description,
          systemPrompt: form.systemPrompt,
          interruptOn: form.interruptOn
        })
      } else if (mode === "edit" && editingId) {
        await window.api.subagents.update(editingId, {
          name: form.name,
          description: form.description,
          systemPrompt: form.systemPrompt,
          interruptOn: form.interruptOn
        })
      }
      await loadSubagents()
      resetForm()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save subagent."
      setError(message)
    }
  }

  const handleDelete = async (agent: SubagentConfig): Promise<void> => {
    const confirmed = window.confirm(`${t("subagents.delete")}: ${agent.name}?`)
    if (!confirmed) return
    await window.api.subagents.delete(agent.id)
    await loadSubagents()
  }

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      resetForm()
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "h-7 w-7 rounded-md border border-transparent",
          open
            ? "bg-background/70 text-foreground border-border/80"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        )}
        title={t("titlebar.subagents")}
        aria-label={t("titlebar.subagents")}
        onClick={() => setOpen(true)}
      >
        <Bot className="size-4" />
      </Button>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {t("subagents.title")}
          </DialogTitle>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("subagents.model_hint")}</span>
              <Button size="sm" onClick={startCreate}>
                <Plus className="size-3.5" />
                {t("subagents.add")}
              </Button>
            </div>

            {subagents.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("subagents.empty")}
              </div>
            ) : (
              <div className="space-y-2">
                {subagents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-start justify-between gap-3 rounded-sm border border-border p-3"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">{agent.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(agent)}>
                        <Pencil className="size-3.5" />
                        {t("subagents.edit")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(agent)}>
                        <Trash2 className="size-3.5" />
                        {t("subagents.delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{t("subagents.name")}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{t("subagents.description")}</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{t("subagents.system_prompt")}</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                className="w-full min-h-[120px] rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">{t("subagents.tools")}</label>
                <select
                  disabled
                  className="h-9 w-full rounded-sm border border-input bg-muted px-3 text-sm text-muted-foreground"
                >
                  <option>None</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">{t("subagents.middleware")}</label>
                <select
                  disabled
                  className="h-9 w-full rounded-sm border border-input bg-muted px-3 text-sm text-muted-foreground"
                >
                  <option>None</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.interruptOn}
                onChange={(e) => setForm((prev) => ({ ...prev, interruptOn: e.target.checked }))}
              />
              {t("subagents.interrupt_on")}
            </label>
            {error && <div className="text-xs text-status-critical">{error}</div>}
          </div>
        )}

        {mode !== "list" && (
          <DialogFooter>
            <Button variant="ghost" onClick={resetForm}>
              {t("subagents.cancel")}
            </Button>
            <Button onClick={handleSave}>{t("subagents.save")}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
