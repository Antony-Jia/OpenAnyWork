import { useState } from "react"

interface HtmlViewerProps {
  filePath: string
  content: string
}

const STRICT_CSP =
  "default-src 'none'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; img-src data:; media-src data:; font-src data:; style-src 'unsafe-inline'"

function sanitizeUrl(value: string, attrName: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const lowered = trimmed.toLowerCase()
  if (lowered.startsWith("#")) {
    return trimmed
  }

  // Keep only inline resources in preview mode.
  if (attrName === "src" && lowered.startsWith("data:")) {
    return trimmed
  }

  return "#"
}

function sanitizeHtml(raw: string): string {
  let sanitized = raw

  // Remove executable or embedded active content.
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, "")
  sanitized = sanitized.replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, "")

  // Remove inline event handlers.
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")

  // Remove external stylesheets/imports.
  sanitized = sanitized.replace(/<link\b[^>]*>/gi, "")

  // Neutralize URL attributes.
  sanitized = sanitized.replace(
    /\s(href|src|action|poster)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (_match, attrName: string, _quoted, dquoteValue: string, squoteValue: string) => {
      const original = dquoteValue ?? squoteValue ?? ""
      const safe = sanitizeUrl(original, attrName.toLowerCase())
      return ` ${attrName}="${safe}"`
    }
  )

  return sanitized
}

function buildSafeSrcDoc(content: string): string {
  const clean = sanitizeHtml(content)
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${STRICT_CSP}">`

  if (/<head[\s>]/i.test(clean)) {
    return clean.replace(/<head([^>]*)>/i, `<head$1>${cspMeta}`)
  }

  if (/<html[\s>]/i.test(clean)) {
    return clean.replace(/<html([^>]*)>/i, `<html$1><head>${cspMeta}</head>`)
  }

  return `<!doctype html><html><head>${cspMeta}</head><body>${clean}</body></html>`
}

export function HtmlViewer({ filePath, content }: HtmlViewerProps): React.JSX.Element {
  const [rawMode, setRawMode] = useState(false)
  const safeContent = buildSafeSrcDoc(content)
  const iframeContent = rawMode ? content : safeContent

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/50 text-xs text-muted-foreground shrink-0">
        <span className="truncate">{filePath}</span>
        <span className="text-muted-foreground/50">•</span>
        <span>{rawMode ? "HTML preview (raw)" : "HTML preview (sandboxed, static)"}</span>
        <button
          type="button"
          className="ml-auto h-6 px-2 rounded bg-red-600/90 hover:bg-red-600 text-white text-[11px] font-medium"
          onClick={() => setRawMode((prev) => !prev)}
          title={rawMode ? "切回安全预览" : "原文预览（不做安全处理）"}
        >
          {rawMode ? "安全预览" : "原文预览"}
        </button>
      </div>
      <iframe
        title={`HTML Preview: ${filePath}`}
        className="flex-1 w-full bg-white"
        srcDoc={iframeContent}
        sandbox={rawMode ? undefined : ""}
        referrerPolicy={rawMode ? undefined : "no-referrer"}
      />
    </div>
  )
}
