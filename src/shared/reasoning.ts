export interface ReasoningSegment {
  type: "text" | "thinking"
  text: string
  open?: boolean
}

const THINK_OPEN_TAG = "<think>"
const THINK_CLOSE_TAG = "</think>"

export function hasReasoningBlocks(text: string): boolean {
  return text.includes(THINK_OPEN_TAG)
}

export function parseReasoningSegments(
  text: string,
  options: { isStreaming?: boolean } = {}
): ReasoningSegment[] {
  if (!text) return []

  const segments: ReasoningSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const openIndex = text.indexOf(THINK_OPEN_TAG, cursor)
    if (openIndex < 0) {
      const trailing = text.slice(cursor)
      if (trailing) segments.push({ type: "text", text: trailing })
      break
    }

    if (openIndex > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, openIndex) })
    }

    const contentStart = openIndex + THINK_OPEN_TAG.length
    const closeIndex = text.indexOf(THINK_CLOSE_TAG, contentStart)
    if (closeIndex < 0) {
      const thinkingText = text.slice(contentStart)
      segments.push({
        type: "thinking",
        text: thinkingText,
        open: options.isStreaming || thinkingText.length > 0
      })
      break
    }

    segments.push({
      type: "thinking",
      text: text.slice(contentStart, closeIndex),
      open: false
    })
    cursor = closeIndex + THINK_CLOSE_TAG.length
  }

  return segments
}

export function stripReasoningBlocks(text: string): string {
  if (!text) return ""
  return parseReasoningSegments(text)
    .filter((segment) => segment.type === "text")
    .map((segment) => segment.text)
    .join("")
    .trim()
}

export function injectReasoningBlock(text: string, reasoningSummary: string): string {
  const normalizedText = text.trim()
  const normalizedSummary = reasoningSummary.trim()
  if (!normalizedSummary || hasReasoningBlocks(normalizedText)) {
    return normalizedText
  }
  if (!normalizedText) {
    return `${THINK_OPEN_TAG}${normalizedSummary}${THINK_CLOSE_TAG}`
  }
  return `${THINK_OPEN_TAG}${normalizedSummary}${THINK_CLOSE_TAG}\n${normalizedText}`
}

function extractSummaryTexts(summary: unknown): string[] {
  if (!Array.isArray(summary)) return []
  return summary
    .map((item) => {
      if (!item || typeof item !== "object") return ""
      const record = item as Record<string, unknown>
      return typeof record.text === "string" ? record.text : ""
    })
    .filter((text) => text.length > 0)
}

export function extractReasoningSummaryFromResponseOutput(output: unknown): string {
  if (!Array.isArray(output)) return ""

  const summaries = output.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    if (record.type !== "reasoning" && !Array.isArray(record.summary)) {
      return []
    }

    const summaryTexts = extractSummaryTexts(record.summary)
    if (summaryTexts.length > 0) return summaryTexts
    return typeof record.reasoning === "string" && record.reasoning.trim()
      ? [record.reasoning.trim()]
      : []
  })

  return summaries.join("\n").trim()
}
