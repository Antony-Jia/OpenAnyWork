import { randomUUID } from "node:crypto"
import type { BrowserWindow } from "electron"
import { appendExpertLogEntry } from "../expert-log"
import { runAgentStream } from "../agent/run"
import type {
  CapabilityScope,
  ContentBlock,
  DockerConfig,
  ExpertConfig,
  ExpertLogEntry
} from "../types"

const EXPERT_RESULT_START = "<EXPERT_RESULT_JSON>"
const EXPERT_RESULT_END = "</EXPERT_RESULT_JSON>"
const FALLBACK_SUMMARY_MAX = 1200

interface ParsedExpertResult {
  visibleContent: string
  summary: string
  handoff: string
  stop: boolean
  stopReason?: string
  degraded: boolean
  degradedReason?: string
}

function extractTextFromContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content.map((block) => (block.type === "text" && block.text ? block.text : "")).join("")
}

function compactText(text: string, maxLength = FALLBACK_SUMMARY_MAX): string {
  const compacted = text.trim().replace(/\s+/g, " ")
  if (compacted.length <= maxLength) return compacted
  return `${compacted.slice(0, maxLength - 1)}...`
}

function extractJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    const first = raw.indexOf("{")
    const last = raw.lastIndexOf("}")
    if (first >= 0 && last > first) {
      return JSON.parse(raw.slice(first, last + 1))
    }
    throw new Error("No valid JSON object found.")
  }
}

function stripResultPayload(text: string): string {
  return text.replace(/<EXPERT_RESULT_JSON>[\s\S]*?<\/EXPERT_RESULT_JSON>/g, "").trim()
}

function parseExpertResult(rawOutput: string, params: { canStop: boolean }): ParsedExpertResult {
  const trimmedRaw = rawOutput.trim()
  const visibleContent = stripResultPayload(trimmedRaw)
  const fallback = compactText(visibleContent || trimmedRaw || "无可用输出")

  const matches = [...trimmedRaw.matchAll(/<EXPERT_RESULT_JSON>([\s\S]*?)<\/EXPERT_RESULT_JSON>/g)]
  const payloadText = matches.length > 0 ? matches[matches.length - 1]?.[1]?.trim() || "" : ""

  if (!payloadText) {
    return {
      visibleContent: visibleContent || fallback,
      summary: fallback,
      handoff: fallback,
      stop: false,
      degraded: true,
      degradedReason: "missing_json_payload"
    }
  }

  let parsed: Record<string, unknown>
  try {
    const value = extractJsonObject(payloadText)
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Payload must be an object.")
    }
    parsed = value as Record<string, unknown>
  } catch {
    return {
      visibleContent: visibleContent || fallback,
      summary: fallback,
      handoff: fallback,
      stop: false,
      degraded: true,
      degradedReason: "invalid_json_payload"
    }
  }

  const summaryRaw = typeof parsed.summary === "string" ? parsed.summary.trim() : ""
  const handoffRaw = typeof parsed.handoff === "string" ? parsed.handoff.trim() : ""
  const stopReasonRaw = typeof parsed.stopReason === "string" ? parsed.stopReason.trim() : ""

  let stop = parsed.stop === true
  if (stop && !params.canStop) {
    stop = false
  }

  const summary = summaryRaw || fallback
  const handoff = handoffRaw || summary
  const degraded =
    summaryRaw.length === 0 || handoffRaw.length === 0 || (parsed.stop === true && !stop)

  return {
    visibleContent: visibleContent || summary,
    summary,
    handoff,
    stop,
    stopReason: stopReasonRaw || undefined,
    degraded,
    degradedReason: degraded ? "partial_payload_or_invalid_stop" : undefined
  }
}

function buildExpertSystemPrompt(params: {
  role: string
  rolePrompt: string
  isLastExpert: boolean
  loopEnabled: boolean
}): string {
  const stopConstraint =
    params.loopEnabled && params.isLastExpert
      ? "You MAY set stop=true only when no further revision is required."
      : "You MUST set stop=false."

  return [
    "You are participating in a sequential expert pipeline.",
    `Your assigned role: ${params.role}`,
    "[Role Prompt]",
    params.rolePrompt,
    "",
    "Return your normal response, then append EXACTLY one JSON payload wrapped by markers:",
    `${EXPERT_RESULT_START}{"summary":"...","handoff":"...","stop":false,"stopReason":""}${EXPERT_RESULT_END}`,
    "",
    "JSON requirements:",
    "- summary: concise result of your current step.",
    "- handoff: actionable handoff text for the next expert.",
    `- ${stopConstraint}`,
    "- stopReason: reason when stop=true, else empty string.",
    "- Output valid JSON object only inside markers."
  ].join("\n")
}

function buildExpertInput(params: {
  userText: string
  incomingHandoff: string
  cycle: number
  maxCycles: number
  expertIndex: number
  totalExperts: number
}): string {
  return [
    `[Original User Request]`,
    params.userText,
    "",
    `[Pipeline State]`,
    `cycle=${params.cycle}/${params.maxCycles}`,
    `expert=${params.expertIndex + 1}/${params.totalExperts}`,
    "",
    `[Incoming Handoff]`,
    params.incomingHandoff
  ].join("\n")
}

function buildNextHandoff(params: { fromRole: string; summary: string; handoff: string }): string {
  return [
    `[Upstream Expert] ${params.fromRole}`,
    `[Summary] ${params.summary}`,
    `[Handoff]`,
    params.handoff
  ].join("\n")
}

function appendPipelineLog(params: {
  window: BrowserWindow
  channel: string
  threadId: string
  runId: string
  entry: Omit<ExpertLogEntry, "id" | "ts" | "threadId" | "runId">
}): void {
  const fullEntry: ExpertLogEntry = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    threadId: params.threadId,
    runId: params.runId,
    ...params.entry
  }

  appendExpertLogEntry(params.threadId, fullEntry)
  params.window.webContents.send(params.channel, {
    type: "custom",
    data: { type: "expert_log", entry: fullEntry }
  })
}

export async function runExpertPipeline(params: {
  threadId: string
  expertConfig: ExpertConfig
  message: string | ContentBlock[]
  workspacePath: string
  modelId?: string
  dockerConfig?: DockerConfig | null
  dockerContainerId?: string | null
  capabilityScope: CapabilityScope
  window: BrowserWindow
  channel: string
  abortController: AbortController
}): Promise<string> {
  const {
    threadId,
    expertConfig,
    message,
    workspacePath,
    modelId,
    dockerConfig,
    dockerContainerId,
    capabilityScope,
    window,
    channel,
    abortController
  } = params

  const runId = randomUUID()
  const userText = extractTextFromContent(message).trim()
  if (!userText) {
    throw new Error("Expert mode currently supports text input only.")
  }

  const maxCycles = expertConfig.loop.enabled ? expertConfig.loop.maxCycles : 1
  const totalExperts = expertConfig.experts.length
  let cyclesCompleted = 0
  let haltedByStop = false
  let lastSummary = ""
  let stopReason = ""
  let cycleSeedHandoff = userText

  appendPipelineLog({
    window,
    channel,
    threadId,
    runId,
    entry: {
      role: "user",
      content: userText
    }
  })

  cycleLoop: for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    if (abortController.signal.aborted) break
    cyclesCompleted = cycle

    appendPipelineLog({
      window,
      channel,
      threadId,
      runId,
      entry: {
        role: "system",
        cycle,
        content: `开始执行专家流水线，第 ${cycle}/${maxCycles} 轮。`
      }
    })

    let incomingHandoff = cycleSeedHandoff
    for (let idx = 0; idx < totalExperts; idx += 1) {
      if (abortController.signal.aborted) break cycleLoop

      const expert = expertConfig.experts[idx]
      const isLastExpert = idx === totalExperts - 1
      const canStop = expertConfig.loop.enabled && isLastExpert

      const output = await runAgentStream({
        threadId: expert.agentThreadId,
        workspacePath,
        modelId,
        dockerConfig,
        dockerContainerId,
        disableApprovals: true,
        extraSystemPrompt: buildExpertSystemPrompt({
          role: expert.role,
          rolePrompt: expert.prompt,
          isLastExpert,
          loopEnabled: expertConfig.loop.enabled
        }),
        threadMode: "expert",
        capabilityScope,
        message: buildExpertInput({
          userText,
          incomingHandoff,
          cycle,
          maxCycles,
          expertIndex: idx,
          totalExperts
        }),
        window,
        channel,
        abortController
      })

      if (abortController.signal.aborted) break cycleLoop

      const parsed = parseExpertResult(output, { canStop })
      incomingHandoff = buildNextHandoff({
        fromRole: expert.role,
        summary: parsed.summary,
        handoff: parsed.handoff
      })
      lastSummary = parsed.summary
      if (parsed.stop && parsed.stopReason) {
        stopReason = parsed.stopReason
      }

      appendPipelineLog({
        window,
        channel,
        threadId,
        runId,
        entry: {
          role: "expert",
          cycle,
          expertId: expert.id,
          expertRole: expert.role,
          content: parsed.visibleContent,
          summary: parsed.summary,
          handoff: parsed.handoff,
          stop: parsed.stop
        }
      })

      if (parsed.degraded) {
        appendPipelineLog({
          window,
          channel,
          threadId,
          runId,
          entry: {
            role: "system",
            cycle,
            expertId: expert.id,
            expertRole: expert.role,
            content: `结构化解析失败，已降级处理（${parsed.degradedReason || "unknown"}）。`
          }
        })
      }

      if (parsed.stop) {
        haltedByStop = true
        appendPipelineLog({
          window,
          channel,
          threadId,
          runId,
          entry: {
            role: "system",
            cycle,
            content: "最后专家已返回 stop=true，流水线提前结束。"
          }
        })
        break cycleLoop
      }
    }

    cycleSeedHandoff = incomingHandoff
  }

  if (abortController.signal.aborted) {
    appendPipelineLog({
      window,
      channel,
      threadId,
      runId,
      entry: {
        role: "system",
        content: "专家流水线已中断。"
      }
    })
  } else if (expertConfig.loop.enabled && !haltedByStop && cyclesCompleted >= maxCycles) {
    appendPipelineLog({
      window,
      channel,
      threadId,
      runId,
      entry: {
        role: "system",
        content: `已达到最大循环次数 ${maxCycles}，流水线结束。`
      }
    })
  }

  const stopLine = haltedByStop ? `stop=true${stopReason ? ` (${stopReason})` : ""}` : "stop=false"
  const summaryLine = lastSummary || "专家流水线执行完成。"
  return [
    "Expert pipeline completed.",
    `cycles=${cyclesCompleted}/${maxCycles}`,
    stopLine,
    `summary=${summaryLine}`
  ].join("\n")
}
