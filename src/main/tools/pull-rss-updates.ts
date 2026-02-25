import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { getActiveButlerMonitorManager } from "../butler/monitoring/runtime"
import type { ToolDefinition } from "../types"

export const pullRssUpdatesDefinition: ToolDefinition = {
  name: "pull_rss_updates",
  label: "Pull RSS Updates",
  description: "Pull latest RSS updates now.",
  requiresKey: false
}

const payloadSchema = z.object({
  includeItems: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(100).optional().default(10)
})

export const pullRssUpdatesTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const manager = getActiveButlerMonitorManager()
    const inserted = await manager.pullRssNow("manual")
    const ordered = [...inserted].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    const items = input.includeItems ? ordered.slice(0, input.limit) : undefined

    return {
      ok: true,
      rssCount: inserted.length,
      items
    }
  },
  {
    name: pullRssUpdatesDefinition.name,
    description: pullRssUpdatesDefinition.description,
    schema: payloadSchema
  }
)

