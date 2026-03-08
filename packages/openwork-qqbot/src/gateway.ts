import type { QQBotConfig, QQBotLogger, QQGateway, QQInboundAttachment, QQInboundEvent } from "./types.js"

const DEFAULT_TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken"
const DEFAULT_API_BASE = "https://api.sgroup.qq.com"
const INTENTS_GROUP_AND_C2C = 1 << 25
const DEFAULT_RECONNECT_DELAY_MS = 3000

interface AccessTokenCache {
  value: string
  expiresAt: number
}

interface GatewayPayload {
  op: number
  d?: unknown
  s?: number
  t?: string
}

interface GatewayAttachment {
  content_type?: string
  filename?: string
  width?: number
  height?: number
  size?: number
  url?: string
  voice_wav_url?: string
}

interface C2CMessageEvent {
  id?: string
  content?: string
  timestamp?: string
  author?: {
    user_openid?: string
    id?: string
    username?: string
  }
  attachments?: GatewayAttachment[]
}

interface GroupMessageEvent {
  id?: string
  content?: string
  timestamp?: string
  group_openid?: string
  group_id?: string
  author?: {
    member_openid?: string
    id?: string
  }
  attachments?: GatewayAttachment[]
}

interface GuildMessageEvent {
  id?: string
  content?: string
  timestamp?: string
  channel_id?: string
  guild_id?: string
  author?: {
    id?: string
    username?: string
  }
  attachments?: GatewayAttachment[]
}

function createDefaultLogger(): QQBotLogger {
  return {
    info: (message) => console.log(`[openwork-qqbot] ${message}`),
    warn: (message) => console.warn(`[openwork-qqbot] ${message}`),
    error: (message) => console.error(`[openwork-qqbot] ${message}`)
  }
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value
  }
  return new Date().toISOString()
}

function mapAttachments(attachments: GatewayAttachment[] | undefined): QQInboundAttachment[] | undefined {
  if (!attachments?.length) {
    return undefined
  }
  return attachments.map((attachment) => ({
    contentType: attachment.content_type || "application/octet-stream",
    fileName: attachment.filename,
    width: attachment.width,
    height: attachment.height,
    size: attachment.size,
    url: attachment.url,
    voiceWavUrl: attachment.voice_wav_url
  }))
}

export class DefaultQQGateway implements QQGateway {
  private listener?: (event: QQInboundEvent) => Promise<void>
  private ws: WebSocket | null = null
  private stopped = true
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private tokenCache: AccessTokenCache | null = null
  private connectPromise: Promise<void> | null = null
  private lastSeq: number | null = null

  constructor(
    private readonly config: QQBotConfig,
    private readonly logger: QQBotLogger = createDefaultLogger()
  ) {}

  setListener(listener: (event: QQInboundEvent) => Promise<void>): void {
    this.listener = listener
  }

  async start(): Promise<void> {
    if (!this.config.appId?.trim()) {
      throw new Error("QQ gateway requires config.appId")
    }
    this.stopped = false
    await this.connect()
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.clearReconnect()
    this.stopHeartbeat()
    const currentWs = this.ws
    this.ws = null
    if (currentWs && (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === WebSocket.CONNECTING)) {
      currentWs.close()
    }
  }

  private async connect(): Promise<void> {
    if (this.connectPromise) {
      return this.connectPromise
    }

    this.connectPromise = (async () => {
      if (this.stopped) {
        return
      }

      this.stopHeartbeat()
      const { accessToken, gatewayUrl } = await this.resolveGateway()
      this.logger.info(`connecting to gateway: ${gatewayUrl}`)

      const ws = new WebSocket(gatewayUrl)
      this.ws = ws

      ws.addEventListener("open", () => {
        this.logger.info("gateway websocket connected")
      })

      ws.addEventListener("message", (event) => {
        void this.handleMessage(accessToken, ws, event.data)
      })

      ws.addEventListener("close", (event) => {
        if (this.ws === ws) {
          this.ws = null
        }
        this.stopHeartbeat()
        this.logger.warn(
          `gateway websocket closed: code=${event.code}, reason=${event.reason || "none"}`
        )
        this.scheduleReconnect()
      })

      ws.addEventListener("error", () => {
        this.logger.error("gateway websocket error")
      })
    })().finally(() => {
      this.connectPromise = null
    })

    return this.connectPromise
  }

  private async handleMessage(accessToken: string, ws: WebSocket, rawData: unknown): Promise<void> {
    try {
      const rawText = await this.readFrameText(rawData)
      const payload = JSON.parse(rawText) as GatewayPayload
      if (typeof payload.s === "number") {
        this.lastSeq = payload.s
      }

      if (payload.op === 10) {
        this.sendIdentify(accessToken, ws)
        this.startHeartbeat(payload.d, ws)
        return
      }

      if (payload.op === 11) {
        return
      }

      if (payload.op === 7 || payload.op === 9) {
        ws.close()
        return
      }

      if (payload.op === 0) {
        await this.handleDispatch(payload)
      }
    } catch (error) {
      this.logger.error(`gateway message handling failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private sendIdentify(accessToken: string, ws: WebSocket): void {
    const intents = INTENTS_GROUP_AND_C2C
    ws.send(
      JSON.stringify({
        op: 2,
        d: {
          token: `QQBot ${accessToken}`,
          intents,
          shard: [0, 1]
        }
      })
    )
    this.logger.info(`identify sent, intents=${intents}`)
  }

  private startHeartbeat(data: unknown, ws: WebSocket): void {
    const interval = this.resolveHeartbeatInterval(data)
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ op: 1, d: this.lastSeq }))
      }
    }, interval)
    this.logger.info(`heartbeat started: ${interval}ms`)
  }

  private resolveHeartbeatInterval(data: unknown): number {
    if (
      typeof data === "object" &&
      data !== null &&
      "heartbeat_interval" in data &&
      typeof (data as { heartbeat_interval?: unknown }).heartbeat_interval === "number"
    ) {
      return (data as { heartbeat_interval: number }).heartbeat_interval
    }
    return 30_000
  }

  private async handleDispatch(payload: GatewayPayload): Promise<void> {
    const type = payload.t
    if (type === "READY") {
      const sessionId =
        typeof payload.d === "object" && payload.d !== null && "session_id" in payload.d
          ? (payload.d as { session_id?: string }).session_id
          : undefined
      this.logger.info(`gateway ready${sessionId ? `, session_id=${sessionId}` : ""}`)
      return
    }

    let event: QQInboundEvent | null = null
    if (type === "C2C_MESSAGE_CREATE") {
      event = this.mapC2CEvent(payload.d as C2CMessageEvent)
    } else if (type === "GROUP_AT_MESSAGE_CREATE") {
      event = this.mapGroupEvent(payload.d as GroupMessageEvent)
    } else if (type === "AT_MESSAGE_CREATE") {
      event = this.mapGuildEvent(payload.d as GuildMessageEvent)
    } else if (type === "DIRECT_MESSAGE_CREATE") {
      event = this.mapDmEvent(payload.d as GuildMessageEvent)
    }

    if (!event) {
      return
    }
    if (!this.listener) {
      this.logger.warn(`message dropped without listener: ${event.messageId}`)
      return
    }

    await this.listener(event)
  }

  private mapC2CEvent(event: C2CMessageEvent): QQInboundEvent | null {
    const messageId = event.id?.trim()
    const senderOpenId = event.author?.user_openid?.trim() || event.author?.id?.trim()
    if (!messageId || !senderOpenId) {
      this.logger.warn("skip C2C event because message id or sender id is missing")
      return null
    }

    return {
      eventType: "C2C_MESSAGE_CREATE",
      scene: "c2c",
      messageId,
      senderOpenId,
      senderName: event.author?.username,
      text: normalizeText(event.content),
      timestamp: normalizeTimestamp(event.timestamp),
      replyTarget: {
        scene: "c2c",
        userId: senderOpenId,
        replyToMessageId: messageId
      },
      attachments: mapAttachments(event.attachments),
      raw: event
    }
  }

  private mapGroupEvent(event: GroupMessageEvent): QQInboundEvent | null {
    const messageId = event.id?.trim()
    const senderOpenId = event.author?.member_openid?.trim() || event.author?.id?.trim()
    const groupId = event.group_openid?.trim() || event.group_id?.trim()
    if (!messageId || !senderOpenId || !groupId) {
      this.logger.warn("skip group event because message id/sender/group is missing")
      return null
    }

    return {
      eventType: "GROUP_AT_MESSAGE_CREATE",
      scene: "group",
      messageId,
      senderOpenId,
      text: normalizeText(event.content),
      timestamp: normalizeTimestamp(event.timestamp),
      replyTarget: {
        scene: "group",
        groupId,
        replyToMessageId: messageId
      },
      attachments: mapAttachments(event.attachments),
      raw: event
    }
  }

  private mapGuildEvent(event: GuildMessageEvent): QQInboundEvent | null {
    const messageId = event.id?.trim()
    const senderOpenId = event.author?.id?.trim()
    const channelId = event.channel_id?.trim()
    const guildId = event.guild_id?.trim()
    if (!messageId || !senderOpenId || !channelId) {
      this.logger.warn("skip guild event because message id/sender/channel is missing")
      return null
    }

    return {
      eventType: "AT_MESSAGE_CREATE",
      scene: "guild",
      messageId,
      senderOpenId,
      senderName: event.author?.username,
      text: normalizeText(event.content),
      timestamp: normalizeTimestamp(event.timestamp),
      replyTarget: {
        scene: "guild",
        channelId,
        guildId,
        userId: senderOpenId,
        replyToMessageId: messageId
      },
      attachments: mapAttachments(event.attachments),
      raw: event
    }
  }

  private mapDmEvent(event: GuildMessageEvent): QQInboundEvent | null {
    const messageId = event.id?.trim()
    const senderOpenId = event.author?.id?.trim()
    if (!messageId || !senderOpenId) {
      this.logger.warn("skip dm event because message id or sender is missing")
      return null
    }

    return {
      eventType: "DIRECT_MESSAGE_CREATE",
      scene: "dm",
      messageId,
      senderOpenId,
      senderName: event.author?.username,
      text: normalizeText(event.content),
      timestamp: normalizeTimestamp(event.timestamp),
      replyTarget: {
        scene: "dm",
        guildId: event.guild_id?.trim(),
        userId: senderOpenId,
        replyToMessageId: messageId
      },
      attachments: mapAttachments(event.attachments),
      raw: event
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) {
      return
    }

    const delay = this.config.reconnectIntervalMs ?? DEFAULT_RECONNECT_DELAY_MS
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect().catch((error) => {
        this.logger.error(`gateway reconnect failed: ${error instanceof Error ? error.message : String(error)}`)
        this.scheduleReconnect()
      })
    }, delay)
  }

  private clearReconnect(): void {
    if (!this.reconnectTimer) {
      return
    }
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private async resolveGateway(): Promise<{ accessToken: string; gatewayUrl: string }> {
    const accessToken = await this.getAccessToken()
    if (this.config.gatewayUrl?.trim()) {
      return {
        accessToken,
        gatewayUrl: this.config.gatewayUrl.trim()
      }
    }
    const response = await this.requestJson<{ url?: string }>(accessToken, "GET", "/gateway")
    if (!response.url?.trim()) {
      throw new Error("QQ gateway response does not contain url")
    }
    return {
      accessToken,
      gatewayUrl: response.url.trim()
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
      return this.tokenCache.value
    }

    const clientSecret = this.config.clientSecret?.trim() || process.env.QQBOT_CLIENT_SECRET?.trim()
    if (!clientSecret) {
      throw new Error("QQ gateway requires config.clientSecret or QQBOT_CLIENT_SECRET")
    }

    const response = await fetch(DEFAULT_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
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
      throw new Error(`failed to get QQ access token: ${response.status} ${data.message || "unknown error"}`)
    }

    this.tokenCache = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000
    }
    return data.access_token
  }

  private async requestJson<T>(accessToken: string, method: string, path: string): Promise<T> {
    const apiBase = this.config.apiBaseUrl?.trim() || DEFAULT_API_BASE
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        Authorization: `QQBot ${accessToken}`,
        "Content-Type": "application/json",
        "X-Union-Appid": this.config.appId
      }
    })

    const raw = await response.text()
    const data = raw ? (JSON.parse(raw) as T & { message?: string }) : ({} as T)
    if (!response.ok) {
      const message =
        typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : raw || response.statusText
      throw new Error(`QQ gateway request failed [${method} ${path}]: ${message}`)
    }
    return data as T
  }

  private async readFrameText(raw: unknown): Promise<string> {
    if (typeof raw === "string") {
      return raw
    }
    if (raw instanceof Buffer) {
      return raw.toString("utf8")
    }
    if (raw instanceof ArrayBuffer) {
      return Buffer.from(raw).toString("utf8")
    }
    if (ArrayBuffer.isView(raw)) {
      return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString("utf8")
    }
    if (typeof Blob !== "undefined" && raw instanceof Blob) {
      return await raw.text()
    }
    return String(raw)
  }
}

export class MockQQGateway implements QQGateway {
  private listener?: (event: QQInboundEvent) => Promise<void>

  setListener(listener: (event: QQInboundEvent) => Promise<void>): void {
    this.listener = listener
  }

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async push(event: QQInboundEvent): Promise<void> {
    await this.listener?.(event)
  }
}
