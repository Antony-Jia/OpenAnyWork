import { butlerManager } from "../../butler/manager"
import type { ButlerExternalSendResult } from "../../types"
import type { QQButlerEnvelope } from "../../../../packages/openwork-qqbot/src/index.js"

export interface QQButlerAdapterResult extends ButlerExternalSendResult {
  replyText: string
}

export async function sendQQEnvelopeToButler(
  envelope: QQButlerEnvelope
): Promise<QQButlerAdapterResult> {
  const result = await butlerManager.sendExternal({
    source: "qqbot",
    message: envelope.text,
    senderOpenId: envelope.senderOpenId,
    senderName: envelope.senderName,
    messageId: envelope.messageId
  })

  const replyText = [result.assistantText, result.taskSummary].filter(Boolean).join("\n\n").trim()

  return {
    ...result,
    replyText: replyText || "已收到消息，但当前没有可发送的回复。"
  }
}
