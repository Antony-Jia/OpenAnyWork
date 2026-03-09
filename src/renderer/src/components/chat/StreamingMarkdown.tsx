import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { memo } from "react"
import { cn } from "@/lib/utils"

interface StreamingMarkdownProps {
  children: string
  isStreaming?: boolean
  variant?: "chat" | "card" | "compact"
  className?: string
}

function shouldOpenExternally(href?: string): boolean {
  if (!href) return false
  return /^https?:\/\//i.test(href) || /^mailto:/i.test(href)
}

export const StreamingMarkdown = memo(function StreamingMarkdown({
  children,
  isStreaming = false,
  variant = "chat",
  className
}: StreamingMarkdownProps): React.JSX.Element {
  return (
    <div className={cn("streaming-markdown", `streaming-markdown--${variant}`, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, ...props }) =>
            shouldOpenExternally(href) ? (
              <a {...props} href={href} target="_blank" rel="noopener noreferrer" />
            ) : (
              <a {...props} href={href} />
            ),
          table: ({ ...props }) => (
            <div className="streaming-markdown__table">
              <table {...props} />
            </div>
          )
        }}
      >
        {children}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block h-4 w-2 animate-pulse bg-foreground/70 align-middle" />
      )}
    </div>
  )
})
