import {
  QQBotService as ComponentQQBotService,
  type QQBotServiceHandlerResult,
  type QQBotLogger
} from "../../../../packages/openwork-qqbot/src/index.js"
import { loadQQBotBridgeConfig } from "./config"
import { sendQQEnvelopeToButler } from "./butler-adapter"

interface PendingChoiceOwner {
  senderOpenId: string
  senderName?: string
  messageId: string
}

class OpenworkQQBotBridgeService {
  private service: ComponentQQBotService | null = null
  private pendingChoiceOwner: PendingChoiceOwner | null = null
  private serial = Promise.resolve()
  private readonly logger: QQBotLogger = {
    info: (message) => console.log(`[openwork-qqbot-bridge] ${message}`),
    warn: (message) => console.warn(`[openwork-qqbot-bridge] ${message}`),
    error: (message) => console.error(`[openwork-qqbot-bridge] ${message}`)
  }

  async start(): Promise<void> {
    const resolved = loadQQBotBridgeConfig()
    if (!resolved.enabled || !resolved.config) {
      this.logger.info(`disabled: ${resolved.reason || "config incomplete"}`)
      return
    }

    this.service = new ComponentQQBotService({
      config: resolved.config,
      logger: this.logger,
      handler: (payload) =>
        this.enqueue(async () => {
          if (
            this.pendingChoiceOwner &&
            this.pendingChoiceOwner.senderOpenId !== payload.message.senderOpenId
          ) {
            return {
              replyText: [
                "当前有一条待确认的管家方案，正在等待上一位发起者处理。",
                `发起者: ${this.pendingChoiceOwner.senderName || this.pendingChoiceOwner.senderOpenId}`,
                "请稍后再发送，或等待当前确认完成。"
              ].join("\n")
            } satisfies QQBotServiceHandlerResult
          }

          const result = await sendQQEnvelopeToButler(payload.envelope)
          if (result.pendingChoice) {
            this.pendingChoiceOwner = {
              senderOpenId: payload.message.senderOpenId,
              senderName: payload.message.senderName,
              messageId: payload.message.messageId
            }
          } else if (this.pendingChoiceOwner?.senderOpenId === payload.message.senderOpenId) {
            this.pendingChoiceOwner = null
          }

          return {
            replyText: result.replyText
          } satisfies QQBotServiceHandlerResult
        })
    })

    await this.service.start()
    this.logger.info("started")
  }

  async stop(): Promise<void> {
    this.pendingChoiceOwner = null
    await this.service?.stop()
    this.service = null
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.serial.then(job, job)
    this.serial = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}

const bridgeService = new OpenworkQQBotBridgeService()

export async function startQQBotBridgeService(): Promise<void> {
  await bridgeService.start()
}

export async function stopQQBotBridgeService(): Promise<void> {
  await bridgeService.stop()
}
