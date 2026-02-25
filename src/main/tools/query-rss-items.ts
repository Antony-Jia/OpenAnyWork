import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { getActiveButlerMonitorManager } from "../butler/monitoring/runtime"
import type { RssWatchItem, ToolDefinition } from "../types"

export const queryRssItemsDefinition: ToolDefinition = {
  name: "query_rss_items",
  label: "Query RSS Items",
  description: "Query recent RSS items with summary or detailed content.",
  requiresKey: false
}

const payloadSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10),
  subscriptionId: z.string().trim().optional(),
  detailLevel: z.enum(["summary", "detailed"]).optional().default("summary")
})

function compact(text: string, max = 280): string {
  const normalized = text.trim().replace(/\s+/g, " ")
  if (!normalized) return ""
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

function toResponseItem(item: RssWatchItem, detailLevel: "summary" | "detailed") {
  const summary = compact(item.summary, 280)
  if (detailLevel === "detailed") {
    return {
      id: item.id,
      subscriptionId: item.subscriptionId,
      itemKey: item.itemKey,
      title: item.title,
      link: item.link,
      publishedAt: item.publishedAt,
      summary,
      content: item.summary
    }
  }
  return {
    id: item.id,
    subscriptionId: item.subscriptionId,
    itemKey: item.itemKey,
    title: item.title,
    link: item.link,
    publishedAt: item.publishedAt,
    summary
  }
}

export const queryRssItemsTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const manager = getActiveButlerMonitorManager()
    const bufferedLimit = Math.max(input.limit * 5, 30)
    const items = manager
      .listRecentRssItems(bufferedLimit)
      .filter((item) => {
        if (!input.subscriptionId) return true
        return item.subscriptionId === input.subscriptionId
      })
      .slice(0, input.limit)
      .map((item) => toResponseItem(item, input.detailLevel))

    return {
      ok: true,
      count: items.length,
      items
    }
  },
  {
    name: queryRssItemsDefinition.name,
    description: queryRssItemsDefinition.description,
    schema: payloadSchema
  }
)

