import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { getActiveButlerMonitorManager } from "../butler/monitoring/runtime"
import type { ToolDefinition } from "../types"

export const calendarUpsertDefinition: ToolDefinition = {
  name: "calendar_upsert",
  label: "Calendar Upsert",
  description: "Create or update a calendar event for Butler monitor.",
  requiresKey: false
}

const createSchema = z.object({
  action: z.literal("create"),
  title: z.string().trim().min(1),
  startAt: z
    .string()
    .trim()
    .min(1)
    .describe("ISO datetime string (example: 2026-02-09T15:30:00+08:00)"),
  endAt: z.string().trim().optional().describe("Optional ISO datetime string"),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
  enabled: z.boolean().optional()
})

const updateSchema = z
  .object({
    action: z.literal("update"),
    eventId: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    startAt: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("ISO datetime string (example: 2026-02-09T15:30:00+08:00)"),
    endAt: z.string().trim().optional().describe("Optional ISO datetime string"),
    description: z.string().trim().optional(),
    location: z.string().trim().optional(),
    enabled: z.boolean().optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.startAt !== undefined ||
      value.endAt !== undefined ||
      value.description !== undefined ||
      value.location !== undefined ||
      value.enabled !== undefined,
    {
      message: "At least one update field must be provided."
    }
  )

const payloadSchema = z.discriminatedUnion("action", [createSchema, updateSchema])

export const calendarUpsertTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const manager = getActiveButlerMonitorManager()

    if (input.action === "create") {
      const event = manager.createCalendarEvent({
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        description: input.description,
        location: input.location,
        enabled: input.enabled ?? true
      })
      return {
        ok: true,
        action: "create",
        event
      }
    }

    const event = manager.updateCalendarEvent(input.eventId, {
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      description: input.description,
      location: input.location,
      enabled: input.enabled
    })
    return {
      ok: true,
      action: "update",
      event
    }
  },
  {
    name: calendarUpsertDefinition.name,
    description: calendarUpsertDefinition.description,
    schema: payloadSchema
  }
)

