import {
  DefaultQQApiClient,
  QQBotService as ComponentQQBotService,
  type QQApiClient,
  type QQBotServiceHandlerResult,
  type QQBotLogger,
  type QQReplyTarget
} from "../../../../packages/openwork-qqbot/src/index.js"
import { getThread } from "../../db"
import { butlerManager } from "../../butler/manager"
import type { QQExternalSourceInfo, TaskLifecycleNotice } from "../../types"
import { loadQQBotBridgeConfig } from "./config"
import { QQRecipientDigestService } from "./recipient-digest"
import { sendQQEnvelopeToButler } from "./butler-adapter"

const TASK_NOTICE_MARKER = "[TASK_NOTICE_JSON]"
const TASK_DIGEST_MARKER = "[TASK_DIGEST_JSON]"

interface PendingChoiceOwner {
  senderOpenId: string
  senderName?: string
  messageId: string
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function isQQMessageScene(value: unknown): value is QQExternalSourceInfo["messageType"] {
  return value === "c2c" || value === "group" || value === "guild" || value === "dm"
}

function isQQReplyTargetInfo(value: unknown): value is QQExternalSourceInfo["replyTarget"] {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return isQQMessageScene(record.scene)
}

function isQQExternalSourceInfo(value: unknown): value is QQExternalSourceInfo {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    record.source === "qqbot" &&
    typeof record.senderOpenId === "string" &&
    typeof record.messageId === "string" &&
    isQQMessageScene(record.messageType) &&
    typeof record.timestamp === "string" &&
    isQQReplyTargetInfo(record.replyTarget) &&
    typeof record.originalText === "string" &&
    Array.isArray(record.attachmentPaths) &&
    Array.isArray(record.voiceNotes)
  )
}

function stripNoticeMarkers(text: string): string {
  return text
    .replace(new RegExp(`${TASK_DIGEST_MARKER}[\\s\\S]*$`), "")
    .replace(new RegExp(`${TASK_NOTICE_MARKER}[\\s\\S]*$`), "")
    .trim()
}

function cloneProactiveTarget(target: QQExternalSourceInfo["replyTarget"]): QQReplyTarget {
  return {
    scene: target.scene,
    userId: target.userId,
    groupId: target.groupId,
    channelId: target.channelId,
    guildId: target.guildId
  }
}

function buildLifecycleReplyText(notice: TaskLifecycleNotice): string {
  const lines = [
    notice.phase === "started" ? "管家任务已开始" : "管家任务有新进展",
    `标题: ${notice.title}`
  ]
  if (notice.resultBrief?.trim()) {
    lines.push(`摘要: ${notice.resultBrief.trim()}`)
  }
  if (notice.threadId.trim()) {
    lines.push(`线程: ${notice.threadId}`)
  }
  return lines.join("\n")
}

class OpenworkQQBotBridgeService {
  private service: ComponentQQBotService | null = null
  private apiClient: QQApiClient | null = null
  private recipientDigestService: QQRecipientDigestService | null = null
  private pendingChoiceOwner: PendingChoiceOwner | null = null
  private serial = Promise.resolve()
  private unsubscribeMessageListener: (() => void) | null = null
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

    this.apiClient = new DefaultQQApiClient(resolved.config)
    this.service = new ComponentQQBotService({
      config: resolved.config,
      logger: this.logger,
      apiClient: this.apiClient,
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

    this.recipientDigestService = new QQRecipientDigestService({
      summarize: (input) => butlerManager.summarizeDigest(input),
      send: async (externalSource, text) => {
        await this.sendProactiveText(externalSource, text)
      },
      logger: this.logger
    })
    this.recipientDigestService.start()

    this.unsubscribeMessageListener = butlerManager.onMessageAppended((message) => {
      if (message.role !== "assistant" || message.kind !== "event_comment") {
        return
      }
      const externalSource =
        this.readExternalSourceFromRecord(message.metadata) ||
        this.resolveExternalSourceByThreadId(message.relatedThreadId)
      if (!externalSource) return

      const text = stripNoticeMarkers(message.content)
      if (!text) return
      void this.enqueue(() => this.sendProactiveText(externalSource, text))
    })

    await this.service.start()
    this.logger.info("started")
  }

  async stop(): Promise<void> {
    this.pendingChoiceOwner = null
    this.unsubscribeMessageListener?.()
    this.unsubscribeMessageListener = null
    this.recipientDigestService?.stop()
    this.recipientDigestService = null
    await this.service?.stop()
    this.service = null
    this.apiClient = null
  }

  refreshDigestInterval(): void {
    this.recipientDigestService?.refreshInterval()
  }

  notifyLifecycleNotice(notice: TaskLifecycleNotice): void {
    if (!this.service || !this.apiClient) return
    const externalSource = this.resolveExternalSourceByThreadId(notice.threadId)
    if (!externalSource) return

    void this.enqueue(() => this.sendProactiveText(externalSource, buildLifecycleReplyText(notice)))
    this.recipientDigestService?.ingest(notice, externalSource)
  }

  private readExternalSourceFromRecord(
    record?: Record<string, unknown>
  ): QQExternalSourceInfo | undefined {
    const externalSource = record?.externalSource
    if (isQQExternalSourceInfo(externalSource)) {
      return externalSource
    }
    return undefined
  }

  private resolveExternalSourceByThreadId(threadId?: string): QQExternalSourceInfo | undefined {
    const normalizedThreadId = threadId?.trim()
    if (!normalizedThreadId) return undefined

    const row = getThread(normalizedThreadId)
    const metadata = parseMetadata(row?.metadata ?? null)
    return this.readExternalSourceFromRecord(metadata)
  }

  private async sendProactiveText(
    externalSource: QQExternalSourceInfo,
    text: string
  ): Promise<void> {
    const normalized = text.trim()
    if (!normalized) return
    if (!this.apiClient) {
      this.logger.warn("skip proactive qq send: api client unavailable")
      return
    }

    try {
      await this.apiClient.sendText(cloneProactiveTarget(externalSource.replyTarget), normalized)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(
        `failed proactive qq send to ${externalSource.senderOpenId} (${externalSource.replyTarget.scene}): ${message}`
      )
    }
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

export function notifyQQBotLifecycleNotice(notice: TaskLifecycleNotice): void {
  bridgeService.notifyLifecycleNotice(notice)
}

export function refreshQQBotBridgeDigestInterval(): void {
  bridgeService.refreshDigestInterval()
}
