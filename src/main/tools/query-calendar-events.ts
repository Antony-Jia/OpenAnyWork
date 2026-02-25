import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { getActiveButlerMonitorManager } from "../butler/monitoring/runtime"
import type { ToolDefinition } from "../types"

export const queryCalendarEventsDefinition: ToolDefinition = {
  name: "query_calendar_events",
  label: "Query Calendar Events",
  description: "Query calendar events by time range.",
  requiresKey: false
}

const payloadSchema = z.object({
  startAt: z
    .string()
    .trim()
    .min(1)
    .describe("ISO datetime string (example: 2026-02-09T00:00:00+08:00)"),
  endAt: z
    .string()
    .trim()
    .optional()
    .describe("Optional ISO datetime string (example: 2026-02-10T00:00:00+08:00)"),
  includeDisabled: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(20)
})

function toTimestamp(value: string): number {
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) {
    throw new Error(`Invalid ISO datetime: ${value}`)
  }
  return ts
}

export const queryCalendarEventsTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const manager = getActiveButlerMonitorManager()
    const rangeStart = toTimestamp(input.startAt)
    const rangeEnd = input.endAt ? toTimestamp(input.endAt) : Number.POSITIVE_INFINITY

    const events = manager
      .listCalendarEvents()
      .filter((event) => (input.includeDisabled ? true : event.enabled))
      .filter((event) => {
        const startTs = new Date(event.startAt).getTime()
        if (!Number.isFinite(startTs)) return false
        return startTs >= rangeStart && startTs <= rangeEnd
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, input.limit)

    return {
      ok: true,
      count: events.length,
      events
    }
  },
  {
    name: queryCalendarEventsDefinition.name,
    description: queryCalendarEventsDefinition.description,
    schema: payloadSchema
  }
)

