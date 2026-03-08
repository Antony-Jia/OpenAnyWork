import type { QQDedupeStore } from "./types.js"

export class MemoryQQDedupeStore implements QQDedupeStore {
  private readonly entries = new Map<string, number>()

  async has(messageId: string): Promise<boolean> {
    this.compact()
    const expiresAt = this.entries.get(messageId)
    return typeof expiresAt === "number" && expiresAt > Date.now()
  }

  async mark(messageId: string, ttlSeconds = 600): Promise<void> {
    this.entries.set(messageId, Date.now() + ttlSeconds * 1000)
    this.compact()
  }

  private compact(): void {
    const now = Date.now()
    for (const [messageId, expiresAt] of this.entries) {
      if (expiresAt <= now) {
        this.entries.delete(messageId)
      }
    }
  }
}
