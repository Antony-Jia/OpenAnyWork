import type { ThreadMode } from "../../types"

export type AgentPromptMode = "default" | "ralph" | "loop" | "email" | "expert"

export interface AgentPromptContext {
  threadId: string
  workspacePath: string
  isWindows: boolean
  dockerEnabled: boolean
  extraSystemPrompt?: string
  now?: Date
}

export interface ComposeAgentSystemPromptInput extends AgentPromptContext {
  threadMode?: ThreadMode
}
