import type { AgentPromptContext } from "../types"

export function buildRalphModePrompt(_context: AgentPromptContext): string {
  return [
    "Ralph mode context:",
    "- This conversation may be part of an iterative execution workflow.",
    "- Follow the current user request and keep workflow state stable unless explicitly asked to reset."
  ].join("\n")
}
