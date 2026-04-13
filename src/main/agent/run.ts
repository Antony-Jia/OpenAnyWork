import { BrowserWindow } from "electron"
import { randomUUID } from "node:crypto"
import * as fs from "fs"
import * as path from "path"
import { HumanMessage, type MessageContent } from "@langchain/core/messages"
import { createAgentRuntime } from "./runtime"
import { appendRalphLogEntry } from "../ralph-log"
import {
  extractReasoningSummaryFromResponseOutput,
  stripReasoningBlocks,
  injectReasoningBlock
} from "../../shared/reasoning"
import type {
  CapabilityScope,
  ContentBlock,
  RalphLogEntry,
  RalphState,
  DockerConfig,
  ThreadMode
} from "../types"

export interface AgentTraceEvent {
  role: "ai" | "tool_call" | "tool"
  content: string
  messageId?: string
  toolCallId?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
}

export async function runAgentStream({
  threadId,
  workspacePath,
  modelId,
  dockerConfig,
  dockerContainerId,
  disableApprovals,
  extraSystemPrompt,
  forceToolNames,
  threadMode,
  capabilityScope,
  message,
  window,
  channel,
  abortController,
  ralphLog,
  onTraceEvent
}: {
  threadId: string
  workspacePath: string
  modelId?: string
  dockerConfig?: DockerConfig | null
  dockerContainerId?: string | null
  disableApprovals?: boolean
  extraSystemPrompt?: string
  forceToolNames?: string[]
  threadMode?: ThreadMode
  capabilityScope?: CapabilityScope
  message: string | ContentBlock[]
  window: BrowserWindow
  channel: string
  abortController: AbortController
  onTraceEvent?: (entry: AgentTraceEvent) => void
  ralphLog?: {
    enabled: boolean
    iteration?: number
    phase?: RalphState["phase"]
  }
}): Promise<string> {
  // 创建日志文件
  const logFilePath = path.join(process.cwd(), "agent-stream-debug.log")
  // 清空日志文件
  try {
    fs.writeFileSync(logFilePath, "", "utf-8")
  } catch (error) {
    console.error("Failed to clear log file:", error)
  }

  const logToFile = (message: string): void => {
    try {
      const timestamp = new Date().toISOString()
      fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`, "utf-8")
    } catch (error) {
      console.error("Failed to write log:", error)
    }
  }

  const summarizeDebugValue = (value: unknown, maxLength = 1200): string => {
    if (value === undefined) return ""
    if (typeof value === "string") {
      return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
    }
    try {
      const text = JSON.stringify(value)
      return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
    } catch {
      return "[unserializable]"
    }
  }

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value)

  logToFile(
    `[Agent Stream] Run start: ${summarizeDebugValue({
      threadId,
      modelId,
      threadMode,
      capabilityScope,
      dockerEnabled: !!dockerConfig?.enabled,
      disableApprovals: !!disableApprovals,
      message: summarizeDebugValue(message, 800)
    })}`
  )

  const agent = await createAgentRuntime({
    threadId,
    workspacePath,
    modelId,
    messageContent: message,
    dockerConfig,
    dockerContainerId,
    disableApprovals,
    extraSystemPrompt,
    forceToolNames,
    threadMode,
    capabilityScope,
    debugLog: logToFile
  })

  const humanMessage = Array.isArray(message)
    ? new HumanMessage({ content: message as MessageContent })
    : new HumanMessage(message)
  const stream = await agent.stream(
    { messages: [humanMessage] },
    {
      configurable: { thread_id: threadId },
      signal: abortController.signal,
      streamMode: ["messages", "values"],
      recursionLimit: 1000
    }
  )

  let lastAssistant = ""
  let lastValuesAiContent = ""
  let lastReasoningTokenCount: number | undefined
  let accumulatedReasoningContent = ""
  let reasoningPhase = false
  const runId = randomUUID()
  const seenMessageIds = new Set<string>()
  const seenToolCallIds = new Set<string>()

  let loggedAnything = false
  const appendLog = (entry: Omit<RalphLogEntry, "id" | "ts" | "threadId" | "runId">): void => {
    if (!ralphLog?.enabled) return

    const fullEntry: RalphLogEntry = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      threadId,
      runId,
      iteration: ralphLog.iteration,
      phase: ralphLog.phase,
      ...entry
    }

    try {
      appendRalphLogEntry(threadId, fullEntry)
      loggedAnything = true
      window.webContents.send(channel, {
        type: "custom",
        data: { type: "ralph_log", entry: fullEntry }
      })
    } catch (error) {
      console.warn("[Agent] Failed to append ralph log entry:", error)
    }
  }

  const extractContent = (content: unknown): string => {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
      return content
        .filter(
          (block): block is { type: "text"; text: string } =>
            !!block && typeof block === "object" && (block as { type?: string }).type === "text"
        )
        .map((block) => block.text)
        .join("")
    }
    return ""
  }

  const getMessageRole = (msg: Record<string, unknown>): string => {
    if (typeof (msg as { _getType?: () => string })._getType === "function") {
      return (msg as { _getType: () => string })._getType()
    }
    if (typeof msg.type === "string") return msg.type
    const classId = Array.isArray(msg.id) ? msg.id : []
    const className = classId[classId.length - 1] || ""
    if (className.includes("Human")) return "human"
    if (className.includes("AI")) return "ai"
    if (className.includes("Tool")) return "tool"
    if (className.includes("System")) return "system"
    return ""
  }

  const getMessageId = (msg: Record<string, unknown>): string | undefined => {
    if (typeof msg.id === "string") return msg.id
    const kwargs = msg.kwargs as { id?: string } | undefined
    return kwargs?.id
  }

  const getMessageContent = (msg: Record<string, unknown>): string => {
    if ("content" in msg) {
      return extractContent(msg.content)
    }
    const kwargs = msg.kwargs as { content?: unknown } | undefined
    return extractContent(kwargs?.content)
  }

  const getRawContent = (msg: Record<string, unknown>): unknown => {
    if ("content" in msg) {
      return msg.content
    }
    const kwargs = msg.kwargs as { content?: unknown } | undefined
    return kwargs?.content
  }

  const getAdditionalKwargs = (msg: Record<string, unknown>): Record<string, unknown> => {
    if ("additional_kwargs" in msg) {
      return msg.additional_kwargs as Record<string, unknown>
    }
    const kwargs = msg.kwargs as { additional_kwargs?: Record<string, unknown> } | undefined
    return kwargs?.additional_kwargs || {}
  }

  const extractReasoningFromRawResponse = (
    additionalKwargs: Record<string, unknown>
  ): { reasoningContent?: string; reasoningDetails?: unknown } => {
    const rawResponse = additionalKwargs.__raw_response as Record<string, unknown> | undefined
    if (!rawResponse) {
      return {}
    }

    // 尝试从 Ark 格式提取 reasoning_content
    if (Array.isArray(rawResponse.choices)) {
      const choice = rawResponse.choices[0] as Record<string, unknown> | undefined
      // 先检查 message 字段（非流式响应）
      if (isRecord(choice?.message)) {
        const message = choice.message as Record<string, unknown>
        // Ark 使用 reasoning_content
        if (typeof message.reasoning_content === "string") {
          return { reasoningContent: message.reasoning_content }
        }
        // Ollama 使用 reasoning
        if (typeof message.reasoning === "string") {
          return { reasoningContent: message.reasoning }
        }
        // 如果是对象形式的 reasoning
        if (isRecord(message.reasoning)) {
          return { reasoningDetails: message.reasoning }
        }
      }
      // 检查 delta 字段（流式响应）
      if (isRecord(choice?.delta)) {
        const delta = choice.delta as Record<string, unknown>
        // Ark 流式使用 delta.reasoning_content
        if (typeof delta.reasoning_content === "string") {
          return { reasoningContent: delta.reasoning_content }
        }
        // Ollama 流式使用 delta.reasoning
        if (typeof delta.reasoning === "string") {
          return { reasoningContent: delta.reasoning }
        }
        // 如果是对象形式的 reasoning
        if (isRecord(delta.reasoning)) {
          return { reasoningDetails: delta.reasoning }
        }
      }
    }

    return {}
  }

  const getResponseMetadata = (
    msg: Record<string, unknown>
  ): Record<string, unknown> | undefined => {
    if (isRecord(msg.response_metadata)) {
      return msg.response_metadata
    }
    const kwargs = msg.kwargs as { response_metadata?: Record<string, unknown> } | undefined
    return kwargs?.response_metadata
  }

  const getUsageMetadata = (msg: unknown): Record<string, unknown> | undefined => {
    if (!isRecord(msg)) {
      return undefined
    }

    if (isRecord(msg.usage_metadata)) {
      return msg.usage_metadata
    }
    const kwargs = msg.kwargs as { usage_metadata?: Record<string, unknown> } | undefined
    return kwargs?.usage_metadata
  }

  const getReasoningTokenCount = (usage?: Record<string, unknown>): number | undefined => {
    if (!usage) return undefined

    const completionTokenDetails = isRecord(usage.completion_tokens_details)
      ? usage.completion_tokens_details
      : undefined
    if (typeof completionTokenDetails?.reasoning_tokens === "number") {
      return completionTokenDetails.reasoning_tokens
    }

    const outputTokenDetails = isRecord(usage.output_token_details)
      ? usage.output_token_details
      : undefined
    if (typeof outputTokenDetails?.reasoning === "number") {
      return outputTokenDetails.reasoning
    }

    return undefined
  }

  const summarizeUsageMetadata = (
    usage?: Record<string, unknown>
  ): Record<string, unknown> | undefined => {
    if (!usage) return undefined

    const promptTokenDetails = isRecord(usage.prompt_tokens_details)
      ? usage.prompt_tokens_details
      : undefined
    const completionTokenDetails = isRecord(usage.completion_tokens_details)
      ? usage.completion_tokens_details
      : undefined
    const outputTokenDetails = isRecord(usage.output_token_details)
      ? usage.output_token_details
      : undefined

    return {
      keys: Object.keys(usage),
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      promptTokensDetails: promptTokenDetails,
      completionTokensDetails: completionTokenDetails,
      outputTokenDetails: outputTokenDetails,
      reasoningTokenCount: getReasoningTokenCount(usage)
    }
  }

  const summarizeReasoningLog = ({
    reasoningContent,
    reasoningDetails,
    reasoningTokenCount,
    reasoningTokenCountFromUsage,
    reasoningTokenCountFromResponseUsage,
    reasoningSummary
  }: {
    reasoningContent?: string
    reasoningDetails?: unknown
    reasoningTokenCount?: number
    reasoningTokenCountFromUsage?: number
    reasoningTokenCountFromResponseUsage?: number
    reasoningSummary?: string
  }): Record<string, unknown> | undefined => {
    if (
      !reasoningContent &&
      reasoningDetails === undefined &&
      typeof reasoningTokenCount !== "number" &&
      typeof reasoningTokenCountFromUsage !== "number" &&
      typeof reasoningTokenCountFromResponseUsage !== "number" &&
      !reasoningSummary
    ) {
      return undefined
    }

    return {
      reasoning_content: summarizeDebugValue(reasoningContent, 600) || undefined,
      reasoning_details: summarizeDebugValue(reasoningDetails, 900) || undefined,
      reasoning_tokens: reasoningTokenCount ?? undefined,
      reasoning_tokens_from_usage: reasoningTokenCountFromUsage ?? undefined,
      reasoning_tokens_from_response_usage: reasoningTokenCountFromResponseUsage ?? undefined,
      reasoning_summary: summarizeDebugValue(reasoningSummary, 500) || undefined
    }
  }

  const getToolCalls = (
    msg: Record<string, unknown>
  ): Array<{ id?: string; name?: string; args?: Record<string, unknown> }> => {
    if (Array.isArray((msg as { tool_calls?: unknown }).tool_calls)) {
      return (
        msg as {
          tool_calls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>
        }
      ).tool_calls
    }
    const kwargs = msg.kwargs as
      | {
          tool_calls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>
        }
      | undefined
    return kwargs?.tool_calls || []
  }

  const getToolMessageMeta = (
    msg: Record<string, unknown>
  ): { toolCallId?: string; toolName?: string } => {
    const toolCallId = (msg as { tool_call_id?: string }).tool_call_id
    const toolName = (msg as { name?: string }).name
    const kwargs = msg.kwargs as { tool_call_id?: string; name?: string } | undefined
    return {
      toolCallId: toolCallId || kwargs?.tool_call_id,
      toolName: toolName || kwargs?.name
    }
  }

  for await (const chunk of stream) {
    if (abortController.signal.aborted) break
    const [mode, data] = chunk as [string, unknown]
    logToFile(`orgin ` + JSON.stringify(chunk))
    if (mode === "values") {
      const state = data as { messages?: unknown[] }
      if (Array.isArray(state.messages)) {
        for (const rawMsg of state.messages) {
          if (!rawMsg || typeof rawMsg !== "object") continue
          const msg = rawMsg as Record<string, unknown>
          const role = getMessageRole(msg)
          if (role === "human") continue

          const messageId = getMessageId(msg)
          if (messageId && seenMessageIds.has(messageId)) {
            continue
          }

          const content = getMessageContent(msg)
          const rawContent = getRawContent(msg)
          const additionalKwargs = getAdditionalKwargs(msg)
          const responseMetadata = getResponseMetadata(msg)
          const usageMetadata = getUsageMetadata(msg)
          const responseOutput = responseMetadata?.output
          const reasoningSummary = extractReasoningSummaryFromResponseOutput(responseOutput)
          const toolCalls = getToolCalls(msg)
          const responseUsage = isRecord(responseMetadata?.usage)
            ? responseMetadata.usage
            : undefined
          const reasoningTokenCountFromUsage = getReasoningTokenCount(usageMetadata)
          const reasoningTokenCountFromResponseUsage = getReasoningTokenCount(responseUsage)
          const reasoningTokenCount =
            reasoningTokenCountFromUsage ?? reasoningTokenCountFromResponseUsage
          const reasoningContent =
            typeof additionalKwargs.reasoning_content === "string"
              ? additionalKwargs.reasoning_content
              : ""
          const reasoningDetails = isRecord(additionalKwargs.reasoning)
            ? additionalKwargs.reasoning
            : undefined
          // 从 __raw_response 提取 reasoning 内容
          const rawReasoning = extractReasoningFromRawResponse(additionalKwargs)
          const finalReasoningContent = reasoningContent || rawReasoning.reasoningContent
          const finalReasoningDetails = reasoningDetails || rawReasoning.reasoningDetails
          const reasoning = summarizeReasoningLog({
            reasoningContent: finalReasoningContent,
            reasoningDetails: finalReasoningDetails,
            reasoningTokenCount,
            reasoningTokenCountFromUsage,
            reasoningTokenCountFromResponseUsage,
            reasoningSummary
          })

          // 如果有 reasoning_content，包装成 <think/> 格式并插入到 content 中
          let displayContent = content
          if (finalReasoningContent) {
            if (typeof content === "string") {
              displayContent = injectReasoningBlock(content, finalReasoningContent)
            } else if (!content) {
              // content 为空时，只包装 reasoning_content
              displayContent = `

${finalReasoningContent}

`
            }
          }

          if (typeof reasoningTokenCount === "number") {
            lastReasoningTokenCount = reasoningTokenCount
          }

          logToFile(
            `[Agent Stream] ${role.toUpperCase()} Message: ` +
              JSON.stringify({
                messageId,
                role,
                content: summarizeDebugValue(content, 500),
                rawContent: summarizeDebugValue(rawContent, 500),
                displayContent: displayContent !== content ? summarizeDebugValue(displayContent, 500) : undefined,
                additionalKwargsKeys: Object.keys(additionalKwargs),
                usageMetadata: summarizeUsageMetadata(usageMetadata),
                reasoning,
                responseMetadata: responseMetadata
                  ? {
                      keys: Object.keys(responseMetadata),
                      usage: summarizeUsageMetadata(responseUsage),
                      output: summarizeDebugValue(responseOutput, 900)
                    }
                  : undefined,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined
              })
          )

          if (role === "ai") {
            if (messageId) seenMessageIds.add(messageId)
            if (displayContent) {
              lastValuesAiContent = displayContent
              onTraceEvent?.({
                role: "ai",
                content: displayContent,
                messageId
              })
            }
            if (ralphLog?.enabled && (displayContent || toolCalls.length > 0)) {
              appendLog({
                role: "ai",
                content: displayContent,
                messageId
              })
            }

            for (const tc of toolCalls) {
              if (!tc.id || seenToolCallIds.has(tc.id)) continue
              seenToolCallIds.add(tc.id)
              let argsText = ""
              try {
                argsText = tc.args ? JSON.stringify(tc.args) : ""
              } catch {
                argsText = ""
              }
              if (ralphLog?.enabled) {
                appendLog({
                  role: "tool_call",
                  content: `${tc.name || "tool"}(${argsText})`,
                  toolCallId: tc.id,
                  toolName: tc.name,
                  toolArgs: tc.args
                })
              }
              onTraceEvent?.({
                role: "tool_call",
                content: `${tc.name || "tool"}(${argsText})`,
                messageId,
                toolCallId: tc.id,
                toolName: tc.name,
                toolArgs: tc.args
              })
            }
          } else if (role === "tool") {
            if (messageId) seenMessageIds.add(messageId)
            const meta = getToolMessageMeta(msg)
            const content = getMessageContent(msg)
            const rawContent = getRawContent(msg)
            const additionalKwargs = getAdditionalKwargs(msg)
            const responseMetadata = getResponseMetadata(msg)
            const usageMetadata = getUsageMetadata(msg)
            const responseOutput = responseMetadata?.output
            const reasoningSummary = extractReasoningSummaryFromResponseOutput(responseOutput)
            const responseUsage = isRecord(responseMetadata?.usage)
              ? responseMetadata.usage
              : undefined
            const reasoningTokenCountFromUsage = getReasoningTokenCount(usageMetadata)
            const reasoningTokenCountFromResponseUsage = getReasoningTokenCount(responseUsage)
            const reasoningTokenCount =
              reasoningTokenCountFromUsage ?? reasoningTokenCountFromResponseUsage
            const reasoningContent =
              typeof additionalKwargs.reasoning_content === "string"
                ? additionalKwargs.reasoning_content
                : ""
            const reasoningDetails = isRecord(additionalKwargs.reasoning)
              ? additionalKwargs.reasoning
              : undefined
            // 从 __raw_response 提取 reasoning 内容
            const rawReasoning = extractReasoningFromRawResponse(additionalKwargs)
            const finalReasoningContent = reasoningContent || rawReasoning.reasoningContent
            const finalReasoningDetails = reasoningDetails || rawReasoning.reasoningDetails
            const reasoning = summarizeReasoningLog({
              reasoningContent: finalReasoningContent,
              reasoningDetails: finalReasoningDetails,
              reasoningTokenCount,
              reasoningTokenCountFromUsage,
              reasoningTokenCountFromResponseUsage,
              reasoningSummary
            })

            if (typeof reasoningTokenCount === "number") {
              lastReasoningTokenCount = reasoningTokenCount
            }

            logToFile(
              `[Agent Stream] ToolMessage Details: ` +
                JSON.stringify({
                  messageId,
                  toolCallId: meta.toolCallId,
                  toolName: meta.toolName,
                  content: summarizeDebugValue(content, 500),
                  rawContent: summarizeDebugValue(rawContent, 500),
                  additionalKwargsKeys: Object.keys(additionalKwargs),
                  usageMetadata: summarizeUsageMetadata(usageMetadata),
                  reasoning,
                  responseMetadata: responseMetadata
                    ? {
                        keys: Object.keys(responseMetadata),
                        usage: summarizeUsageMetadata(responseUsage),
                        output: summarizeDebugValue(responseOutput, 900)
                      }
                    : undefined
                })
            )

            onTraceEvent?.({
              role: "tool",
              content,
              messageId,
              toolCallId: meta.toolCallId,
              toolName: meta.toolName
            })
            if (ralphLog?.enabled) {
              appendLog({
                role: "tool",
                content,
                messageId,
                toolCallId: meta.toolCallId,
                toolName: meta.toolName
              })
            }
          }
        }
      }
    }

    if (mode === "messages") {
      const tuple = data as [unknown, unknown]
      const rawMsg = tuple?.[0]
      const msgChunk = rawMsg as { id?: unknown; kwargs?: Record<string, unknown> } | undefined
      const msgObj = rawMsg as Record<string, unknown>

      // 修复：LangChain 消息数据可能在顶层或 kwargs 中
      const kwargs = (msgObj.kwargs || msgObj.lc_kwargs || {}) as Record<string, unknown>
      const rawContent = msgObj.content || kwargs.content
      const rawContentText = extractContent(rawContent)

      // 判断是否为 ToolMessage，ToolMessage 不参与 reasoning 注入逻辑
      const msgClassId = Array.isArray(msgObj.id) ? msgObj.id : []
      const msgClassName = msgClassId[msgClassId.length - 1] || ""
      const isToolMsg =
        msgClassName.includes("Tool") || typeof kwargs.tool_call_id === "string"
      // additional_kwargs 和 response_metadata 在顶层
      const additionalKwargs = isRecord(msgObj.additional_kwargs)
        ? msgObj.additional_kwargs
        : isRecord(kwargs.additional_kwargs)
        ? kwargs.additional_kwargs
        : {}
      const responseMetadata = isRecord(msgObj.response_metadata)
        ? msgObj.response_metadata
        : isRecord(kwargs.response_metadata)
        ? kwargs.response_metadata
        : undefined
      const usageMetadata = getUsageMetadata(msgChunk as Record<string, unknown>)
      const responseOutput = responseMetadata?.output
      const reasoningSummary = extractReasoningSummaryFromResponseOutput(responseOutput)
      const responseUsage = isRecord(responseMetadata?.usage) ? responseMetadata.usage : undefined
      const reasoningTokenCountFromUsage = getReasoningTokenCount(usageMetadata)
      const reasoningTokenCountFromResponseUsage = getReasoningTokenCount(responseUsage)
      const reasoningTokenCount =
        reasoningTokenCountFromUsage ?? reasoningTokenCountFromResponseUsage
      const reasoningContent =
        typeof additionalKwargs.reasoning_content === "string"
          ? additionalKwargs.reasoning_content
          : ""
      const reasoningDetails = isRecord(additionalKwargs.reasoning)
        ? additionalKwargs.reasoning
        : undefined
      // 从 __raw_response 提取 reasoning 内容
      const rawReasoning = extractReasoningFromRawResponse(additionalKwargs)
      const finalReasoningContent = reasoningContent || rawReasoning.reasoningContent
      const finalReasoningDetails = reasoningDetails || rawReasoning.reasoningDetails

      const reasoning = summarizeReasoningLog({
        reasoningContent: finalReasoningContent,
        reasoningDetails: finalReasoningDetails,
        reasoningTokenCount,
        reasoningTokenCountFromUsage,
        reasoningTokenCountFromResponseUsage,
        reasoningSummary
      })

      if (typeof reasoningTokenCount === "number") {
        lastReasoningTokenCount = reasoningTokenCount
      }

      // ToolMessage 直接走默认发送，不参与 reasoning 注入逻辑
      if (!isToolMsg) {
        // 构建要发送给前端的流式内容
        let streamContent: string | null = null
        let isReasoningChunk = false

        // 处理流式 reasoning 内容
        if (finalReasoningContent) {
          isReasoningChunk = true
          // 累积 reasoning_content
          accumulatedReasoningContent += finalReasoningContent

          if (!reasoningPhase) {
            // 这是第一个 reasoning chunk，打开 think 标签
            reasoningPhase = true
            streamContent = `\n<think>${finalReasoningContent}`
          } else {
            // 继续 reasoning 阶段，只发送内容
            streamContent = finalReasoningContent
          }
        } else if (reasoningPhase && rawContentText) {
          // reasoning 阶段结束，开始 content 阶段
          reasoningPhase = false
          // 关闭 think 标签，然后发送 content
          streamContent = `</think>${rawContentText}`
        } else if (rawContentText) {
          // 普通 content 阶段
          streamContent = rawContentText
        }

        // 累积到 lastAssistant 用于最终返回
        if (streamContent) {
          lastAssistant += streamContent
        }

        logToFile(
          `[Agent Stream] Messages Mode Chunk: ` +
            JSON.stringify({
              rawContentText: summarizeDebugValue(rawContentText, 500),
              streamContent: summarizeDebugValue(streamContent, 500) || "null",
              hasReasoningContent: !!finalReasoningContent,
              isReasoningChunk,
              reasoningPhase,
              accumulatedReasoningLength: accumulatedReasoningContent.length,
              usageMetadata: summarizeUsageMetadata(usageMetadata),
              reasoning,
              responseMetadata: responseMetadata
                ? {
                    keys: Object.keys(responseMetadata),
                    usage: summarizeUsageMetadata(responseUsage),
                    output: summarizeDebugValue(responseOutput, 900)
                  }
                : undefined
            })
        )

        // 如果有内容要发送，修改 data 中的 content 为包装后的内容
        if (streamContent && msgChunk?.kwargs) {
          // 创建修改后的数据副本，将 reasoning_content 包装进 content
          const modifiedData = JSON.parse(JSON.stringify(data))
          const modifiedKwargs = modifiedData[0]?.kwargs
          if (modifiedKwargs) {
            // 设置 content 为 streamContent（已经包含 think 标签包装）
            modifiedKwargs.content = streamContent

            window.webContents.send(channel, {
              type: "stream",
              mode,
              data: modifiedData
            })
            continue // 跳过默认的发送
          }
        }
      }
    }

    window.webContents.send(channel, {
      type: "stream",
      mode,
      data: JSON.parse(JSON.stringify(data))
    })
  }

  const finalAssistantText = stripReasoningBlocks(lastAssistant.trim())
  const finalValuesText = stripReasoningBlocks(lastValuesAiContent.trim())

  logToFile(
    `[Agent Stream] Final summary: ${summarizeDebugValue({
      lastAssistant: summarizeDebugValue(lastAssistant.trim(), 1200),
      lastValuesAiContent: summarizeDebugValue(lastValuesAiContent.trim(), 1200),
      finalAssistantText: summarizeDebugValue(finalAssistantText, 1200),
      finalValuesText: summarizeDebugValue(finalValuesText, 1200),
      lastReasoningTokenCount,
      hasThinkTagInLastAssistant: lastAssistant.includes("<think>"),
      hasThinkTagInLastValues: lastValuesAiContent.includes("<think>")
    })}`
  )

  if (ralphLog?.enabled && !loggedAnything && finalAssistantText) {
    appendLog({
      role: "ai",
      content: finalAssistantText
    })
  }

  return finalAssistantText || finalValuesText
}
