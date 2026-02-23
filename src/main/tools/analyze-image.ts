import { tool, type ToolRuntime } from "@langchain/core/tools"
import { z } from "zod"
import { getThread } from "../db"
import { getSettings } from "../settings"
import type { ToolDefinition } from "../types"
import {
  analyzeImageFile,
  getMultimodalDisabledReason,
  isMultimodalConfigured
} from "../vision/multimodal"

const payloadSchema = z.object({
  file_path: z
    .string()
    .trim()
    .min(1)
    .describe("File path (absolute path or path relative to current workspace)"),
  prompt: z.string().trim().min(1).describe("Specific vision question to ask about the image")
})

export const analyzeImageDefinition: ToolDefinition = {
  name: "analyze_image",
  label: "Analyze Image",
  description: "Analyze an image file from workspace with the configured multimodal model.",
  requiresKey: false
}

function resolveRuntimeThreadId(runtime?: ToolRuntime): string | undefined {
  const top = runtime as unknown as { configurable?: { thread_id?: unknown } }
  if (typeof top?.configurable?.thread_id === "string" && top.configurable.thread_id.trim()) {
    return top.configurable.thread_id.trim()
  }
  const nested = runtime as unknown as { config?: { configurable?: { thread_id?: unknown } } }
  if (
    typeof nested?.config?.configurable?.thread_id === "string" &&
    nested.config.configurable.thread_id.trim()
  ) {
    return nested.config.configurable.thread_id.trim()
  }
  return undefined
}

function resolveWorkspacePath(threadId: string): string {
  const row = getThread(threadId)
  if (!row) {
    throw new Error(`Thread not found: ${threadId}`)
  }
  const metadata = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {}
  const workspacePath =
    typeof metadata.workspacePath === "string" ? metadata.workspacePath.trim() : ""
  if (!workspacePath) {
    throw new Error("Workspace path is missing for this thread.")
  }
  return workspacePath
}

function assertToolEnabled(): void {
  const settings = getSettings()
  if (settings.vision?.toolCallingEnabled === false) {
    throw new Error("Visual tool mode is disabled in Settings.")
  }
  if (!isMultimodalConfigured()) {
    throw new Error(getMultimodalDisabledReason())
  }
}

export const analyzeImageTool = tool(
  async ({ file_path, prompt }: z.infer<typeof payloadSchema>, runtime?: ToolRuntime) => {
    assertToolEnabled()
    const threadId = resolveRuntimeThreadId(runtime)
    if (!threadId) {
      throw new Error("Thread ID is required to resolve workspace path.")
    }
    const workspacePath = resolveWorkspacePath(threadId)
    const result = await analyzeImageFile({
      workspacePath,
      filePath: file_path,
      prompt
    })
    return {
      ok: true,
      file_path: result.resolvedPath,
      mime_type: result.mimeType,
      analysis: result.analysis
    }
  },
  {
    name: analyzeImageDefinition.name,
    description: analyzeImageDefinition.description,
    schema: payloadSchema
  }
)
