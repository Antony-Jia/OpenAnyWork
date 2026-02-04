import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/i18n"

type AgentEvent = {
  type?: string
  message?: string
  error?: string
}

export function QuickInput(): React.JSX.Element {
  const { t } = useLanguage()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(async (): Promise<void> => {
    const message = value.trim()
    if (!message || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const settings = await window.api.settings.get()
      const defaultWorkspacePath = settings.defaultWorkspacePath?.trim()
      if (!defaultWorkspacePath) {
        setError(t("quick_input.no_default_workspace"))
        window.electron.ipcRenderer.send("app:open-settings")
        setIsSubmitting(false)
        return
      }

      const thread = await window.api.threads.create({ workspacePath: defaultWorkspacePath })
      const threadId = thread.thread_id

      void (async () => {
        try {
          const generatedTitle = await window.api.threads.generateTitle(message)
          if (generatedTitle) {
            await window.api.threads.update(threadId, { title: generatedTitle })
          }
        } catch (titleError) {
          console.warn("[QuickInput] Failed to generate title:", titleError)
        }
      })()

      window.api.agent.invoke(threadId, message, (event) => {
        const evt = event as AgentEvent
        if (evt.type === "done") {
          window.electron.ipcRenderer.send("app:activate-thread", threadId)
          window.electron.ipcRenderer.send("quick-input:hide")
          setValue("")
          setIsSubmitting(false)
        } else if (evt.type === "error") {
          setError(evt.message || evt.error || "Unknown error")
          setIsSubmitting(false)
        }
      })
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("quick_input.submit_failed")
      setError(message)
      setIsSubmitting(false)
    }
  }, [isSubmitting, t, value])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      window.electron.ipcRenderer.send("quick-input:hide")
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="w-full max-w-xl px-4">
      <div className="rounded-2xl border border-border/60 bg-background/95 shadow-lg backdrop-blur-md">
        <div className="px-5 pt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("quick_input.title")}
        </div>
        <div className="px-5 pb-4 pt-3">
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("quick_input.placeholder")}
            disabled={isSubmitting}
            className="h-11 rounded-xl border-border/60 bg-background-elevated text-base shadow-sm"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{isSubmitting ? t("quick_input.submitting") : t("quick_input.hint")}</span>
            <span className="text-[10px] uppercase tracking-[0.2em]">Esc</span>
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
