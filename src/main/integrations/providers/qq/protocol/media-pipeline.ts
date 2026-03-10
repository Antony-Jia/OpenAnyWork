import path from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { buildQQButlerEnvelope } from "./message-envelope.js"
import type {
  QQBotConfig,
  QQButlerEnvelope,
  QQButlerEnvelopeAttachment,
  QQInboundAttachment,
  QQMediaPipeline,
  QQNormalizedMessage
} from "./types.js"

function sanitizeSegment(value: string): string {
  return value.replace(/[^\w.-]+/g, "_")
}

function inferAttachmentKind(attachment: QQInboundAttachment): QQButlerEnvelopeAttachment["kind"] {
  const type = attachment.contentType.toLowerCase()
  if (type.startsWith("image/")) return "image"
  if (type === "voice" || type.startsWith("audio/")) return "voice"
  if (type.startsWith("video/")) return "video"
  if (type.includes("octet-stream") || type.includes("application/")) return "file"
  return "unknown"
}

function normalizeFaceTags(text: string): string {
  return text.replace(/<faceType=\d+,faceId="[^"]*",ext="([^"]*)">/g, (match, ext: string) => {
    try {
      const decoded = Buffer.from(ext, "base64").toString("utf8")
      const parsed = JSON.parse(decoded) as { text?: string }
      return `【表情: ${parsed.text || "unknown"}】`
    } catch {
      return match
    }
  })
}

export interface DefaultQQMediaPipelineOptions {
  transcribeVoice?: (input: {
    attachment: QQInboundAttachment
    localPath?: string
  }) => Promise<string | undefined>
}

export class DefaultQQMediaPipeline implements QQMediaPipeline {
  private readonly cacheDir: string

  constructor(
    private readonly config: QQBotConfig,
    private readonly options: DefaultQQMediaPipelineOptions = {}
  ) {
    this.cacheDir = config.mediaCacheDir?.trim() || path.join(process.cwd(), ".qqbot-media-cache")
  }

  async buildEnvelope(message: QQNormalizedMessage): Promise<QQButlerEnvelope> {
    await mkdir(this.cacheDir, { recursive: true })
    const attachments: QQButlerEnvelopeAttachment[] = []

    for (const attachment of message.attachments ?? []) {
      attachments.push(await this.materializeAttachment(message, attachment))
    }

    return buildQQButlerEnvelope(
      {
        ...message,
        originalText: message.originalText || message.text,
        text: normalizeFaceTags(message.text)
      },
      attachments
    )
  }

  private async materializeAttachment(
    message: QQNormalizedMessage,
    attachment: QQInboundAttachment
  ): Promise<QQButlerEnvelopeAttachment> {
    const kind = inferAttachmentKind(attachment)
    const sourceUrl = attachment.voiceWavUrl || attachment.url
    const fileName =
      attachment.fileName?.trim() ||
      (sourceUrl ? path.basename(new URL(sourceUrl).pathname) : undefined) ||
      `${kind}.bin`

    const localPath =
      attachment.localPath || (await this.downloadAttachment(message.messageId, sourceUrl, fileName))

    if (kind !== "voice") {
      return {
        kind,
        fileName,
        contentType: attachment.contentType,
        sourceUrl,
        localPath
      }
    }

    const transcription = await this.tryTranscribe(attachment, localPath)
    return {
      kind,
      fileName,
      contentType: attachment.contentType,
      sourceUrl,
      localPath,
      transcription: transcription.text,
      transcriptionError: transcription.error
    }
  }

  private async downloadAttachment(
    messageId: string,
    sourceUrl: string | undefined,
    fileName: string
  ): Promise<string | undefined> {
    if (!sourceUrl) {
      return undefined
    }

    try {
      const targetDir = path.join(this.cacheDir, sanitizeSegment(messageId))
      await mkdir(targetDir, { recursive: true })
      const targetPath = path.join(targetDir, sanitizeSegment(fileName))
      const response = await fetch(sourceUrl)
      if (!response.ok) {
        throw new Error(`download failed: ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      await writeFile(targetPath, Buffer.from(arrayBuffer))
      return targetPath
    } catch {
      return undefined
    }
  }

  private async tryTranscribe(
    attachment: QQInboundAttachment,
    localPath?: string
  ): Promise<{ text?: string; error?: string }> {
    if (this.options.transcribeVoice) {
      try {
        const text = await this.options.transcribeVoice({ attachment, localPath })
        if (text?.trim()) {
          return { text: text.trim() }
        }
        return { error: "voice transcription returned empty result" }
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
    }

    if (!localPath) {
      return { error: "attachment was not saved locally" }
    }

    const stt = this.config.stt
    if (!stt?.baseUrl || !stt.apiKey || !stt.model) {
      return { error: "stt config not set" }
    }

    try {
      const fileBuffer = await readFile(localPath)
      const form = new FormData()
      form.append(
        "file",
        new Blob([fileBuffer], { type: attachment.contentType || "audio/wav" }),
        path.basename(localPath)
      )
      form.append("model", stt.model)

      const response = await fetch(`${stt.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${stt.apiKey}`
        },
        body: form
      })
      if (!response.ok) {
        return { error: `stt request failed: ${response.status}` }
      }
      const data = (await response.json()) as { text?: string }
      return { text: data.text?.trim() }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
