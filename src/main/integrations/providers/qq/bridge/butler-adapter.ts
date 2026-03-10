import { butlerManager } from "../../../../butler/manager"
import type { ButlerExternalSendResult } from "../../../../types"
import type { QQButlerEnvelope } from "../protocol/index.js"

export interface QQButlerAdapterResult extends ButlerExternalSendResult {
  replyText: string
}

export async function sendQQEnvelopeToButler(
  envelope: QQButlerEnvelope
): Promise<QQButlerAdapterResult> {
  const result = await butlerManager.sendExternal({
    source: "qqbot",
    message: envelope.text,
    externalSource: {
      source: "qqbot",
      senderOpenId: envelope.senderOpenId,
      senderName: envelope.senderName,
      messageId: envelope.messageId,
      messageType: envelope.messageType,
      timestamp: envelope.timestamp,
      replyTarget: envelope.replyTarget,
      originalText: envelope.originalText,
      attachmentPaths: envelope.attachmentPaths,
      voiceNotes: envelope.voiceNotes,
      sessionId: envelope.metadata.sessionId
    }
  })

  const replyText = [result.assistantText, result.taskSummary].filter(Boolean).join("\n\n").trim()

  return {
    ...result,
    replyText: replyText || "已收到消息，但当前没有可发送的回复。"
  }
}
