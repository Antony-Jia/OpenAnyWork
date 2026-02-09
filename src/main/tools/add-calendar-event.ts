import { tool } from "langchain"
import { z } from "zod"
import { createCalendarWatchEvent } from "../butler/monitoring/store"
import type { ToolDefinition } from "../types"

export const addCalendarEventDefinition: ToolDefinition = {
  name: "add_calendar_event",
  label: "Add Calendar Event",
  description: "Add an event to Butler monitor calendar.",
  requiresKey: false
}

const payloadSchema = z.object({
  title: z.string().trim().min(1),
  startAt: z
    .string()
    .trim()
    .min(1)
    .describe("ISO datetime string (example: 2026-02-09T15:30:00+08:00)"),
  endAt: z
    .string()
    .trim()
    .optional()
    .describe("Optional ISO datetime string"),
  description: z.string().trim().optional(),
  location: z.string().trim().optional()
})

export const addCalendarEventTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const event = createCalendarWatchEvent({
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      description: input.description,
      location: input.location,
      enabled: true
    })
    return {
      ok: true,
      event
    }
  },
  {
    name: addCalendarEventDefinition.name,
    description: addCalendarEventDefinition.description,
    schema: payloadSchema
  }
)

