import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ToolDefinition } from "../types"
import { pluginHost } from "../plugins/core/host"
import { logEntry, logExit } from "../logging"

export const kbRetrieveDefinition: ToolDefinition = {
  name: "kb_retrieve",
  label: "Knowledge Base",
  description: "Retrieve semantic matches from the local Knowledge Base plugin.",
  requiresKey: false,
  kind: "plugin",
  pluginId: "knowledgebase"
}

export const kbRetrieveTool = tool(
  async (input: {
    query: string
    collection_ids?: string[]
    top_k?: number
    include_chunks?: boolean
    filters?: Record<string, string | number | boolean>
  }) => {
    const startedAt = Date.now()
    logEntry("Tool", "kb_retrieve", {
      queryLength: input.query?.length ?? 0,
      requestedCollections: input.collection_ids?.length ?? 0
    })

    await pluginHost.hydrateFromSettings()
    const runtime = await pluginHost.getKnowledgebaseState()
    if (!runtime.enabled) {
      throw new Error("Knowledge Base plugin is disabled. Enable it in Plugins first.")
    }
    if (!runtime.config.daemonExePath || !runtime.daemonExeExists) {
      throw new Error(
        "Knowledge Base daemon executable is not configured. Set it in Plugins > Knowledge Base."
      )
    }

    let collectionIds = input.collection_ids ?? []
    if (collectionIds.length === 0) {
      const collections = await pluginHost.listKnowledgebaseCollections()
      collectionIds = collections.map((collection) => collection.id)
    }
    if (collectionIds.length === 0) {
      throw new Error("No collections are available in Knowledge Base.")
    }

    const result = await pluginHost.retrieveKnowledgebase({
      query: input.query,
      collection_ids: collectionIds,
      top_k: input.top_k,
      include_chunks: input.include_chunks,
      filters: input.filters
    })
    logExit(
      "Tool",
      "kb_retrieve",
      {
        chunkCount: result.chunks?.length ?? 0
      },
      Date.now() - startedAt
    )
    return result
  },
  {
    name: kbRetrieveDefinition.name,
    description: kbRetrieveDefinition.description,
    schema: z.object({
      query: z.string().min(1).describe("Semantic query text."),
      collection_ids: z
        .array(z.string())
        .optional()
        .describe("Optional collection IDs. Empty means all collections."),
      top_k: z.number().int().positive().optional().describe("Optional max retrieval count."),
      include_chunks: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include chunk text in response."),
      filters: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe("Optional metadata equality filters.")
    })
  }
)
