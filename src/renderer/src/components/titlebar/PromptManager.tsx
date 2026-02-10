import { useCallback, useEffect, useMemo, useState } from "react"
import { BookText, Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { PromptTemplate } from "@/types"

type PromptManagerMode = "list" | "create" | "view" | "edit"

interface PromptFormState {
  name: string
  content: string
}

const emptyForm: PromptFormState = {
  name: "",
  content: ""
}

async function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const element = document.createElement("textarea")
  element.value = text
  element.style.position = "fixed"
  element.style.left = "-9999px"
  document.body.appendChild(element)
  element.focus()
  element.select()
  const ok = document.execCommand("copy")
  document.body.removeChild(element)
  if (!ok) {
    throw new Error("copy_failed")
  }
}

export function PromptManager(): React.JSX.Element {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<PromptManagerMode>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<PromptFormState>(emptyForm)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(
    () => (selectedId ? (prompts.find((item) => item.id === selectedId) ?? null) : null),
    [prompts, selectedId]
  )

  const filteredPrompts = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return prompts
    return prompts.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword) || item.content.toLowerCase().includes(keyword)
      )
    })
  }, [prompts, query])

  const resetViewState = (): void => {
    setMode("list")
    setSelectedId(null)
    setForm(emptyForm)
    setQuery("")
    setInfo(null)
    setError(null)
  }

  const loadPrompts = useCallback(async () => {
    setLoading(true)
    try {
      const items = await window.api.prompts.list()
      setPrompts(items)
    } catch (e) {
      const message = e instanceof Error ? e.message : t("prompts.load_failed")
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!open) return
    void loadPrompts()
  }, [open, loadPrompts])

  const handleOpenChange = (next: boolean): void => {
    setOpen(next)
    if (!next) {
      resetViewState()
    }
  }

  const showInfo = (message: string): void => {
    setInfo(message)
    setTimeout(() => {
      setInfo((current) => (current === message ? null : current))
    }, 1800)
  }

  const startCreate = (): void => {
    setMode("create")
    setSelectedId(null)
    setForm(emptyForm)
    setInfo(null)
    setError(null)
  }

  const startView = async (prompt: PromptTemplate): Promise<void> => {
    try {
      setError(null)
      const latest = await window.api.prompts.get(prompt.id)
      const target = latest || prompt
      setSelectedId(target.id)
      setForm({ name: target.name, content: target.content })
      setMode("view")
    } catch (e) {
      const message = e instanceof Error ? e.message : t("prompts.load_failed")
      setError(message)
    }
  }

  const startEdit = async (prompt: PromptTemplate): Promise<void> => {
    try {
      setError(null)
      const latest = await window.api.prompts.get(prompt.id)
      const target = latest || prompt
      setSelectedId(target.id)
      setForm({ name: target.name, content: target.content })
      setMode("edit")
    } catch (e) {
      const message = e instanceof Error ? e.message : t("prompts.load_failed")
      setError(message)
    }
  }

  const handleDelete = async (prompt: PromptTemplate): Promise<void> => {
    const confirmed = window.confirm(t("prompts.delete_confirm"))
    if (!confirmed) return

    try {
      setError(null)
      await window.api.prompts.delete(prompt.id)
      await loadPrompts()
      if (selectedId === prompt.id) {
        setSelectedId(null)
        setMode("list")
        setForm(emptyForm)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t("prompts.delete_failed")
      setError(message)
    }
  }

  const handleCopy = async (prompt: PromptTemplate): Promise<void> => {
    try {
      setError(null)
      await writeTextToClipboard(prompt.content)
      showInfo(t("prompts.copied"))
    } catch {
      setError(t("prompts.copy_failed"))
    }
  }

  const handleSave = async (): Promise<void> => {
    if (saving) return

    setSaving(true)
    setError(null)

    try {
      if (mode === "create") {
        const created = await window.api.prompts.create({
          name: form.name,
          content: form.content
        })
        setSelectedId(created.id)
        setMode("view")
        setForm({ name: created.name, content: created.content })
      } else if (mode === "edit" && selectedId) {
        const updated = await window.api.prompts.update(selectedId, {
          name: form.name,
          content: form.content
        })
        setMode("view")
        setForm({ name: updated.name, content: updated.content })
      }
      await loadPrompts()
    } catch (e) {
      const message = e instanceof Error ? e.message : t("prompts.save_failed")
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const openButtonClass = cn(
    "h-7 w-7 rounded-md border border-transparent",
    open
      ? "bg-background/70 text-foreground border-border/80"
      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
  )

  const inListMode = mode === "list"
  const inViewMode = mode === "view"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={openButtonClass}
        title={t("titlebar.prompts")}
        aria-label={t("titlebar.prompts")}
        onClick={() => setOpen(true)}
      >
        <BookText className="size-4" />
      </Button>

      <DialogContent className="w-[920px] h-[660px] max-w-[92vw] max-h-[88vh] p-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {t("prompts.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-scroll px-6 pb-6 pt-4">
            {inListMode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("prompts.search_placeholder")}
                  />
                  <Button size="sm" onClick={startCreate}>
                    <Plus className="size-3.5" />
                    {t("prompts.create")}
                  </Button>
                </div>

                {loading ? (
                  <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("common.loading")}
                  </div>
                ) : filteredPrompts.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("prompts.empty")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredPrompts.map((prompt) => (
                      <div
                        key={prompt.id}
                        className="flex items-start justify-between gap-3 rounded-sm border border-border p-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="text-sm font-medium truncate" title={prompt.name}>
                            {prompt.name}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {prompt.content}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(prompt.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => void startView(prompt)}>
                            <Eye className="size-3.5" />
                            {t("prompts.view")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void startEdit(prompt)}>
                            <Pencil className="size-3.5" />
                            {t("prompts.edit")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void handleCopy(prompt)}>
                            <Copy className="size-3.5" />
                            {t("prompts.copy")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(prompt)}
                          >
                            <Trash2 className="size-3.5" />
                            {t("prompts.delete")}
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
                  <label className="text-xs text-muted-foreground">{t("prompts.name")}</label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={t("prompts.name_placeholder")}
                    disabled={inViewMode}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t("prompts.content")}</label>
                  <textarea
                    value={form.content}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, content: event.target.value }))
                    }
                    placeholder={t("prompts.content_placeholder")}
                    disabled={inViewMode}
                    className="w-full min-h-[360px] rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-100"
                  />
                </div>
              </div>
            )}

            {info && <div className="mt-4 text-xs text-status-success">{info}</div>}
            {error && <div className="mt-4 text-xs text-status-critical">{error}</div>}
          </div>

          {!inListMode && (
            <DialogFooter className="px-6 pb-6 pt-2">
              {inViewMode ? (
                <>
                  <Button variant="ghost" onClick={() => setMode("list")}>
                    {t("prompts.back")}
                  </Button>
                  {selected && (
                    <Button variant="ghost" onClick={() => void handleCopy(selected)}>
                      {t("prompts.copy")}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      if (!selected) return
                      setMode("edit")
                    }}
                    disabled={!selected}
                  >
                    {t("prompts.edit")}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setMode("list")} disabled={saving}>
                    {t("prompts.cancel")}
                  </Button>
                  <Button onClick={() => void handleSave()} disabled={saving}>
                    {saving ? t("prompts.saving") : t("prompts.save")}
                  </Button>
                </>
              )}
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
