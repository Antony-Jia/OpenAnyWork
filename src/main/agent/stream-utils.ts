export function extractContent(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (typeof part === "object" && part) {
          const record = part as Record<string, unknown>
          if (typeof record.text === "string") return record.text
          if (typeof record.content === "string") return record.content
        }
        return ""
      })
      .join("")
  }
  return ""
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

const extractReasoningFromRawResponse = (
  additionalKwargs: Record<string, unknown>
): string | undefined => {
  const rawResponse = additionalKwargs.__raw_response as Record<string, unknown> | undefined
  if (!rawResponse) {
    return undefined
  }

  // 尝试从 Ark 格式提取 reasoning_content
  if (Array.isArray(rawResponse.choices)) {
    const choice = rawResponse.choices[0] as Record<string, unknown> | undefined
    // 先检查 message 字段（非流式响应）
    if (isRecord(choice?.message)) {
      const message = choice.message as Record<string, unknown>
      // Ark 使用 reasoning_content
      if (typeof message.reasoning_content === "string" && message.reasoning_content) {
        return message.reasoning_content
      }
      // Ollama 使用 reasoning
      if (typeof message.reasoning === "string" && message.reasoning) {
        return message.reasoning
      }
    }
    // 检查 delta 字段（流式响应）
    if (isRecord(choice?.delta)) {
      const delta = choice.delta as Record<string, unknown>
      // Ark 流式使用 delta.reasoning_content
      if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
        return delta.reasoning_content
      }
      // Ollama 流式使用 delta.reasoning
      if (typeof delta.reasoning === "string" && delta.reasoning) {
        return delta.reasoning
      }
    }
  }

  return undefined
}

export function extractAssistantChunkText(data: unknown): string | null {
  const tuple = data as [unknown, unknown]
  const msgChunk = tuple?.[0] as { id?: unknown; kwargs?: Record<string, unknown> } | undefined
  const kwargs = msgChunk?.kwargs || {}
  const content = extractContent(kwargs.content)

  // 从 __raw_response 提取 reasoning_content
  const additionalKwargs = isRecord(kwargs.additional_kwargs) ? kwargs.additional_kwargs : {}
  const reasoningContent = extractReasoningFromRawResponse(additionalKwargs)

  // 如果有 reasoning_content，包装成 <think/> 格式
  if (reasoningContent) {
    // 直接返回 reasoning_content（前端会处理成 thinking 标签）
    return reasoningContent
  }

  if (!content) {
    return null
  }

  const classId = Array.isArray(msgChunk?.id) ? msgChunk?.id : []
  const className = classId[classId.length - 1] || ""
  const kwargsId = typeof kwargs.id === "string" ? kwargs.id : ""

  if (className.includes("Tool") || className.includes("Human") || className.includes("System")) {
    return null
  }

  if (
    className.includes("AI") ||
    className.includes("Chat") ||
    kwargsId.startsWith("chatcmpl-") ||
    "response_metadata" in kwargs ||
    Array.isArray(kwargs.tool_call_chunks) ||
    Array.isArray(kwargs.tool_calls)
  ) {
    return content
  }

  return content
}
