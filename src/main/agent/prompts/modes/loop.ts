import type { AgentPromptContext } from "../types"

export function buildLoopModePrompt(_context: AgentPromptContext): string {
  return [
    "Loop mode context:",
    "- This request may be automatically triggered by schedule, API, or file events.",
    "- Treat any trigger marker/data in the user message as execution context, then complete the requested work."
  ].join("\n")
}
