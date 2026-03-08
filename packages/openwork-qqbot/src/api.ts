import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import type { QQApiClient, QQBotConfig, QQOutboundPart, QQReplyTarget } from "./types.js"

const DEFAULT_API_BASE = "https://api.sgroup.qq.com"
const DEFAULT_TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken"

enum MediaFileType {
  IMAGE = 1,
  VIDEO = 2,
  VOICE = 3,
  FILE = 4
}

interface UploadMediaResponse {
  file_info: string
}

function getTargetPath(target: QQReplyTarget): string {
  if (target.scene === "group" && target.groupId) {
    return `/v2/groups/${target.groupId}/messages`
  }
  if (target.scene === "guild" && target.channelId) {
    return `/channels/${target.channelId}/messages`
  }
  if (target.userId) {
    return `/v2/users/${target.userId}/messages`
  }
  throw new Error(`Unsupported QQ reply target: ${JSON.stringify(target)}`)
}

function getUploadPath(target: QQReplyTarget): string {
  if (target.scene === "group" && target.groupId) {
    return `/v2/groups/${target.groupId}/files`
  }
  if (target.userId) {
    return `/v2/users/${target.userId}/files`
  }
  throw new Error(`QQ media upload is not supported for target: ${JSON.stringify(target)}`)
}

function getMediaFileType(part: QQOutboundPart): MediaFileType {
  switch (part.type) {
    case "image":
      return MediaFileType.IMAGE
    case "video":
      return MediaFileType.VIDEO
    case "voice":
      return MediaFileType.VOICE
    case "file":
      return MediaFileType.FILE
    default:
      return MediaFileType.FILE
  }
}

async function toMediaPayload(part: QQOutboundPart): Promise<{
  url?: string
  fileData?: string
  fileName?: string
}> {
  if (/^https?:\/\//i.test(part.value)) {
    return {
      url: part.value,
      fileName: part.fileName ?? basename(new URL(part.value).pathname)
    }
  }

  if (part.value.startsWith("data:")) {
    const [, fileData] = part.value.split(",", 2)
    return {
      fileData,
      fileName: part.fileName
    }
  }

  const fileBuffer = await readFile(part.value)
  const fileName = part.fileName ?? basename(part.value)
  return {
    fileData: fileBuffer.toString("base64"),
    fileName
  }
}

export class DefaultQQApiClient implements QQApiClient {
  private readonly apiBaseUrl: string
  private readonly tokenUrl: string
  private accessToken: { value: string; expiresAt: number } | null = null

  constructor(private readonly config: QQBotConfig) {
    this.apiBaseUrl = config.apiBaseUrl?.trim() || DEFAULT_API_BASE
    this.tokenUrl = DEFAULT_TOKEN_URL
  }

  async getGatewayUrl(): Promise<string> {
    const data = await this.apiRequest<{ url: string }>("GET", "/gateway")
    return data.url
  }

  async sendText(target: QQReplyTarget, text: string): Promise<void> {
    if (!text.trim()) return
    const body =
      this.config.markdownSupport && target.scene !== "guild"
        ? {
            markdown: { content: text },
            msg_type: 2,
            msg_seq: 1,
            ...(target.replyToMessageId ? { msg_id: target.replyToMessageId } : {})
          }
        : {
            content: text,
            msg_type: 0,
            msg_seq: 1,
            ...(target.replyToMessageId ? { msg_id: target.replyToMessageId } : {})
          }

    await this.apiRequest("POST", getTargetPath(target), body)
  }

  async sendMedia(target: QQReplyTarget, part: QQOutboundPart): Promise<void> {
    if (target.scene === "guild") {
      const fallback = part.type === "image" ? `![](${part.value})` : `${part.text || ""}\n${part.value}`
      await this.sendText(target, fallback.trim())
      return
    }

    const payload = await toMediaPayload(part)
    const uploadResponse = await this.apiRequest<UploadMediaResponse>("POST", getUploadPath(target), {
      file_type: getMediaFileType(part),
      srv_send_msg: false,
      ...(payload.url ? { url: payload.url } : {}),
      ...(payload.fileData ? { file_data: payload.fileData } : {}),
      ...(payload.fileName && getMediaFileType(part) === MediaFileType.FILE
        ? { file_name: payload.fileName }
        : {})
    })

    await this.apiRequest("POST", getTargetPath(target), {
      msg_type: 7,
      msg_seq: 1,
      media: { file_info: uploadResponse.file_info },
      ...(part.text?.trim() ? { content: part.text.trim() } : {}),
      ...(target.replyToMessageId ? { msg_id: target.replyToMessageId } : {})
    })
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 5 * 60_000) {
      return this.accessToken.value
    }

    const clientSecret = await this.resolveClientSecret()
    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appId: this.config.appId,
        clientSecret
      })
    })

    const data = (await response.json()) as {
      access_token?: string
      expires_in?: number
      message?: string
    }

    if (!response.ok || !data.access_token) {
      throw new Error(`Failed to get QQ access token: ${data.message || response.statusText}`)
    }

    this.accessToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000
    }
    return data.access_token
  }

  private async resolveClientSecret(): Promise<string> {
    if (this.config.clientSecret?.trim()) {
      return this.config.clientSecret.trim()
    }
    if (this.config.clientSecretFile?.trim()) {
      const raw = await readFile(this.config.clientSecretFile.trim(), "utf8")
      return raw.trim()
    }
    if (process.env.QQBOT_CLIENT_SECRET) {
      return process.env.QQBOT_CLIENT_SECRET.trim()
    }
    throw new Error("QQ clientSecret is not configured")
  }

  private async apiRequest<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const accessToken = await this.getAccessToken()
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `QQBot ${accessToken}`,
        "Content-Type": "application/json",
        "X-Union-Appid": this.config.appId
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })

    const raw = await response.text()
    let data: T & { message?: string } = {} as T & { message?: string }
    if (raw) {
      try {
        data = JSON.parse(raw) as T & { message?: string }
      } catch {
        if (!response.ok) {
          throw new Error(
            `QQ API request failed [${method} ${path}]: ${response.status} ${response.statusText} ${raw}`
          )
        }
        throw new Error(`QQ API request failed to parse response [${method} ${path}]`)
      }
    }
    if (!response.ok) {
      const message =
        typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : raw || response.statusText
      throw new Error(`QQ API request failed [${method} ${path}]: ${message}`)
    }
    return data as T
  }
}

export class MockQQApiClient implements QQApiClient {
  readonly sent: Array<{ target: QQReplyTarget; part: QQOutboundPart }> = []

  async sendText(target: QQReplyTarget, text: string): Promise<void> {
    this.sent.push({
      target,
      part: { type: "text", value: text }
    })
  }

  async sendMedia(target: QQReplyTarget, part: QQOutboundPart): Promise<void> {
    this.sent.push({ target, part })
  }
}
