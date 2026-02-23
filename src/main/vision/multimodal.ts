import * as fs from "node:fs/promises"
import * as path from "node:path"
import { ChatOpenAI } from "@langchain/openai"
import { getProviderState } from "../provider-config"
import type { MultimodalConfig, ProviderState } from "../types"

export const DEFAULT_IMAGE_ANALYSIS_PROMPT =
  "请详细描述这张图片的内容，并结合用户的提问重点提取信息"
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function extractTextFromModelContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim()
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (!part || typeof part !== "object") return ""
        const record = part as Record<string, unknown>
        if (record.type === "text" && typeof record.text === "string") return record.text
        if (typeof record.text === "string") return record.text
        if (typeof record.content === "string") return record.content
        return ""
      })
      .join("\n")
      .trim()
  }
  return ""
}

export function isMultimodalConfigured(state?: ProviderState | null): boolean {
  const effectiveState = state ?? getProviderState()
  if (!effectiveState) return false
  const config = effectiveState.configs.multimodal
  if (!config || config.type !== "multimodal") return false
  return Boolean(config.url?.trim() && config.apiKey?.trim() && config.model?.trim())
}

function resolveMultimodalConfig(state?: ProviderState | null): MultimodalConfig | null {
  const effectiveState = state ?? getProviderState()
  if (!effectiveState) return null
  const config = effectiveState.configs.multimodal
  if (!config || config.type !== "multimodal") return null
  if (!config.url?.trim() || !config.apiKey?.trim() || !config.model?.trim()) return null
  return config
}

export function getMultimodalDisabledReason(state?: ProviderState | null): string {
  return isMultimodalConfigured(state)
    ? ""
    : "Multimodal provider requires URL, API key, and model in Settings."
}

export function createMultimodalClient(state?: ProviderState | null): ChatOpenAI {
  const config = resolveMultimodalConfig(state)
  if (!config) {
    throw new Error(getMultimodalDisabledReason(state))
  }

  return new ChatOpenAI({
    model: config.model.trim(),
    apiKey: config.apiKey.trim(),
    configuration: {
      baseURL: config.url.trim()
    }
  })
}

function resolveImageMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".gif":
      return "image/gif"
    case ".bmp":
      return "image/bmp"
    case ".svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}

export function resolveWorkspaceImagePath(workspacePath: string, filePath: string): string {
  const trimmedWorkspace = workspacePath.trim()
  const trimmedFilePath = filePath.trim()
  if (!trimmedWorkspace) {
    throw new Error("Workspace path is required.")
  }
  if (!trimmedFilePath) {
    throw new Error("Image file_path is required.")
  }

  const resolvedWorkspace = path.resolve(trimmedWorkspace)
  const resolvedPath = path.isAbsolute(trimmedFilePath)
    ? path.resolve(trimmedFilePath)
    : path.resolve(resolvedWorkspace, trimmedFilePath)
  const relative = path.relative(resolvedWorkspace, resolvedPath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Image file_path must be inside workspace.")
  }
  return resolvedPath
}

export async function analyzeImageDataUrl({
  dataUrl,
  prompt,
  userQuestion
}: {
  dataUrl: string
  prompt?: string
  userQuestion?: string
}): Promise<string> {
  const trimmedDataUrl = dataUrl.trim()
  if (!trimmedDataUrl) {
    throw new Error("Image data URL is empty.")
  }

  const client = createMultimodalClient()
  const analysisPrompt = (prompt?.trim() || DEFAULT_IMAGE_ANALYSIS_PROMPT).trim()
  const focusQuestion = (userQuestion?.trim() || "").trim()
  const userPrompt = [analysisPrompt, "", `用户提问重点：${focusQuestion || "（无）"}`].join("\n")

  const response = await client.invoke([
    {
      role: "user",
      content: [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: trimmedDataUrl } }
      ]
    }
  ])
  const content = extractTextFromModelContent((response as { content?: unknown }).content)
  if (!content) {
    throw new Error("Multimodal model returned empty analysis.")
  }
  return content
}

export async function analyzeImageFile({
  workspacePath,
  filePath,
  prompt,
  userQuestion
}: {
  workspacePath: string
  filePath: string
  prompt?: string
  userQuestion?: string
}): Promise<{ analysis: string; mimeType: string; resolvedPath: string }> {
  const resolvedPath = resolveWorkspaceImagePath(workspacePath, filePath)
  const stat = await fs.stat(resolvedPath)
  if (!stat.isFile()) {
    throw new Error(`Image path is not a file: ${resolvedPath}`)
  }
  if (stat.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds ${MAX_IMAGE_BYTES / (1024 * 1024)}MB limit: ${resolvedPath}`)
  }

  const mimeType = resolveImageMimeType(resolvedPath)
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Unsupported image file type: ${resolvedPath}`)
  }

  const buffer = await fs.readFile(resolvedPath)
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`
  const analysis = await analyzeImageDataUrl({ dataUrl, prompt, userQuestion })
  return { analysis, mimeType, resolvedPath }
}
