import type { QQInboundEvent, QQSessionStore } from "./types.js"

export class MemoryQQSessionStore implements QQSessionStore {
  async getSessionId(event: QQInboundEvent): Promise<string> {
    if (event.scene === "group") {
      return `qq:group:${event.replyTarget.groupId ?? "unknown"}:${event.senderOpenId}`
    }
    if (event.scene === "guild") {
      return `qq:guild:${event.replyTarget.channelId ?? "unknown"}:${event.senderOpenId}`
    }
    if (event.scene === "dm") {
      return `qq:dm:${event.senderOpenId}`
    }
    return `qq:c2c:${event.senderOpenId}`
  }
}
