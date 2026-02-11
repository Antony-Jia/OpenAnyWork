import type { ThreadMode } from "../../types"
import { buildBasePrompt } from "./base"
import { buildDefaultModePrompt } from "./modes/default"
import { buildEmailModePrompt } from "./modes/email"
import { buildLoopModePrompt } from "./modes/loop"
import { buildRalphModePrompt } from "./modes/ralph"
import type { AgentPromptContext, AgentPromptMode, ComposeAgentSystemPromptInput } from "./types"

function buildWorkspacePrompt(workspacePath: string): string {
  return `### File System and Paths

**IMPORTANT - Path Handling:**
- All file paths use fully qualified absolute system paths
- The workspace root is: \`${workspacePath}\`
- Example: \`${workspacePath}/src/index.ts\`, \`${workspacePath}/README.md\`
- To list the workspace root, use \`ls("${workspacePath}")\`
- Always use full absolute paths for all file operations`
}

function buildDockerPrompt(): string {
  return `### Docker Mode

- Use Docker tools for container operations: execute_bash, upload_file, download_file, edit_file, cat_file
- Container working directory is /workspace
- Local filesystem tools operate on the host, not inside the container`
}

function buildCurrentTimePrompt(now: Date): string {
  return `Current time: ${now.toISOString()}\nCurrent year: ${now.getFullYear()}`
}

export function resolveAgentPromptMode(threadMode?: ThreadMode): AgentPromptMode {
  switch (threadMode) {
    case "ralph":
      return "ralph"
    case "loop":
      return "loop"
    case "email":
      return "email"
    default:
      return "default"
  }
}

export function buildModePrompt(mode: AgentPromptMode, context: AgentPromptContext): string {
  switch (mode) {
    case "ralph":
      return buildRalphModePrompt(context)
    case "loop":
      return buildLoopModePrompt(context)
    case "email":
      return buildEmailModePrompt(context)
    case "default":
    default:
      return buildDefaultModePrompt(context)
  }
}

export function composeAgentSystemPrompt(input: ComposeAgentSystemPromptInput): string {
  const mode = resolveAgentPromptMode(input.threadMode)
  const now = input.now ?? new Date()
  const sections = [
    buildBasePrompt(input),
    buildWorkspacePrompt(input.workspacePath),
    input.dockerEnabled ? buildDockerPrompt() : "",
    buildModePrompt(mode, input),
    buildCurrentTimePrompt(now),
    input.extraSystemPrompt?.trim() || ""
  ]

  return sections.filter((section) => section.trim().length > 0).join("\n\n")
}
