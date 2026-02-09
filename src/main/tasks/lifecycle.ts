import { EventEmitter } from "events"
import { getThread } from "../db"
import type { ThreadMode } from "../types"

export interface TaskStartedPayload {
  threadId: string
  mode: ThreadMode
  title?: string
  source: "agent" | "loop" | "email" | "butler"
  startedAt: string
  metadata: Record<string, unknown>
}

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

export interface TaskStartedInput {
  threadId: string
  source: TaskStartedPayload["source"]
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

function buildBasePayload(threadId: string): {
  row: ReturnType<typeof getThread>
  metadata: Record<string, unknown>
  mode: ThreadMode
} {
  const row = getThread(threadId)
  const metadata = row?.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {}
  const mode = normalizeMode(metadata)
  return { row, metadata, mode }
}

export function emitTaskStarted(input: TaskStartedInput): void {
  const { row, metadata, mode } = buildBasePayload(input.threadId)
  const payload: TaskStartedPayload = {
    threadId: input.threadId,
    mode,
    title: row?.title ?? undefined,
    source: input.source,
    startedAt: new Date().toISOString(),
    metadata
  }
  lifecycleEmitter.emit("task:started", payload)
}

export function emitTaskCompleted(input: TaskCompletionInput): void {
  const { row, metadata, mode } = buildBasePayload(input.threadId)

  const payload: TaskCompletionPayload = {
    threadId: input.threadId,
    mode,
    title: row?.title ?? undefined,
    result: input.result,
    error: input.error,
    source: input.source,
    finishedAt: new Date().toISOString(),
    metadata
  }

  lifecycleEmitter.emit("task:completed", payload)
}

export function onTaskStarted(listener: (payload: TaskStartedPayload) => void): () => void {
  lifecycleEmitter.on("task:started", listener)
  return () => lifecycleEmitter.off("task:started", listener)
}

export function onTaskCompleted(listener: (payload: TaskCompletionPayload) => void): () => void {
  lifecycleEmitter.on("task:completed", listener)
  return () => lifecycleEmitter.off("task:completed", listener)
}
