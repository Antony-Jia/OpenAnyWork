export type QQMessageScene = "c2c" | "group" | "guild" | "dm"

export interface QQModelServiceConfig {
  baseUrl: string
  apiKey: string
  model: string
  voice?: string
}

export interface QQBotConfig {
  appId: string
  clientSecret?: string
  clientSecretFile?: string
  sandbox?: boolean
  markdownSupport?: boolean
  imageServerBaseUrl?: string
  mediaCacheDir?: string
  reconnectIntervalMs?: number
  apiBaseUrl?: string
  gatewayUrl?: string
  dataDir?: string
  stt?: Partial<QQModelServiceConfig>
  tts?: Partial<QQModelServiceConfig>
}

export interface QQReplyTarget {
  scene: QQMessageScene
  userId?: string
  groupId?: string
  channelId?: string
  guildId?: string
  replyToMessageId?: string
}

export interface QQInboundAttachment {
  contentType: string
  url?: string
  fileName?: string
  width?: number
  height?: number
  size?: number
  voiceWavUrl?: string
  localPath?: string
}

export interface QQInboundEvent {
  eventType: string
  scene: QQMessageScene
  messageId: string
  senderOpenId: string
  senderName?: string
  text: string
  timestamp: string
  replyTarget: QQReplyTarget
  attachments?: QQInboundAttachment[]
  raw?: unknown
}

export interface QQNormalizedMessage extends QQInboundEvent {
  sessionId: string
  originalText: string
}

export interface QQButlerEnvelopeAttachment {
  kind: "image" | "voice" | "video" | "file" | "unknown"
  fileName?: string
  contentType: string
  sourceUrl?: string
  localPath?: string
  transcription?: string
  transcriptionError?: string
}

export interface QQButlerEnvelope {
  senderOpenId: string
  senderName?: string
  messageId: string
  messageType: QQMessageScene
  timestamp: string
  replyTarget: QQReplyTarget
  originalText: string
  attachmentPaths: string[]
  voiceNotes: string[]
  text: string
  attachments: QQButlerEnvelopeAttachment[]
  metadata: {
    sessionId: string
  }
}

export interface QQOutboundPart {
  type: "text" | "image" | "voice" | "video" | "file"
  value: string
  text?: string
  fileName?: string
  contentType?: string
}

export interface QQGateway {
  start(): Promise<void>
  stop(): Promise<void>
  setListener(listener: (event: QQInboundEvent) => Promise<void>): void
}

export interface QQApiClient {
  start?(): Promise<void>
  stop?(): Promise<void>
  getGatewayUrl?(): Promise<string>
  sendText(target: QQReplyTarget, text: string): Promise<void>
  sendMedia(target: QQReplyTarget, part: QQOutboundPart): Promise<void>
}

export interface QQSessionStore {
  getSessionId(event: QQInboundEvent): Promise<string>
}

export interface QQDedupeStore {
  has(messageId: string): Promise<boolean>
  mark(messageId: string, ttlSeconds?: number): Promise<void>
}

export interface QQMediaPipeline {
  buildEnvelope(message: QQNormalizedMessage): Promise<QQButlerEnvelope>
}

export interface QQReplyRenderer {
  render(text: string): QQOutboundPart[]
}

export interface QQBotServiceHandlerResult {
  replyText?: string
  replyParts?: QQOutboundPart[]
}

export type QQBotServiceHandler =
  | ((input: {
      event: QQInboundEvent
      message: QQNormalizedMessage
      envelope: QQButlerEnvelope
    }) => Promise<string | QQOutboundPart[] | QQBotServiceHandlerResult | void>)
  | undefined

export interface QQBotLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  debug?(message: string): void
}
