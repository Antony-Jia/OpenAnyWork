import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { BrowserWindow } from "electron"
import { closeCheckpointer } from "../agent/runtime"
import { runAgentStream } from "../agent/run"
import { deleteThreadCheckpoint } from "../storage"
import type { CapabilityScope, DockerConfig, RalphState } from "../types"

const RALPH_PLAN_FILE = "ralph_plan.json"
const RALPH_CONTEXT_FILE = "ralph_context.json"
const RALPH_VERIFICATION_FILE = "ralph_verification.json"
const RALPH_VERIFICATION_HISTORY_FILE = "ralph_verification_history.jsonl"
const RALPH_PROGRESS_FILE = "progress.txt"
const RALPH_DONE_FILE = ".ralph_done"
const RALPH_ONGOING_FILE = ".ralph_ongoing"

export const DEFAULT_RALPH_GLOBAL_ROUND_CAP = 50
const VERIFICATION_RETRY_LIMIT = 2

export interface RalphVerificationModification {
  priority: "high" | "medium" | "low"
  title: string
  details: string
  acceptanceImpact: string[]
}

export interface RalphVerificationResult {
  version: 1
  round: number
  shouldContinue: boolean
  summary: string
  completed: string[]
  gaps: string[]
  modifications: RalphVerificationModification[]
  nextActions: string[]
  risks: string[]
  confidence: number
}

export interface RunRalphWorkflowParams {
  threadId: string
  workspacePath: string
  modelId?: string
  dockerConfig?: DockerConfig | null
  dockerContainerId?: string | null
  window: BrowserWindow
  channel: string
  abortController: AbortController
  capabilityScope: CapabilityScope
  perRoundIterationLimit: number
  mode: "classic" | "butler"
  updateRalphState: (updates: Partial<RalphState>) => void
  onAgentStarted?: () => void
  disableApprovals?: boolean
  initialRound?: number
  initialTotalIterations?: number
  globalRoundCap?: number
}

export interface RunRalphWorkflowResult {
  status: "done" | "awaiting_continue" | "aborted"
  finalOutput: string
  lastVerification?: RalphVerificationResult
  round: number
  totalIterations: number
}

export interface EnsureRalphPlanParams {
  threadId: string
  workspacePath: string
  modelId?: string
  dockerConfig?: DockerConfig | null
  dockerContainerId?: string | null
  window: BrowserWindow
  channel: string
  abortController: AbortController
  capabilityScope: CapabilityScope
  requireConfirm: boolean
  userMessage: string
  disableApprovals?: boolean
  onAgentStarted?: () => void
  ralphLogPhase?: RalphState["phase"]
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const next: string[] = []
  for (const item of value) {
    const normalized = toNonEmptyString(item)
    if (!normalized) return null
    next.push(normalized)
  }
  return next
}

function parseModification(value: unknown): RalphVerificationModification | null {
  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  const priority = toNonEmptyString(record.priority)
  const title = toNonEmptyString(record.title)
  const details = toNonEmptyString(record.details)
  const acceptanceImpact = toStringArray(record.acceptanceImpact)

  if (!priority || (priority !== "high" && priority !== "medium" && priority !== "low")) {
    return null
  }
  if (!title || !details || !acceptanceImpact) return null

  return {
    priority,
    title,
    details,
    acceptanceImpact
  }
}

function normalizeVerification(
  value: unknown,
  expectedRound: number
): {
  verification?: RalphVerificationResult
  error?: string
} {
  if (!value || typeof value !== "object") {
    return { error: "检证 JSON 必须是对象。" }
  }

  const record = value as Record<string, unknown>
  const version = record.version
  const round = record.round
  const shouldContinue = record.shouldContinue
  const summary = toNonEmptyString(record.summary)
  const completed = toStringArray(record.completed)
  const gaps = toStringArray(record.gaps)
  const nextActions = toStringArray(record.nextActions)
  const risks = toStringArray(record.risks)

  if (version !== 1) return { error: "检证 JSON 的 version 必须为 1。" }
  if (!Number.isInteger(round) || (round as number) < 1) {
    return { error: "检证 JSON 的 round 必须是 >=1 的整数。" }
  }
  if ((round as number) !== expectedRound) {
    return { error: `检证 JSON 的 round=${String(round)} 与当前轮次 ${expectedRound} 不一致。` }
  }
  if (typeof shouldContinue !== "boolean") {
    return { error: "检证 JSON 的 shouldContinue 必须是布尔值。" }
  }
  if (!summary) return { error: "检证 JSON 的 summary 不能为空。" }
  if (!completed) return { error: "检证 JSON 的 completed 必须是字符串数组。" }
  if (!gaps) return { error: "检证 JSON 的 gaps 必须是字符串数组。" }
  if (!nextActions) return { error: "检证 JSON 的 nextActions 必须是字符串数组。" }
  if (!risks) return { error: "检证 JSON 的 risks 必须是字符串数组。" }

  if (!Array.isArray(record.modifications)) {
    return { error: "检证 JSON 的 modifications 必须是数组。" }
  }
  const modifications: RalphVerificationModification[] = []
  for (const item of record.modifications) {
    const normalized = parseModification(item)
    if (!normalized) {
      return { error: "检证 JSON 的 modifications 中存在非法项。" }
    }
    modifications.push(normalized)
  }

  const confidenceRaw = record.confidence
  if (typeof confidenceRaw !== "number" || !Number.isFinite(confidenceRaw)) {
    return { error: "检证 JSON 的 confidence 必须是 number。" }
  }
  if (confidenceRaw < 0 || confidenceRaw > 1) {
    return { error: "检证 JSON 的 confidence 必须位于 [0,1]。" }
  }

  return {
    verification: {
      version: 1,
      round: round as number,
      shouldContinue,
      summary,
      completed,
      gaps,
      modifications,
      nextActions,
      risks,
      confidence: confidenceRaw
    }
  }
}

function readVerificationResult(
  workspacePath: string,
  expectedRound: number
): {
  verification?: RalphVerificationResult
  error?: string
} {
  const verificationPath = join(workspacePath, RALPH_VERIFICATION_FILE)
  if (!existsSync(verificationPath)) {
    return { error: `${RALPH_VERIFICATION_FILE} 不存在。` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(verificationPath, "utf-8"))
  } catch {
    return { error: `${RALPH_VERIFICATION_FILE} 不是合法 JSON。` }
  }

  return normalizeVerification(parsed, expectedRound)
}

function appendVerificationHistory(
  workspacePath: string,
  verification: RalphVerificationResult
): void {
  const historyPath = join(workspacePath, RALPH_VERIFICATION_HISTORY_FILE)
  const payload = {
    ts: new Date().toISOString(),
    ...verification
  }
  appendFileSync(historyPath, `${JSON.stringify(payload)}\n`, "utf-8")
}

function removeIfExists(path: string): void {
  if (!existsSync(path)) return
  try {
    unlinkSync(path)
  } catch {
    // Ignore stale file cleanup errors.
  }
}

function clearRoundSignals(workspacePath: string): void {
  removeIfExists(join(workspacePath, RALPH_DONE_FILE))
  removeIfExists(join(workspacePath, RALPH_ONGOING_FILE))
}

function appendProgressEntry(workspacePath: string, storyId = "INIT"): void {
  const entry = [
    `## [${new Date().toLocaleString()}] - ${storyId}`,
    "- 实现内容",
    "- 修改的文件",
    "- **后续迭代的经验教训：**",
    "  - 发现的模式",
    "  - 遇到的坑",
    "  - 有用的上下文",
    "---",
    ""
  ].join("\n")

  const progressPath = join(workspacePath, RALPH_PROGRESS_FILE)
  appendFileSync(progressPath, entry)
}

async function resetRalphCheckpoint(threadId: string): Promise<void> {
  await closeCheckpointer(threadId)
  deleteThreadCheckpoint(threadId)
}

function buildExecutionPrompt(round: number, iteration: number, maxIterations: number): string {
  return [
    `Ralph 执行阶段（Round ${round}，Iteration ${iteration}/${maxIterations}）：`,
    `- 在修改前先阅读 ${RALPH_CONTEXT_FILE}、${RALPH_PLAN_FILE}、${RALPH_PROGRESS_FILE}。`,
    `- 若存在 ${RALPH_VERIFICATION_FILE}，优先处理其中 gaps、modifications、nextActions。`,
    "- 以文件系统作为唯一真实来源，优先完成最高优先级且未完成的事项。",
    `- 将本轮信息追加到 ${RALPH_PROGRESS_FILE}（不要覆盖）。`,
    `- 若已满足原始任务与验收标准，创建 ${RALPH_DONE_FILE} 并写简短总结。`,
    `- 若仍有缺口，创建 ${RALPH_ONGOING_FILE} 并写明阻塞和下一步。`
  ].join("\n")
}

function buildVerificationPrompt(round: number, lastError?: string): string {
  const retryLine = lastError
    ? `- 上一次检证结果无效：${lastError}。本次必须修复并输出合法 JSON。`
    : ""

  return [
    `Ralph 检证阶段（Round ${round}）：`,
    `- 读取 ${RALPH_CONTEXT_FILE}、${RALPH_PLAN_FILE}、${RALPH_PROGRESS_FILE}、${RALPH_DONE_FILE}/${RALPH_ONGOING_FILE}（若存在）。`,
    "- 判断是否仍需继续完善用户最初任务。",
    retryLine,
    `- 按下方 schema 生成完整 JSON，并覆盖写入 ${RALPH_VERIFICATION_FILE}：`,
    "{",
    '  "version": 1,',
    `  "round": ${round},`,
    '  "shouldContinue": true,',
    '  "summary": "string",',
    '  "completed": ["string"],',
    '  "gaps": ["string"],',
    '  "modifications": [',
    "    {",
    '      "priority": "high|medium|low",',
    '      "title": "string",',
    '      "details": "string",',
    '      "acceptanceImpact": ["string"]',
    "    }",
    "  ],",
    '  "nextActions": ["string"],',
    '  "risks": ["string"],',
    '  "confidence": 0.0',
    "}",
    "- 输出格式要求：先给 1-3 句中文结论，再输出与文件完全一致的 JSON 代码块。"
  ]
    .filter(Boolean)
    .join("\n")
}

function buildReplanningPrompt(round: number): string {
  return [
    `Ralph 再拆分阶段（Round ${round}）：`,
    `- 读取 ${RALPH_PLAN_FILE} 与 ${RALPH_VERIFICATION_FILE}。`,
    `- 基于 completed/gaps/modifications/nextActions 更新计划，覆盖写回 ${RALPH_PLAN_FILE}。`,
    "- 保留已完成项，并把未完成项拆成可执行的下一轮任务。",
    "- 若新增任务，必须给出优先级并保证 JSON 结构合法。",
    "- 输出一段简短中文说明，包含本次重排后的重点。"
  ].join("\n")
}

function buildVerificationSummary(
  verification: RalphVerificationResult,
  includeContinueHint: boolean
): string {
  const lines = [
    `Ralph 检证结论（Round ${verification.round}）：${
      verification.shouldContinue ? "需继续完善" : "可结束"
    }`,
    verification.summary,
    "",
    "```json",
    JSON.stringify(verification, null, 2),
    "```"
  ]

  if (includeContinueHint) {
    lines.push("", "已达到本轮安全上限，若继续执行请回复 /confirm。")
  }

  return lines.join("\n")
}

function normalizeIterationsLimit(value: number): number {
  if (!Number.isFinite(value)) return 1
  const rounded = Math.floor(value)
  return rounded > 0 ? rounded : 1
}

export function buildRalphInitPrompt(userMessage: string, requireConfirm: boolean): string {
  const example = [
    "{",
    '  "project": "MyApp",',
    '  "branchName": "ralph/task-priority",',
    '  "description": "任务优先级系统 - 为任务添加优先级",',
    '  "userStories": [',
    "    {",
    '      "id": "US-001",',
    '      "title": "在数据库中添加优先级字段",',
    '      "description": "作为开发者，我需要存储任务优先级以便跨会话持久化。",',
    '      "acceptanceCriteria": [',
    "        \"在 tasks 表中添加 priority 列：'high' | 'medium' | 'low'（默认 'medium'）\",",
    '        "成功生成并运行迁移",',
    '        "类型检查通过"',
    "      ],",
    '      "priority": 1,',
    '      "passes": false,',
    '      "notes": ""',
    "    }",
    "  ]",
    "}"
  ].join("\n")

  return [
    "Ralph 模式计划初始化：",
    "1) 基于用户请求生成可执行的分阶段 JSON 计划。",
    "2) 输出必须覆盖目标、用户故事、验收标准与优先级。",
    `3) 将 JSON 保存到工作区的 ${RALPH_PLAN_FILE} 文件中。`,
    requireConfirm
      ? "4) 请用户回复 /confirm 以开始执行。"
      : "4) 计划生成后直接进入执行阶段，不要等待确认。",
    "",
    "JSON 格式示例：",
    example,
    "",
    "用户请求：",
    userMessage.trim()
  ].join("\n")
}

export function writeRalphContextFile(workspacePath: string, originalRequest: string): void {
  const contextPath = join(workspacePath, RALPH_CONTEXT_FILE)
  const now = new Date().toISOString()

  let createdAt = now
  if (existsSync(contextPath)) {
    try {
      const raw = JSON.parse(readFileSync(contextPath, "utf-8")) as { createdAt?: unknown }
      if (typeof raw.createdAt === "string" && raw.createdAt.trim()) {
        createdAt = raw.createdAt
      }
    } catch {
      // Ignore malformed context file and rewrite it.
    }
  }

  writeFileSync(
    contextPath,
    JSON.stringify(
      {
        version: 1,
        originalRequest: originalRequest.trim(),
        createdAt,
        updatedAt: now
      },
      null,
      2
    ),
    "utf-8"
  )
}

export async function ensureRalphPlan(params: EnsureRalphPlanParams): Promise<string> {
  const {
    threadId,
    workspacePath,
    modelId,
    dockerConfig,
    dockerContainerId,
    window,
    channel,
    abortController,
    capabilityScope,
    requireConfirm,
    userMessage,
    disableApprovals,
    onAgentStarted,
    ralphLogPhase = "init"
  } = params

  writeRalphContextFile(workspacePath, userMessage)
  await resetRalphCheckpoint(threadId)
  onAgentStarted?.()

  return runAgentStream({
    threadId,
    workspacePath,
    modelId,
    dockerConfig,
    dockerContainerId,
    disableApprovals,
    message: buildRalphInitPrompt(userMessage, requireConfirm),
    window,
    channel,
    abortController,
    threadMode: "ralph",
    capabilityScope,
    ralphLog: { enabled: true, iteration: 0, phase: ralphLogPhase }
  })
}

export async function runRalphWorkflow(
  params: RunRalphWorkflowParams
): Promise<RunRalphWorkflowResult> {
  const {
    threadId,
    workspacePath,
    modelId,
    dockerConfig,
    dockerContainerId,
    window,
    channel,
    abortController,
    capabilityScope,
    mode,
    updateRalphState,
    onAgentStarted,
    disableApprovals
  } = params

  const doneFlag = join(workspacePath, RALPH_DONE_FILE)
  const planPath = join(workspacePath, RALPH_PLAN_FILE)
  const perRoundLimit = normalizeIterationsLimit(params.perRoundIterationLimit)
  const roundCap = Math.max(1, Math.floor(params.globalRoundCap ?? DEFAULT_RALPH_GLOBAL_ROUND_CAP))

  if (!existsSync(planPath)) {
    throw new Error(`执行 Ralph 前缺少 ${RALPH_PLAN_FILE}。`)
  }

  let completedRounds = Math.max(0, Math.floor(params.initialRound ?? 0))
  let totalIterations = Math.max(0, Math.floor(params.initialTotalIterations ?? 0))
  let finalOutput = ""

  if (completedRounds >= roundCap) {
    const stopMessage = `Ralph 已达到全局保险上限 ${roundCap} 轮，停止继续执行。`
    updateRalphState({
      phase: "done",
      round: completedRounds,
      iterations: 0,
      totalIterations
    })
    return {
      status: "done",
      finalOutput: stopMessage,
      round: completedRounds,
      totalIterations
    }
  }

  while (completedRounds < roundCap && !abortController.signal.aborted) {
    const round = completedRounds + 1
    let iterationsInRound = 0
    let stopReason: "done_flag" | "per_round_cap" = "per_round_cap"

    clearRoundSignals(workspacePath)
    appendProgressEntry(workspacePath, `ROUND-${round}`)
    updateRalphState({
      phase: "running",
      round,
      iterations: 0,
      totalIterations
    })

    for (let i = 1; i <= perRoundLimit; i += 1) {
      if (abortController.signal.aborted) break

      await resetRalphCheckpoint(threadId)
      onAgentStarted?.()
      const iterationOutput = await runAgentStream({
        threadId,
        workspacePath,
        modelId,
        dockerConfig,
        dockerContainerId,
        disableApprovals,
        message: buildExecutionPrompt(round, i, perRoundLimit),
        window,
        channel,
        abortController,
        threadMode: "ralph",
        capabilityScope,
        ralphLog: { enabled: true, iteration: totalIterations + 1, phase: "running" }
      })

      if (iterationOutput.trim()) {
        finalOutput = iterationOutput
      }

      iterationsInRound = i
      totalIterations += 1
      updateRalphState({
        phase: "running",
        round,
        iterations: i,
        totalIterations
      })

      if (existsSync(doneFlag)) {
        stopReason = "done_flag"
        break
      }
    }

    if (abortController.signal.aborted) {
      return {
        status: "aborted",
        finalOutput,
        round: completedRounds,
        totalIterations
      }
    }

    updateRalphState({
      phase: "verifying",
      round,
      iterations: iterationsInRound,
      totalIterations
    })

    let verification: RalphVerificationResult | null = null
    let verificationError = ""

    for (let attempt = 0; attempt <= VERIFICATION_RETRY_LIMIT; attempt += 1) {
      await resetRalphCheckpoint(threadId)
      onAgentStarted?.()
      const verificationOutput = await runAgentStream({
        threadId,
        workspacePath,
        modelId,
        dockerConfig,
        dockerContainerId,
        disableApprovals,
        message: buildVerificationPrompt(round, verificationError || undefined),
        window,
        channel,
        abortController,
        threadMode: "ralph",
        capabilityScope,
        ralphLog: { enabled: true, iteration: totalIterations, phase: "verifying" }
      })

      if (verificationOutput.trim()) {
        finalOutput = verificationOutput
      }

      const parsed = readVerificationResult(workspacePath, round)
      if (parsed.verification) {
        verification = parsed.verification
        break
      }

      verificationError = parsed.error || "未知检证错误"
      if (attempt >= VERIFICATION_RETRY_LIMIT) {
        throw new Error(`Ralph 检证失败：${verificationError}`)
      }
    }

    if (!verification) {
      throw new Error("Ralph 检证失败：未产出可用检证结果。")
    }

    appendVerificationHistory(workspacePath, verification)
    completedRounds = round

    if (!verification.shouldContinue) {
      const summary = buildVerificationSummary(verification, false)
      updateRalphState({
        phase: "done",
        round,
        iterations: iterationsInRound,
        totalIterations
      })
      return {
        status: "done",
        finalOutput: summary,
        lastVerification: verification,
        round,
        totalIterations
      }
    }

    if (completedRounds >= roundCap) {
      const summary = [
        buildVerificationSummary(verification, false),
        "",
        `Ralph 达到全局保险上限 ${roundCap} 轮，已强制停止。`
      ].join("\n")
      updateRalphState({
        phase: "done",
        round,
        iterations: iterationsInRound,
        totalIterations
      })
      return {
        status: "done",
        finalOutput: summary,
        lastVerification: verification,
        round,
        totalIterations
      }
    }

    updateRalphState({
      phase: "replanning",
      round,
      iterations: iterationsInRound,
      totalIterations
    })

    await resetRalphCheckpoint(threadId)
    onAgentStarted?.()
    const replanningOutput = await runAgentStream({
      threadId,
      workspacePath,
      modelId,
      dockerConfig,
      dockerContainerId,
      disableApprovals,
      message: buildReplanningPrompt(round),
      window,
      channel,
      abortController,
      threadMode: "ralph",
      capabilityScope,
      ralphLog: { enabled: true, iteration: totalIterations, phase: "replanning" }
    })

    if (replanningOutput.trim()) {
      finalOutput = replanningOutput
    }

    if (!existsSync(planPath)) {
      throw new Error(`再拆分阶段未产出 ${RALPH_PLAN_FILE}。`)
    }

    if (mode === "classic" && stopReason === "per_round_cap") {
      const summary = buildVerificationSummary(verification, true)
      updateRalphState({
        phase: "awaiting_continue",
        round,
        iterations: iterationsInRound,
        totalIterations
      })
      return {
        status: "awaiting_continue",
        finalOutput: summary,
        lastVerification: verification,
        round,
        totalIterations
      }
    }
  }

  return {
    status: "aborted",
    finalOutput,
    round: completedRounds,
    totalIterations
  }
}
