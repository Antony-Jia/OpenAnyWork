import { IpcMain, BrowserWindow } from "electron"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { Command } from "@langchain/langgraph"
import { createAgentRuntime } from "../agent/runtime"
import { getThread, updateThread as dbUpdateThread } from "../db"
import { hasThreadCheckpoint } from "../storage"
import { getSettings } from "../settings"
import { ensureDockerRunning, getDockerRuntimeConfig } from "../docker/session"
import { appendRalphLogEntry } from "../ralph-log"
import { runAgentStream } from "../agent/run"
import { extractAssistantChunkText } from "../agent/stream-utils"
import { runExpertPipeline } from "../expert/runner"
import { normalizeStoredExpertConfig } from "../expert/config"
import { ensureRalphPlan, runRalphWorkflow } from "../ralph/workflow"
import { emitTaskCompleted, emitTaskStarted } from "../tasks/lifecycle"
import { prepareIncomingMessage } from "../vision/message-preprocess"
import type {
  AgentInvokeParams,
  AgentResumeParams,
  AgentInterruptParams,
  AgentCancelParams,
  ContentBlock,
  RalphState,
  ThreadMode,
  RalphLogEntry
} from "../types"

// Track active runs for cancellation
const activeRuns = new Map<string, AbortController>()

export function getActiveRunCount(): number {
  return activeRuns.size
}

function parseMetadata(threadId: string): Record<string, unknown> {
  const row = getThread(threadId)
  return row?.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {}
}

function updateMetadata(threadId: string, updates: Record<string, unknown>): void {
  const current = parseMetadata(threadId)
  const next = {
    ...current,
    ...updates,
    ralph: {
      ...(current.ralph as Record<string, unknown> | undefined),
      ...(updates.ralph as Record<string, unknown> | undefined)
    }
  }
  dbUpdateThread(threadId, { metadata: JSON.stringify(next) })
}

function extractTextFromContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content.map((block) => (block.type === "text" && block.text ? block.text : "")).join("")
}

function appendAssistantOutput(current: string, chunk: unknown): string {
  const content = extractAssistantChunkText(chunk)
  if (!content) return current
  if (content.startsWith(current)) {
    return content
  }
  return current + content
}

export function registerAgentHandlers(ipcMain: IpcMain): void {
  console.log("[Agent] Registering agent handlers...")

  // Handle agent invocation with streaming
  ipcMain.on("agent:invoke", async (event, { threadId, message, modelId }: AgentInvokeParams) => {
    const channel = `agent:stream:${threadId}`
    const window = BrowserWindow.fromWebContents(event.sender)
    const messageText = extractTextFromContent(message)

    console.log("[Agent] Received invoke request:", {
      threadId,
      message: messageText.substring(0, 50),
      modelId
    })

    if (!window) {
      console.error("[Agent] No window found")
      return
    }

    // Abort any existing stream for this thread before starting a new one
    // This prevents concurrent streams which can cause checkpoint corruption
    const existingController = activeRuns.get(threadId)
    if (existingController) {
      console.log("[Agent] Aborting existing stream for thread:", threadId)
      existingController.abort()
      activeRuns.delete(threadId)
    }

    const abortController = new AbortController()
    activeRuns.set(threadId, abortController)

    // Abort the stream if the window is closed/destroyed
    const onWindowClosed = (): void => {
      console.log("[Agent] Window closed, aborting stream for thread:", threadId)
      abortController.abort()
    }
    window.once("closed", onWindowClosed)

    try {
      // Get workspace path from thread metadata - REQUIRED
      const thread = getThread(threadId)
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
      console.log("[Agent] Thread metadata:", metadata)

      const workspacePath = metadata.workspacePath as string | undefined
      await ensureDockerRunning()
      const dockerRuntime = getDockerRuntimeConfig()
      const dockerConfig = dockerRuntime.config ?? undefined
      const dockerContainerId = dockerRuntime.containerId ?? undefined

      if (!workspacePath) {
        window.webContents.send(channel, {
          type: "error",
          error: "WORKSPACE_REQUIRED",
          message: "请在发送消息前选择一个工作区文件夹。"
        })
        return
      }

      const mode = (metadata.mode as ThreadMode) || "default"
      const settings = getSettings()
      const normalizedWorkspace = workspacePath || ""
      const { processedMessage, processedText } = await prepareIncomingMessage({
        threadId,
        workspacePath: normalizedWorkspace,
        mode,
        message
      })
      const emitAgentStarted = (): void => {
        emitTaskStarted({
          threadId,
          source: "agent"
        })
      }
      const disableApprovalsForThread =
        metadata.disableApprovals === true || metadata.createdBy === "quick-input"

      if (mode === "ralph") {
        const emitRalphLog = (
          entry: Omit<RalphLogEntry, "id" | "ts" | "threadId" | "runId">
        ): void => {
          const fullEntry: RalphLogEntry = {
            id: randomUUID(),
            ts: new Date().toISOString(),
            threadId,
            runId: randomUUID(),
            ...entry
          }
          appendRalphLogEntry(threadId, fullEntry)
          window.webContents.send(channel, {
            type: "custom",
            data: { type: "ralph_log", entry: fullEntry }
          })
        }

        const trimmedMessage = processedText.trim()
        if (trimmedMessage) {
          emitRalphLog({
            role: "user",
            content: trimmedMessage,
            phase: (metadata.ralph as RalphState | undefined)?.phase
          })
        }

        const ralph = (metadata.ralph as RalphState) || {
          phase: "init",
          round: 0,
          iterations: 0,
          totalIterations: 0
        }
        const trimmed = trimmedMessage
        const isConfirm = trimmed.toLowerCase() === "/confirm"
        const runClassicRalphWorkflow = async (): Promise<void> => {
          updateMetadata(threadId, {
            ralph: {
              phase: "running",
              round: ralph.round ?? 0,
              iterations: ralph.iterations ?? 0,
              totalIterations: ralph.totalIterations ?? 0
            }
          })

          const workflowResult = await runRalphWorkflow({
            threadId,
            workspacePath: normalizedWorkspace,
            modelId,
            dockerConfig,
            dockerContainerId,
            window,
            channel,
            abortController,
            capabilityScope: "classic",
            perRoundIterationLimit: settings.ralphIterations || 5,
            mode: "classic",
            disableApprovals: true,
            initialRound: ralph.round ?? 0,
            initialTotalIterations: ralph.totalIterations ?? 0,
            updateRalphState: (updates) => {
              updateMetadata(threadId, { ralph: updates })
            },
            onAgentStarted: emitAgentStarted
          })

          if (abortController.signal.aborted || workflowResult.status === "aborted") {
            return
          }

          emitTaskCompleted({
            threadId,
            result: workflowResult.finalOutput || "Ralph workflow finished.",
            source: "agent"
          })
          window.webContents.send(channel, { type: "done" })
        }

        if (ralph.phase === "awaiting_confirm" && !isConfirm) {
          const planningMessage = trimmed || processedText
          const output = await ensureRalphPlan({
            threadId,
            workspacePath: normalizedWorkspace,
            modelId,
            dockerConfig,
            dockerContainerId,
            window,
            channel,
            abortController,
            capabilityScope: "classic",
            requireConfirm: true,
            userMessage: planningMessage,
            disableApprovals: true,
            onAgentStarted: emitAgentStarted,
            ralphLogPhase: "init"
          })
          updateMetadata(threadId, {
            ralph: {
              phase: "awaiting_confirm",
              round: 0,
              iterations: 0,
              totalIterations: 0
            }
          })
          if (!abortController.signal.aborted) {
            emitTaskCompleted({
              threadId,
              result: output,
              source: "agent"
            })
            window.webContents.send(channel, { type: "done" })
          }
          return
        }

        if (ralph.phase === "awaiting_continue" && !isConfirm) {
          window.webContents.send(channel, {
            type: "error",
            error: "RALPH_AWAITING_CONTINUE",
            message: "Ralph 检证建议继续执行。请回复 /confirm 继续下一轮。"
          })
          return
        }

        if (
          (ralph.phase === "awaiting_confirm" || ralph.phase === "awaiting_continue") &&
          isConfirm
        ) {
          const planPath = join(normalizedWorkspace, "ralph_plan.json")
          if (!existsSync(planPath)) {
            window.webContents.send(channel, {
              type: "error",
              error: "RALPH_PLAN_MISSING",
              message: "请在确认迭代前先生成 ralph_plan.json 文件。"
            })
            return
          }

          await runClassicRalphWorkflow()
          return
        }

        if (
          ralph.phase === "running" ||
          ralph.phase === "verifying" ||
          ralph.phase === "replanning"
        ) {
          // 检查是否有 checkpoint，如果有则说明是上次运行中断，自动重置状态
          if (hasThreadCheckpoint(threadId)) {
            console.log("[Agent] Ralph stuck in running state, resetting to awaiting_confirm")
            updateMetadata(threadId, {
              ralph: { phase: "awaiting_confirm", round: 0, iterations: 0, totalIterations: 0 }
            })
            window.webContents.send(channel, {
              type: "error",
              error: "RALPH_RESET",
              message: "检测到 Ralph 中断状态，已重置为等待确认。请重新描述需求或回复 /confirm。"
            })
            return
          } else {
            window.webContents.send(channel, {
              type: "error",
              error: "RALPH_RUNNING",
              message: "Ralph 正在运行中，请等待完成。"
            })
            return
          }
        }

        if (ralph.phase === "done") {
          updateMetadata(threadId, {
            ralph: { phase: "init", round: 0, iterations: 0, totalIterations: 0 }
          })
        }

        if (ralph.phase === "init" || ralph.phase === "done") {
          const planningMessage = trimmed || processedText
          const output = await ensureRalphPlan({
            threadId,
            workspacePath: normalizedWorkspace,
            modelId,
            dockerConfig,
            dockerContainerId,
            window,
            channel,
            abortController,
            capabilityScope: "classic",
            requireConfirm: true,
            userMessage: planningMessage,
            disableApprovals: true,
            onAgentStarted: emitAgentStarted,
            ralphLogPhase: ralph.phase
          })
          updateMetadata(threadId, {
            ralph: {
              phase: "awaiting_confirm",
              round: 0,
              iterations: 0,
              totalIterations: 0
            }
          })
          if (!abortController.signal.aborted) {
            emitTaskCompleted({
              threadId,
              result: output,
              source: "agent"
            })
            window.webContents.send(channel, { type: "done" })
          }
          return
        }
      }

      if (mode === "email") {
        emitAgentStarted()
        const output = await runAgentStream({
          threadId,
          workspacePath: normalizedWorkspace,
          modelId,
          dockerConfig,
          dockerContainerId,
          disableApprovals: disableApprovalsForThread,
          message: processedMessage,
          window,
          channel,
          abortController,
          threadMode: mode,
          capabilityScope: "classic",
          forceToolNames: ["send_email"]
        })

        if (!abortController.signal.aborted) {
          emitTaskCompleted({
            threadId,
            result: output,
            source: "agent"
          })
          window.webContents.send(channel, { type: "done" })
        }
        return
      }

      if (mode === "expert") {
        const expertConfig = normalizeStoredExpertConfig(metadata.expert)
        if (!expertConfig) {
          window.webContents.send(channel, {
            type: "error",
            error: "EXPERT_CONFIG_MISSING",
            message: "请先配置专家模式（至少一位专家，且填写角色与 prompt）。"
          })
          return
        }

        emitAgentStarted()
        const output = await runExpertPipeline({
          threadId,
          expertConfig,
          message: processedMessage,
          workspacePath: normalizedWorkspace,
          modelId,
          dockerConfig,
          dockerContainerId,
          capabilityScope: "classic",
          window,
          channel,
          abortController
        })

        if (!abortController.signal.aborted) {
          emitTaskCompleted({
            threadId,
            result: output,
            source: "agent"
          })
          window.webContents.send(channel, { type: "done" })
        }
        return
      }

      emitAgentStarted()
      const output = await runAgentStream({
        threadId,
        workspacePath: normalizedWorkspace,
        modelId,
        dockerConfig,
        dockerContainerId,
        disableApprovals: disableApprovalsForThread,
        message: processedMessage,
        window,
        channel,
        abortController,
        threadMode: mode,
        capabilityScope: "classic"
      })

      if (!abortController.signal.aborted) {
        emitTaskCompleted({
          threadId,
          result: output,
          source: "agent"
        })
        window.webContents.send(channel, { type: "done" })
      }
    } catch (error) {
      // Ignore abort-related errors (expected when stream is cancelled)
      const isAbortError =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("aborted") ||
          error.message.includes("Controller is already closed"))

      if (!isAbortError) {
        console.error("[Agent] Error:", error)
        emitTaskCompleted({
          threadId,
          error: error instanceof Error ? error.message : "Unknown error",
          source: "agent"
        })
        window.webContents.send(channel, {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    } finally {
      window.removeListener("closed", onWindowClosed)
      activeRuns.delete(threadId)
    }
  })

  // Handle agent resume (after interrupt approval/rejection via useStream)
  ipcMain.on("agent:resume", async (event, { threadId, command, modelId }: AgentResumeParams) => {
    const channel = `agent:stream:${threadId}`
    const window = BrowserWindow.fromWebContents(event.sender)

    console.log("[Agent] Received resume request:", { threadId, command, modelId })

    if (!window) {
      console.error("[Agent] No window found for resume")
      return
    }

    // Get workspace path from thread metadata
    const thread = getThread(threadId)
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
    const workspacePath = metadata.workspacePath as string | undefined
    const threadMode = (metadata.mode as ThreadMode) || "default"
    await ensureDockerRunning()
    const dockerRuntime = getDockerRuntimeConfig()
    const dockerConfig = dockerRuntime.config ?? undefined
    const dockerContainerId = dockerRuntime.containerId ?? undefined

    if (!workspacePath) {
      window.webContents.send(channel, {
        type: "error",
        error: "需要工作区路径"
      })
      return
    }

    // Abort any existing stream before resuming
    const existingController = activeRuns.get(threadId)
    if (existingController) {
      existingController.abort()
      activeRuns.delete(threadId)
    }

    const abortController = new AbortController()
    activeRuns.set(threadId, abortController)

    try {
      emitTaskStarted({
        threadId,
        source: "agent"
      })
      const agent = await createAgentRuntime({
        threadId,
        workspacePath: workspacePath || "",
        modelId,
        dockerConfig,
        dockerContainerId,
        threadMode,
        capabilityScope: "classic"
      })
      const config = {
        configurable: { thread_id: threadId },
        signal: abortController.signal,
        streamMode: ["messages", "values"] as Array<"messages" | "values">,
        recursionLimit: 1000
      }

      // Resume from checkpoint by streaming with Command containing the decision
      // The HITL middleware expects { decisions: [{ type: 'approve' | 'reject' | 'edit' }] }
      const decisionType = command?.resume?.decision || "approve"
      const resumeValue = { decisions: [{ type: decisionType }] }
      const stream = await agent.stream(new Command({ resume: resumeValue }), config)
      let lastAssistant = ""

      for await (const chunk of stream) {
        if (abortController.signal.aborted) break

        const [mode, data] = chunk as unknown as [string, unknown]
        if (mode === "messages") {
          lastAssistant = appendAssistantOutput(lastAssistant, data)
        }
        window.webContents.send(channel, {
          type: "stream",
          mode,
          data: JSON.parse(JSON.stringify(data))
        })
      }

      if (!abortController.signal.aborted) {
        emitTaskCompleted({
          threadId,
          result: lastAssistant.trim() || "Agent resume completed.",
          source: "agent"
        })
        window.webContents.send(channel, { type: "done" })
      }
    } catch (error) {
      const isAbortError =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("aborted") ||
          error.message.includes("Controller is already closed"))

      if (!isAbortError) {
        console.error("[Agent] Resume error:", error)
        emitTaskCompleted({
          threadId,
          error: error instanceof Error ? error.message : "Unknown error",
          source: "agent"
        })
        window.webContents.send(channel, {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    } finally {
      activeRuns.delete(threadId)
    }
  })

  // Handle HITL interrupt response
  ipcMain.on("agent:interrupt", async (event, { threadId, decision }: AgentInterruptParams) => {
    const channel = `agent:stream:${threadId}`
    const window = BrowserWindow.fromWebContents(event.sender)

    if (!window) {
      console.error("[Agent] No window found for interrupt response")
      return
    }

    // Get workspace path from thread metadata - REQUIRED
    const thread = getThread(threadId)
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
    const workspacePath = metadata.workspacePath as string | undefined
    const modelId = metadata.model as string | undefined
    const threadMode = (metadata.mode as ThreadMode) || "default"
    await ensureDockerRunning()
    const dockerRuntime = getDockerRuntimeConfig()
    const dockerConfig = dockerRuntime.config ?? undefined
    const dockerContainerId = dockerRuntime.containerId ?? undefined

    if (!workspacePath) {
      window.webContents.send(channel, {
        type: "error",
        error: "需要工作区路径"
      })
      return
    }

    // Abort any existing stream before continuing
    const existingController = activeRuns.get(threadId)
    if (existingController) {
      existingController.abort()
      activeRuns.delete(threadId)
    }

    const abortController = new AbortController()
    activeRuns.set(threadId, abortController)

    try {
      emitTaskStarted({
        threadId,
        source: "agent"
      })
      const agent = await createAgentRuntime({
        threadId,
        workspacePath: workspacePath || "",
        modelId,
        dockerConfig,
        dockerContainerId,
        threadMode,
        capabilityScope: "classic"
      })
      const config = {
        configurable: { thread_id: threadId },
        signal: abortController.signal,
        streamMode: ["messages", "values"] as Array<"messages" | "values">,
        recursionLimit: 1000
      }

      if (decision.type === "approve") {
        // Resume execution by invoking with null (continues from checkpoint)
        const stream = await agent.stream(null, config)
        let lastAssistant = ""

        for await (const chunk of stream) {
          if (abortController.signal.aborted) break

          const [mode, data] = chunk as unknown as [string, unknown]
          if (mode === "messages") {
            lastAssistant = appendAssistantOutput(lastAssistant, data)
          }
          window.webContents.send(channel, {
            type: "stream",
            mode,
            data: JSON.parse(JSON.stringify(data))
          })
        }

        if (!abortController.signal.aborted) {
          emitTaskCompleted({
            threadId,
            result: lastAssistant.trim() || "Agent interrupt approval completed.",
            source: "agent"
          })
          window.webContents.send(channel, { type: "done" })
        }
      } else if (decision.type === "reject") {
        emitTaskCompleted({
          threadId,
          result: "用户拒绝本次工具执行，流程结束。",
          source: "agent"
        })
        window.webContents.send(channel, { type: "done" })
      }
      // edit case handled similarly to approve with modified args
    } catch (error) {
      const isAbortError =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("aborted") ||
          error.message.includes("Controller is already closed"))

      if (!isAbortError) {
        console.error("[Agent] Interrupt error:", error)
        emitTaskCompleted({
          threadId,
          error: error instanceof Error ? error.message : "Unknown error",
          source: "agent"
        })
        window.webContents.send(channel, {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    } finally {
      activeRuns.delete(threadId)
    }
  })

  // Handle cancellation
  ipcMain.handle("agent:cancel", async (_event, { threadId }: AgentCancelParams) => {
    const thread = getThread(threadId)
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
    if (metadata.nonInterruptible === true) {
      console.log("[Agent] Cancellation ignored for non-interruptible thread:", threadId)
      return
    }

    const controller = activeRuns.get(threadId)
    if (controller) {
      controller.abort()
      activeRuns.delete(threadId)
    }
  })
}
