import type {
  ButlerPromptMemoryHint,
  ButlerPromptRecentTask
} from "../../prompt"
import type { ButlerPromptSectionBuilder } from "../composer"

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

export function buildMemorySection(): ButlerPromptSectionBuilder {
  return {
    id: "memory",
    build: ({ prompt }) => [
      "[Memory Hints]",
      formatMemoryHints(prompt.memoryHints),
      "",
      "[Previous User Message]",
      prompt.previousUserMessage?.trim() || "none",
      "",
      "[Recent Butler Tasks]",
      formatRecentTasks(prompt.recentTasks),
      "",
      "[Daily Profile]",
      prompt.profileText?.trim() || "none",
      "",
      "[Profile Delta]",
      prompt.comparisonText?.trim() || "none"
    ]
  }
}
