import { useCallback, useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/i18n"

export function QuickInput(): React.JSX.Element {
  const { t } = useLanguage()
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback((): void => {
    const message = value.trim()
    if (!message) return

    setValue("")
    window.electron.ipcRenderer.send("app:open-butler")
    window.electron.ipcRenderer.send("quick-input:hide")

    window.api.butler.send(message).catch((submitError: unknown) => {
      console.error("[QuickInput] butler.send failed:", submitError)
    })
  }, [value])

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
    <div className="w-full max-w-[1280px] px-2 py-1">
      <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {t("quick_input.title")}
      </div>
      <div className="px-2">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background-elevated/95 px-5 shadow-lg">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("quick_input.placeholder")}
            className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>
      </div>
      <div className="mt-2 px-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("quick_input.hint")}</span>
        <span className="text-[10px] uppercase tracking-[0.2em]">Esc</span>
      </div>
    </div>
  )
}
