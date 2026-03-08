import type { ButlerPromptSectionBuilder } from "../composer"

export function buildRouterSection(): ButlerPromptSectionBuilder {
  return {
    id: "router",
    build: ({ clarificationPrefix }) => [
      "[Router Instruction]",
      "Use semantic reasoning.",
      "Prefer direct answer for memory/history/context questions that do not require tool execution.",
      "Before creating a new task, check whether current request semantically continues one of [Recent Butler Tasks] (top 5).",
      'If it is a continuation, prefer threadStrategy="reuse_last_thread".',
      "When target thread is clear, provide reuseThreadId; if confidence is low, ask a focused clarification.",
      "Direct tool calls are limited to read-only query tools: query_calendar_events, query_countdown_timers, query_rss_items, query_mailbox.",
      "If request requires fresh external information, write actions, or multi-step execution, create a task instead of direct tool calls.",
      "When task dispatch is feasible, call task-creation tools with valid JSON.",
      `If key information is missing, ask a focused follow-up prefixed with "${clarificationPrefix}".`
    ]
  }
}
