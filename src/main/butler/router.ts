import type { ThreadMode } from "../types"

// Butler routing decisions are handled by LLM orchestration tools.
// This module keeps only non-decision helper utilities.
export function buildTaskTitle(mode: Exclude<ThreadMode, "butler">, prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ")
  const prefix =
    mode === "email"
      ? "Email Task"
      : mode === "loop"
        ? "Loop Task"
        : mode === "ralph"
          ? "Ralph Task"
          : "Task"
  if (!cleaned) return prefix
  if (cleaned.length <= 36) return `${prefix}: ${cleaned}`
  return `${prefix}: ${cleaned.slice(0, 35)}…`
}
