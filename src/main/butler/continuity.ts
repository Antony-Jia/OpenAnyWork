export interface ContinuityContext {
  previousUserMessage?: string
  currentUserMessage: string
}

// Continuity is decided by LLM in Butler orchestrator prompt/tool calls.
// Keep this module for potential future shared formatting only.
export function buildContinuityContext(input: ContinuityContext): string {
  return [
    "previous_user_message:",
    input.previousUserMessage?.trim() || "none",
    "current_user_message:",
    input.currentUserMessage.trim()
  ].join("\n")
}
