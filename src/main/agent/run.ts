import { BrowserWindow } from "electron"
import { randomUUID } from "node:crypto"
import { HumanMessage, type MessageContent } from "@langchain/core/messages"
import { createAgentRuntime } from "./runtime"
import { appendRalphLogEntry } from "../ralph-log"
import {
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
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value)

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
    capabilityScope
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
          const additionalKwargs = getAdditionalKwargs(msg)
          const toolCalls = getToolCalls(msg)
          const reasoningContent =
            typeof additionalKwargs.reasoning_content === "string"
              ? additionalKwargs.reasoning_content
              : ""
          // 从 __raw_response 提取 reasoning 内容
          const rawReasoning = extractReasoningFromRawResponse(additionalKwargs)
          const finalReasoningContent = reasoningContent || rawReasoning.reasoningContent

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
      const reasoningContent =
        typeof additionalKwargs.reasoning_content === "string"
          ? additionalKwargs.reasoning_content
          : ""
      // 从 __raw_response 提取 reasoning 内容
      const rawReasoning = extractReasoningFromRawResponse(additionalKwargs)
      const finalReasoningContent = reasoningContent || rawReasoning.reasoningContent

      // ToolMessage 直接走默认发送，不参与 reasoning 注入逻辑
      if (!isToolMsg) {
        // 构建要发送给前端的流式内容
        let streamContent: string | null = null

        // 处理流式 reasoning 内容
        if (finalReasoningContent) {
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

  if (ralphLog?.enabled && !loggedAnything && finalAssistantText) {
    appendLog({
      role: "ai",
      content: finalAssistantText
    })
  }

  return finalAssistantText || finalValuesText
}
