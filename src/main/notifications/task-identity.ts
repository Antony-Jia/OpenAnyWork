import type { TaskCompletionPayload, TaskStartedPayload } from "../tasks/lifecycle"
import type { TaskLifecycleNotice } from "../types"

interface MetadataCarrier {
  metadata: Record<string, unknown>
  threadId: string
}

function compactIdentity(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function resolveStableTaskIdentityFromMetadata(metadata: Record<string, unknown>): string | null {
  const butlerTaskId = compactIdentity(metadata.butlerTaskId)
  if (butlerTaskId) {
    return `butlerTask:${butlerTaskId}`
  }

  const taskKey = compactIdentity(metadata.taskKey)
  if (taskKey) {
    return `taskKey:${taskKey}`
  }

  return null
}

export function resolveTaskIdentityFromCarrier(payload: MetadataCarrier): string {
  return resolveStableTaskIdentityFromMetadata(payload.metadata) || `thread:${payload.threadId}`
}

export function resolveTaskIdentityFromCompletionPayload(payload: TaskCompletionPayload): string {
  return resolveTaskIdentityFromCarrier(payload)
}

export function resolveTaskIdentityFromStartedPayload(payload: TaskStartedPayload): string {
  return resolveTaskIdentityFromCarrier(payload)
}

export function resolveTaskIdentityFromLifecycleNotice(notice: TaskLifecycleNotice): string {
  const normalized = notice.taskIdentity?.trim()
  return normalized && normalized.length > 0 ? normalized : `thread:${notice.threadId}`
}
