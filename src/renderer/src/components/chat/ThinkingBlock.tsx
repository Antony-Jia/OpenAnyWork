import { useEffect, useState } from "react"
import { ChevronDown, BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import { StreamingMarkdown } from "./StreamingMarkdown"

interface ThinkingBlockProps {
  text: string
  isStreaming?: boolean
}

export function ThinkingBlock({
  text,
  isStreaming = false
}: ThinkingBlockProps): React.JSX.Element | null {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(isStreaming)

  useEffect(() => {
    setIsOpen(isStreaming)
  }, [isStreaming])

  if (!text.trim() && !isStreaming) {
    return null
  }

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
          <BrainCircuit className="size-3.5" />
          <span>{t("chat.thinking_block")}</span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-amber-500/15 px-3 py-2">
          <StreamingMarkdown variant="chat" className="text-muted-foreground">
            {text}
          </StreamingMarkdown>
          {isStreaming && (
            <span className="inline-block h-4 w-2 animate-pulse bg-foreground/70 align-middle" />
          )}
        </div>
      )}
    </div>
  )
}
