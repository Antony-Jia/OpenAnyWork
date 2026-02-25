import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { getActiveButlerMonitorManager } from "../butler/monitoring/runtime"
import type { ToolDefinition } from "../types"

export const queryCountdownTimersDefinition: ToolDefinition = {
  name: "query_countdown_timers",
  label: "Query Countdown Timers",
  description: "Query countdown timers by status and due range.",
  requiresKey: false
}

const payloadSchema = z.object({
  status: z.enum(["running", "completed", "cancelled", "all"]).optional().default("all"),
  dueStartAt: z
    .string()
    .trim()
    .optional()
    .describe("Optional ISO datetime string (example: 2026-02-09T00:00:00+08:00)"),
  dueEndAt: z
    .string()
    .trim()
    .optional()
    .describe("Optional ISO datetime string (example: 2026-02-10T00:00:00+08:00)"),
  limit: z.number().int().min(1).max(200).optional().default(20)
})

function parseTsOrDefault(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) {
    throw new Error(`Invalid ISO datetime: ${value}`)
  }
  return ts
}

export const queryCountdownTimersTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const manager = getActiveButlerMonitorManager()
    const rangeStart = parseTsOrDefault(input.dueStartAt, Number.NEGATIVE_INFINITY)
    const rangeEnd = parseTsOrDefault(input.dueEndAt, Number.POSITIVE_INFINITY)

    const timers = manager
      .listCountdownTimers()
      .filter((timer) => (input.status === "all" ? true : timer.status === input.status))
      .filter((timer) => {
        const dueTs = new Date(timer.dueAt).getTime()
        if (!Number.isFinite(dueTs)) return false
        return dueTs >= rangeStart && dueTs <= rangeEnd
      })
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, input.limit)

    return {
      ok: true,
      count: timers.length,
      timers
    }
  },
  {
    name: queryCountdownTimersDefinition.name,
    description: queryCountdownTimersDefinition.description,
    schema: payloadSchema
  }
)

