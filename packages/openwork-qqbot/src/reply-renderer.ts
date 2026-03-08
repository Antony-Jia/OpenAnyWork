import type { QQOutboundPart, QQReplyRenderer } from "./types.js"
import { normalizeMediaTags } from "./utils/media-tags.js"

const MEDIA_TAG_PATTERN = /<(qqimg|qqvoice|qqvideo|qqfile)>([\s\S]*?)<\/(qqimg|qqvoice|qqvideo|qqfile)>/gi

function toPartType(tag: string): QQOutboundPart["type"] {
  switch (tag.toLowerCase()) {
    case "qqimg":
      return "image"
    case "qqvoice":
      return "voice"
    case "qqvideo":
      return "video"
    case "qqfile":
      return "file"
    default:
      return "text"
  }
}

export class DefaultQQReplyRenderer implements QQReplyRenderer {
  render(text: string): QQOutboundPart[] {
    const source = normalizeMediaTags(text).trim()
    if (!source) {
      return []
    }

    const parts: QQOutboundPart[] = []
    let cursor = 0
    let match: RegExpExecArray | null

    while ((match = MEDIA_TAG_PATTERN.exec(source)) !== null) {
      const [fullMatch, tagName, body] = match
      const before = source.slice(cursor, match.index).trim()
      if (before) {
        parts.push({ type: "text", value: before })
      }

      const value = body.trim()
      if (value) {
        parts.push({
          type: toPartType(tagName),
          value
        })
      }

      cursor = match.index + fullMatch.length
    }

    const after = source.slice(cursor).trim()
    if (after) {
      parts.push({ type: "text", value: after })
    }

    return parts
  }
}
