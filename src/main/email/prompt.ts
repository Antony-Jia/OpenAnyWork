import { buildEmailModePromptForThread } from "../agent/prompts/modes/email"

/**
 * @deprecated Use mode-based prompt loading in src/main/agent/prompts instead.
 */
export function buildEmailModePrompt(threadId: string): string {
  return buildEmailModePromptForThread(threadId)
}
