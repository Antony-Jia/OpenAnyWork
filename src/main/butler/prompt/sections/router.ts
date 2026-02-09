import type { ButlerPromptSectionBuilder } from "../composer"

export function buildRouterSection(): ButlerPromptSectionBuilder {
  return {
    id: "router",
    build: ({ clarificationPrefix }) => [
      "[Router Instruction]",
      "Use semantic reasoning.",
      "If dispatch is feasible, call creation tools with valid JSON.",
      `If key information is missing, ask a focused follow-up prefixed with "${clarificationPrefix}".`
    ]
  }
}
