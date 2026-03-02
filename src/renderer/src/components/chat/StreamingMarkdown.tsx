import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { memo } from "react"

interface StreamingMarkdownProps {
  children: string
  isStreaming?: boolean
}

function shouldOpenExternally(href?: string): boolean {
  if (!href) return false
  return /^https?:\/\//i.test(href) || /^mailto:/i.test(href)
}

export const StreamingMarkdown = memo(function StreamingMarkdown({
  children,
  isStreaming = false
}: StreamingMarkdownProps): React.JSX.Element {
  return (
    <div className="streaming-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, ...props }) =>
            shouldOpenExternally(href) ? (
              <a {...props} href={href} target="_blank" rel="noopener noreferrer" />
            ) : (
              <a {...props} href={href} />
            )
        }}
      >
        {children}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/70 animate-pulse" />
      )}
    </div>
  )
})
