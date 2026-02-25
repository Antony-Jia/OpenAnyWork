import type { ButlerPromptSectionBuilder } from "../composer"

export function buildRouterSection(): ButlerPromptSectionBuilder {
  return {
    id: "router",
    build: ({ clarificationPrefix }) => [
      "[Router Instruction]",
      "Use semantic reasoning.",
      "Prefer direct daily-operation tools when they can complete the request.",
      "Use task-creation tools only when direct tools are insufficient or user explicitly asks for a task workflow.",
      "If task dispatch is feasible, call creation tools with valid JSON.",
      `If key information is missing, ask a focused follow-up prefixed with "${clarificationPrefix}".`
    ]
  }
}
