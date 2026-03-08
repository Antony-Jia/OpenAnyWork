import type { QQButlerEnvelope, QQButlerEnvelopeAttachment, QQNormalizedMessage } from "./types.js"

export function buildQQButlerEnvelope(
  message: QQNormalizedMessage,
  attachments: QQButlerEnvelopeAttachment[]
): QQButlerEnvelope {
  const attachmentPaths = attachments
    .map((attachment) => attachment.localPath ?? attachment.sourceUrl)
    .filter((value): value is string => Boolean(value))

  const voiceNotes = attachments
    .filter((attachment) => attachment.kind === "voice")
    .map((attachment) => attachment.transcription ?? attachment.transcriptionError ?? "voice transcription failed")

  const lines = [
    `senderOpenId: ${message.senderOpenId}`,
    `senderName: ${message.senderName ?? ""}`,
    `messageId: ${message.messageId}`,
    `messageType: ${message.scene}`,
    `timestamp: ${message.timestamp}`,
    `replyTarget: ${describeReplyTarget(message)}`,
    "originalText:",
    message.originalText || "(empty)",
    "attachments:",
    ...(attachmentPaths.length > 0 ? attachmentPaths.map((item) => `- ${item}`) : ["- none"]),
    "voiceNotes:",
    ...(voiceNotes.length > 0 ? voiceNotes.map((item) => `- ${item}`) : ["- none"])
  ]

  return {
    senderOpenId: message.senderOpenId,
    senderName: message.senderName,
    messageId: message.messageId,
    messageType: message.scene,
    timestamp: message.timestamp,
    replyTarget: message.replyTarget,
    originalText: message.originalText,
    attachmentPaths,
    voiceNotes,
    text: lines.join("\n"),
    attachments,
    metadata: {
      sessionId: message.sessionId
    }
  }
}

function describeReplyTarget(message: QQNormalizedMessage): string {
  if (message.replyTarget.scene === "group") {
    return `group:${message.replyTarget.groupId ?? "unknown"}`
  }
  if (message.replyTarget.scene === "guild") {
    return `guild:${message.replyTarget.channelId ?? "unknown"}`
  }
  if (message.replyTarget.scene === "dm") {
    return `dm:${message.replyTarget.userId ?? message.senderOpenId}`
  }
  return `c2c:${message.replyTarget.userId ?? message.senderOpenId}`
}
