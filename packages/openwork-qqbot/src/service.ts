import { DefaultQQApiClient } from "./api.js"
import { MemoryQQDedupeStore } from "./dedupe-store.js"
import { MockQQGateway } from "./gateway.js"
import { DefaultQQMediaPipeline } from "./media-pipeline.js"
import { DefaultQQReplyRenderer } from "./reply-renderer.js"
import { MemoryQQSessionStore } from "./session-store.js"
import type {
  QQApiClient,
  QQBotConfig,
  QQBotLogger,
  QQBotServiceHandler,
  QQBotServiceHandlerResult,
  QQDedupeStore,
  QQGateway,
  QQInboundEvent,
  QQMediaPipeline,
  QQNormalizedMessage,
  QQOutboundPart,
  QQReplyRenderer,
  QQSessionStore
} from "./types.js"

export interface QQBotServiceOptions {
  config: QQBotConfig
  handler?: QQBotServiceHandler
  apiClient?: QQApiClient
  gateway?: QQGateway
  sessionStore?: QQSessionStore
  dedupeStore?: QQDedupeStore
  mediaPipeline?: QQMediaPipeline
  replyRenderer?: QQReplyRenderer
  logger?: QQBotLogger
}

function defaultLogger(): QQBotLogger {
  return {
    info: (message) => console.log(`[openwork-qqbot] ${message}`),
    warn: (message) => console.warn(`[openwork-qqbot] ${message}`),
    error: (message) => console.error(`[openwork-qqbot] ${message}`)
  }
}

export class QQBotService {
  private readonly apiClient: QQApiClient
  private readonly gateway: QQGateway
  private readonly sessionStore: QQSessionStore
  private readonly dedupeStore: QQDedupeStore
  private readonly mediaPipeline: QQMediaPipeline
  private readonly replyRenderer: QQReplyRenderer
  private readonly logger: QQBotLogger

  constructor(private readonly options: QQBotServiceOptions) {
    this.apiClient = options.apiClient ?? new DefaultQQApiClient(options.config)
    this.gateway = options.gateway ?? new MockQQGateway()
    this.sessionStore = options.sessionStore ?? new MemoryQQSessionStore()
    this.dedupeStore = options.dedupeStore ?? new MemoryQQDedupeStore()
    this.mediaPipeline = options.mediaPipeline ?? new DefaultQQMediaPipeline(options.config)
    this.replyRenderer = options.replyRenderer ?? new DefaultQQReplyRenderer()
    this.logger = options.logger ?? defaultLogger()
    this.gateway.setListener((event) => this.handleEvent(event))
  }

  async start(): Promise<void> {
    this.logger.info("starting QQ bot service")
    await this.apiClient.start?.()
    await this.gateway.start()
  }

  async stop(): Promise<void> {
    this.logger.info("stopping QQ bot service")
    await this.gateway.stop()
    await this.apiClient.stop?.()
  }

  async handleEvent(event: QQInboundEvent): Promise<void> {
    if (await this.dedupeStore.has(event.messageId)) {
      this.logger.warn(`duplicate message ignored: ${event.messageId}`)
      return
    }

    const normalized = await this.normalizeMessage(event)
    await this.dedupeStore.mark(event.messageId)

    const envelope = await this.mediaPipeline.buildEnvelope(normalized)
    const result = await this.options.handler?.({
      event,
      message: normalized,
      envelope
    })

    const parts = this.resolveReplyParts(result)
    for (const part of parts) {
      if (part.type === "text") {
        await this.apiClient.sendText(normalized.replyTarget, part.value)
      } else {
        await this.apiClient.sendMedia(normalized.replyTarget, part)
      }
    }
  }

  private async normalizeMessage(event: QQInboundEvent): Promise<QQNormalizedMessage> {
    const sessionId = await this.sessionStore.getSessionId(event)
    return {
      ...event,
      sessionId,
      originalText: event.text
    }
  }

  private resolveReplyParts(
    result: string | QQOutboundPart[] | QQBotServiceHandlerResult | void
  ): QQOutboundPart[] {
    if (!result) return []
    if (typeof result === "string") {
      return this.replyRenderer.render(result)
    }
    if (Array.isArray(result)) {
      return result
    }
    if (result.replyParts && result.replyParts.length > 0) {
      return result.replyParts
    }
    if (result.replyText) {
      return this.replyRenderer.render(result.replyText)
    }
    return []
  }
}
