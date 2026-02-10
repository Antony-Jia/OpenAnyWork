import { tool } from "langchain"
import { z } from "zod"
import { createCountdownWatchItem } from "../butler/monitoring/store"
import type { ToolDefinition } from "../types"

export const addCountdownTimerDefinition: ToolDefinition = {
  name: "add_countdown_timer",
  label: "Add Countdown Timer",
  description: "Add a countdown timer to Butler monitor.",
  requiresKey: false
}

const payloadSchema = z.object({
  title: z.string().trim().min(1),
  dueAt: z
    .string()
    .trim()
    .min(1)
    .describe("ISO datetime string (example: 2026-02-09T16:00:00+08:00)"),
  description: z.string().trim().optional()
})

export const addCountdownTimerTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const timer = createCountdownWatchItem({
      title: input.title,
      dueAt: input.dueAt,
      description: input.description
    })
    return {
      ok: true,
      timer
    }
  },
  {
    name: addCountdownTimerDefinition.name,
    description: addCountdownTimerDefinition.description,
    schema: payloadSchema
  }
)
