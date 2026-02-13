import type { AgentPromptContext } from "../types"

export function buildExpertModePrompt(context: AgentPromptContext): string {
  void context
  return [
    "Expert conversation mode:",
    "- This request may be executed as a sequential expert pipeline.",
    "- Respect role-specific instructions injected by the runtime for the current expert.",
    "- Maintain strict, handoff-friendly outputs so downstream experts can continue reliably."
  ].join("\n")
}
