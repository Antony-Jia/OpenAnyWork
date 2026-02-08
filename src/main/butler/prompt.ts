import type { ButlerDispatchIntent } from "./tools"

export interface ButlerPromptMemoryHint {
  threadId: string
  title?: string
  summaryBrief: string
}

export interface ButlerPromptRecentTask {
  id: string
  title: string
  mode: ButlerDispatchIntent["mode"]
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  threadId: string
  createdAt: string
}

export interface ButlerPromptContext {
  userMessage: string
  capabilityCatalog: string
  capabilitySummary: string
  profileText?: string
  comparisonText?: string
  memoryHints: ButlerPromptMemoryHint[]
  previousUserMessage?: string
  recentTasks: ButlerPromptRecentTask[]
}

const CLARIFICATION_PREFIX = "CLARIFICATION_REQUIRED:"

function formatMemoryHints(memoryHints: ButlerPromptMemoryHint[]): string {
  if (memoryHints.length === 0) {
    return "none"
  }
  return memoryHints
    .map((hint, index) => {
      const title = hint.title ? ` (${hint.title})` : ""
      return `${index + 1}. ${hint.threadId}${title}: ${hint.summaryBrief}`
    })
    .join("\n")
}

function formatRecentTasks(tasks: ButlerPromptRecentTask[]): string {
  if (tasks.length === 0) return "none"
  return tasks
    .map((task, index) => {
      return `${index + 1}. [${task.mode}/${task.status}] ${task.title} | thread=${task.threadId} | createdAt=${task.createdAt}`
    })
    .join("\n")
}

export function getClarificationPrefix(): string {
  return CLARIFICATION_PREFIX
}

export function buildButlerSystemPrompt(): string {
  return `
You are Butler AI orchestrator for OpenAnyWork.
You are the ONLY semantic router. Never use keyword heuristics.

Primary goals:
1) Understand user intent semantically.
2) Decide one of:
   - direct response (no tool call),
   - clarification (no tool call),
   - dispatch one or more tasks (tool calls).
3) For dispatch, you MUST use only these 4 tools:
   - create_default_task
   - create_ralph_task
   - create_email_task
   - create_loop_task

Dispatch rules:
- You may create multiple tasks in one turn.
- Use dependsOn to form dependency graph via taskKey.
- Independent tasks can run in parallel.
- Dependent tasks must be serializable by dependsOn.
- If key info is missing and you cannot produce valid tool JSON, do not call tools.
  Respond with prefix "${CLARIFICATION_PREFIX}" and ask only critical questions.
- If valid JSON can be produced, prioritize dispatch over unnecessary questions.

Thread strategy:
- "reuse_last_thread": continue the most recent relevant thread for that mode.
- "new_thread": create a fresh thread.

Handoff:
- method "context": upstream summary passed into downstream prompt.
- method "filesystem": downstream workspace receives .butler_handoff.json.
- method "both": both mechanisms.

JSON field contract (all tools):
- taskKey: unique key in this turn.
- title: user-facing task title.
- initialPrompt: executable prompt for worker thread.
- threadStrategy: "new_thread" | "reuse_last_thread".
- dependsOn: taskKey[] (optional).
- handoff: { method, note?, requiredArtifacts? } (optional).

Mode requirements:
- default: deliverableFormat? ("text" | "data" | "table" | "page")
- ralph: acceptanceCriteria (string[] required), maxIterations? (number)
- email: emailIntent (required), recipientHints? (string[]), tone? (string)
- loop: loopConfig (required and executable)

Output rules:
- After tool calls, provide concise Chinese summary for user.
- Never mention internal hidden chain-of-thought.
- Never invoke any business tools directly from this orchestrator.
`.trim()
}

export function buildButlerUserPrompt(context: ButlerPromptContext): string {
  const sections = [
    "[User Request]",
    context.userMessage.trim(),
    "",
    "[Capability Summary]",
    context.capabilitySummary,
    "",
    context.capabilityCatalog,
    "",
    "[Memory Hints]",
    formatMemoryHints(context.memoryHints),
    "",
    "[Previous User Message]",
    context.previousUserMessage?.trim() || "none",
    "",
    "[Recent Butler Tasks]",
    formatRecentTasks(context.recentTasks),
    "",
    "[Daily Profile]",
    context.profileText?.trim() || "none",
    "",
    "[Profile Delta]",
    context.comparisonText?.trim() || "none",
    "",
    "[Instruction]",
    "Use semantic reasoning. If dispatch is feasible, call creation tools with valid JSON. If not feasible, respond with clarification prefix."
  ]
  return sections.join("\n")
}

export function parseButlerAssistantText(raw: string): {
  assistantText: string
  clarification: boolean
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { assistantText: "", clarification: false }
  }

  if (trimmed.startsWith(CLARIFICATION_PREFIX)) {
    const stripped = trimmed.slice(CLARIFICATION_PREFIX.length).trim()
    return {
      assistantText: stripped || "请补充关键信息。",
      clarification: true
    }
  }

  return {
    assistantText: trimmed,
    clarification: false
  }
}

