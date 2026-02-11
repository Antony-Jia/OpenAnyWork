import { getBaseSystemPrompt } from "../system-prompt"
import type { AgentPromptContext } from "./types"

export function buildBasePrompt(context: AgentPromptContext): string {
  return getBaseSystemPrompt({ isWindows: context.isWindows })
}
