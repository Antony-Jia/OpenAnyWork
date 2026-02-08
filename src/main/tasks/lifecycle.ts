import { EventEmitter } from "events"
import { getThread } from "../db"
import type { ThreadMode } from "../types"

export interface TaskCompletionPayload {
  threadId: string
  mode: ThreadMode
  title?: string
  result?: string
  error?: string
  source: "agent" | "loop" | "email" | "butler"
  finishedAt: string
  metadata: Record<string, unknown>
}

export interface TaskCompletionInput {
  threadId: string
  result?: string
  error?: string
  source: TaskCompletionPayload["source"]
}

const lifecycleEmitter = new EventEmitter()

function normalizeMode(metadata: Record<string, unknown>): ThreadMode {
  const mode = metadata.mode
  if (mode === "ralph" || mode === "email" || mode === "loop" || mode === "butler") {
    return mode
  }
  return "default"
}

export function emitTaskCompleted(input: TaskCompletionInput): void {
  const row = getThread(input.threadId)
  const metadata = row?.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {}

  const payload: TaskCompletionPayload = {
    threadId: input.threadId,
    mode: normalizeMode(metadata),
    title: row?.title ?? undefined,
    result: input.result,
    error: input.error,
    source: input.source,
    finishedAt: new Date().toISOString(),
    metadata
  }

  lifecycleEmitter.emit("task:completed", payload)
}

export function onTaskCompleted(listener: (payload: TaskCompletionPayload) => void): () => void {
  lifecycleEmitter.on("task:completed", listener)
  return () => lifecycleEmitter.off("task:completed", listener)
}
