import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { getActiveButlerMonitorManager } from "../butler/monitoring/runtime"
import type { ToolDefinition } from "../types"

export const queryMailboxDefinition: ToolDefinition = {
  name: "query_mailbox",
  label: "Query Mailbox",
  description: "Read mailbox proactively by today or latest N mails.",
  requiresKey: false
}

const payloadSchema = z.object({
  mode: z.enum(["today", "latest"]).optional().default("latest"),
  limit: z.number().int().min(1).max(100).optional().default(10),
  unreadOnly: z.boolean().optional().default(false)
})

function compact(text: string, max = 280): string {
  const normalized = text.trim().replace(/\s+/g, " ")
  if (!normalized) return ""
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

export const queryMailboxTool = tool(
  async (input: z.infer<typeof payloadSchema>) => {
    const manager = getActiveButlerMonitorManager()
    const rows = await manager.queryMailboxNow({
      mode: input.mode,
      limit: input.limit,
      unreadOnly: input.unreadOnly
    })

    const mails = rows.map((mail) => ({
      id: mail.id,
      uid: mail.uid,
      subject: mail.subject || "(无主题)",
      from: mail.from || "unknown",
      receivedAt: mail.receivedAt,
      snippet: compact(mail.text, 280)
    }))

    return {
      ok: true,
      mode: input.mode,
      unreadOnly: input.unreadOnly,
      count: mails.length,
      mails
    }
  },
  {
    name: queryMailboxDefinition.name,
    description: queryMailboxDefinition.description,
    schema: payloadSchema
  }
)

