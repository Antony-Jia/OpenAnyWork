import type { ButlerPromptSectionBuilder } from "../composer"

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function fallbackWeekday(value: string): string {
  const trimmed = value.trim()
  if (trimmed) return trimmed
  return WEEKDAY_LABELS[new Date().getDay()] || "Unknown"
}

function fallbackTimezone(value: string): string {
  const trimmed = value.trim()
  if (trimmed) return trimmed
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"
}

function fallbackLocalTime(value: string): string {
  const trimmed = value.trim()
  if (trimmed) return trimmed
  return new Date().toLocaleString()
}

function fallbackIso(value: string): string {
  const trimmed = value.trim()
  if (trimmed) return trimmed
  return new Date().toISOString()
}

export function buildTemporalSection(): ButlerPromptSectionBuilder {
  return {
    id: "temporal",
    build: ({ prompt }) => [
      "[Temporal Context]",
      `current_time_iso: ${fallbackIso(prompt.currentTimeIso || "")}`,
      `current_local_time: ${fallbackLocalTime(prompt.currentLocalTime || "")}`,
      `current_weekday: ${fallbackWeekday(prompt.currentWeekday || "")}`,
      `current_timezone: ${fallbackTimezone(prompt.currentTimezone || "")}`,
      "Use this context for relative time expressions like tomorrow, +3 days, or next Wednesday."
    ]
  }
}

