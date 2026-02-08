import { BrowserWindow } from "electron"
import { v4 as uuid } from "uuid"
import { createThread as dbCreateThread, getThread as dbGetThread, updateThread as dbUpdateThread } from "../db"
import { ensureDockerRunning, getDockerRuntimeConfig } from "../docker/session"
import { runAgentStream } from "../agent/run"
import { buildEmailModePrompt } from "../email/prompt"
import { emitTaskCompleted } from "../tasks/lifecycle"
import { loopManager } from "../loop/manager"
import { broadcastThreadsChanged } from "../ipc/events"
import { createButlerTaskFolder } from "./task-folder"
import type { ButlerTask, ButlerTaskHandoff, LoopConfig, ThreadMode } from "../types"

interface CreateButlerTaskInput {
  mode: Exclude<ThreadMode, "butler">
  prompt: string
  title: string
  rootPath: string
  requester: ButlerTask["requester"]
  loopConfig?: LoopConfig
  groupId?: string
  taskKey?: string
  dependsOnTaskIds?: string[]
  handoff?: ButlerTaskHandoff
  sourceTurnId?: string
  reuseThreadId?: string
}

interface ExecuteResult {
  result?: string
  error?: string
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function createButlerTaskThread(input: CreateButlerTaskInput): ButlerTask {
  const taskId = uuid()
  const workspacePath = createButlerTaskFolder(input.rootPath, input.mode)
  const nowIso = new Date().toISOString()
  const threadId = input.reuseThreadId || uuid()

  const metadataBase: Record<string, unknown> = input.reuseThreadId
    ? parseMetadata(dbGetThread(threadId)?.metadata ?? null)
    : {}

  const metadata: Record<string, unknown> = {
    ...metadataBase,
    mode: input.mode,
    workspacePath,
    createdBy: "butler",
    butlerTaskId: taskId,
    nonInterruptible: true,
    disableApprovals: true
  }

  if (input.mode === "ralph") {
    metadata.ralph = { phase: "init", iterations: 0 }
  }

  if (input.mode === "loop" && input.loopConfig) {
    metadata.loop = input.loopConfig
  }

  if (input.reuseThreadId) {
    dbUpdateThread(threadId, { metadata: JSON.stringify(metadata) })
  } else {
    dbCreateThread(threadId, metadata)
    dbUpdateThread(threadId, { title: input.title, metadata: JSON.stringify(metadata) })
  }
  broadcastThreadsChanged()

  return {
    id: taskId,
    threadId,
    mode: input.mode,
    title: input.title,
    prompt: input.prompt,
    workspacePath,
    createdAt: nowIso,
    status: "queued",
    requester: input.requester,
    loopConfig: input.loopConfig,
    groupId: input.groupId,
    taskKey: input.taskKey,
    dependsOnTaskIds: input.dependsOnTaskIds,
    handoff: input.handoff,
    sourceTurnId: input.sourceTurnId
  }
}

export async function executeButlerTask(task: ButlerTask): Promise<ExecuteResult> {
  try {
    if (task.mode === "loop") {
      const resolvedLoopConfig: LoopConfig =
        task.loopConfig ??
        ({
          enabled: true,
          contentTemplate: task.prompt,
          trigger: { type: "schedule", cron: "*/5 * * * *" },
          queue: { policy: "strict", mergeWindowSec: 300 },
          lastError: null
        } satisfies LoopConfig)
      loopManager.updateConfig(task.threadId, resolvedLoopConfig)
      loopManager.start(task.threadId)
      const result = "Loop task started and will run according to schedule."
      emitTaskCompleted({
        threadId: task.threadId,
        result,
        source: "butler"
      })
      return { result }
    }

    const window = BrowserWindow.getAllWindows()[0]
    if (!window) {
      throw new Error("No active window available for task execution.")
    }

    await ensureDockerRunning()
    const dockerRuntime = getDockerRuntimeConfig()
    const dockerConfig = dockerRuntime.config ?? undefined
    const dockerContainerId = dockerRuntime.containerId ?? undefined
    const abortController = new AbortController()
    const channel = `agent:stream:${task.threadId}`

    const result = await runAgentStream({
      threadId: task.threadId,
      workspacePath: task.workspacePath,
      dockerConfig,
      dockerContainerId,
      disableApprovals: true,
      message: task.prompt,
      window,
      channel,
      abortController,
      ...(task.mode === "email"
        ? {
            extraSystemPrompt: buildEmailModePrompt(task.threadId),
            forceToolNames: ["send_email"]
          }
        : {})
    })

    emitTaskCompleted({
      threadId: task.threadId,
      result,
      source: "butler"
    })
    return { result }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emitTaskCompleted({
      threadId: task.threadId,
      error: message,
      source: "butler"
    })
    return { error: message }
  }
}
