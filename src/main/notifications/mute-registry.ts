import { getSettings, updateSettings } from "../settings"

const MAX_MUTED_IDENTITIES = 5000
const TASK_IDENTITY_PATTERN = /^(butlerTask|taskKey|thread):.+/

function normalizeIdentity(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const item of items) {
    if (!item || seen.has(item)) continue
    seen.add(item)
    order.push(item)
  }
  return order
}

function sanitize(items: unknown[]): string[] {
  return dedupe(
    items
      .map((item) => normalizeIdentity(item))
      .filter((item) => item.length > 0 && TASK_IDENTITY_PATTERN.test(item))
      .slice(0, MAX_MUTED_IDENTITIES)
  )
}

export class NotificationMuteRegistry {
  private initialized = false
  private order: string[] = []
  private muted = new Set<string>()

  initialize(): void {
    if (this.initialized) return
    this.initialized = true
    const raw = getSettings().butler?.mutedTaskIdentities ?? []
    this.order = sanitize(raw)
    this.muted = new Set(this.order)
    if (this.shouldPersistRaw(raw, this.order)) {
      this.persist()
    }
  }

  list(): string[] {
    this.initialize()
    return [...this.order]
  }

  isMuted(taskIdentity?: string): boolean {
    this.initialize()
    const normalized = normalizeIdentity(taskIdentity)
    if (!normalized) return false
    return this.muted.has(normalized)
  }

  mute(taskIdentity: string): void {
    this.initialize()
    const normalized = normalizeIdentity(taskIdentity)
    if (!normalized || !TASK_IDENTITY_PATTERN.test(normalized)) return
    this.order = [normalized, ...this.order.filter((item) => item !== normalized)].slice(
      0,
      MAX_MUTED_IDENTITIES
    )
    this.muted = new Set(this.order)
    this.persist()
  }

  unmute(taskIdentity: string): void {
    this.initialize()
    const normalized = normalizeIdentity(taskIdentity)
    if (!normalized) return
    if (!this.muted.has(normalized)) return
    this.order = this.order.filter((item) => item !== normalized)
    this.muted = new Set(this.order)
    this.persist()
  }

  cleanupByButlerTaskIds(taskIds: string[]): void {
    this.initialize()
    if (taskIds.length === 0) return
    const target = new Set(
      taskIds.map((id) => normalizeIdentity(id)).filter((id) => id.length > 0).map((id) => `butlerTask:${id}`)
    )
    if (target.size === 0) return
    const next = this.order.filter((identity) => !target.has(identity))
    if (next.length === this.order.length) return
    this.order = next
    this.muted = new Set(this.order)
    this.persist()
  }

  cleanupByThreadId(threadId: string): void {
    this.initialize()
    const normalized = normalizeIdentity(threadId)
    if (!normalized) return
    const identity = `thread:${normalized}`
    if (!this.muted.has(identity)) return
    this.order = this.order.filter((item) => item !== identity)
    this.muted = new Set(this.order)
    this.persist()
  }

  compact(validTaskIdentities?: Set<string>): void {
    this.initialize()
    const next = this.order
      .filter((identity) => TASK_IDENTITY_PATTERN.test(identity))
      .filter((identity) => !validTaskIdentities || validTaskIdentities.has(identity))
      .slice(0, MAX_MUTED_IDENTITIES)

    if (next.length === this.order.length && next.every((value, index) => value === this.order[index])) {
      return
    }

    this.order = next
    this.muted = new Set(this.order)
    this.persist()
  }

  private persist(): void {
    const current = getSettings()
    updateSettings({
      butler: {
        ...current.butler,
        mutedTaskIdentities: this.order
      }
    })
  }

  private shouldPersistRaw(raw: unknown[], cleaned: string[]): boolean {
    if (raw.length !== cleaned.length) return true
    for (let index = 0; index < raw.length; index += 1) {
      if (normalizeIdentity(raw[index]) !== cleaned[index]) {
        return true
      }
    }
    return false
  }
}

export const notificationMuteRegistry = new NotificationMuteRegistry()
