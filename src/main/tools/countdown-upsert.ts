import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { getActiveButlerMonitorManager } from "../butler/monitoring/runtime"
import type { ToolDefinition } from "../types"

export const countdownUpsertDefinition: ToolDefinition = {
  name: "countdown_upsert",
  label: "Countdown Upsert",
  description: "Create or update a countdown timer for Butler monitor.",
  requiresKey: false
}

const createSchema = z.object({
  action: z.literal("create"),
  title: z.string().trim().min(1),
  dueAt: z
    .string()
    .trim()
    .min(1)
    .describe("ISO datetime string (example: 2026-02-09T16:00:00+08:00)"),
  description: z.string().trim().optional()
})

const updateSchema = z
  .object({
    action: z.literal("update"),
    timerId: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    dueAt: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("ISO datetime string (example: 2026-02-09T16:00:00+08:00)"),
    description: z.string().trim().optional(),
    status: z.enum(["running", "completed", "cancelled"]).optional(),
    completedAt: z.string().trim().optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.dueAt !== undefined ||
      value.description !== undefined ||
      value.status !== undefined ||
      value.completedAt !== undefined,
    {
      message: "At least one update field must be provided."
    }
  )

const payloadSchema = z.discriminatedUnion("action", [createSchema, updateSchema])

export const countdownUpsertTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const manager = getActiveButlerMonitorManager()

    if (input.action === "create") {
      const timer = manager.createCountdownTimer({
        title: input.title,
        dueAt: input.dueAt,
        description: input.description
      })
      return {
        ok: true,
        action: "create",
        timer
      }
    }

    const timer = manager.updateCountdownTimer(input.timerId, {
      title: input.title,
      dueAt: input.dueAt,
      description: input.description,
      status: input.status,
      completedAt: input.completedAt
    })
    return {
      ok: true,
      action: "update",
      timer
    }
  },
  {
    name: countdownUpsertDefinition.name,
    description: countdownUpsertDefinition.description,
    schema: payloadSchema
  }
)

