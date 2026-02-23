import { getProviderState } from "../provider-config"
import { getSettings } from "../settings"
import type { ContentBlock, ThreadMode } from "../types"
import {
  analyzeImageFile,
  DEFAULT_IMAGE_ANALYSIS_PROMPT,
  getMultimodalDisabledReason,
  isMultimodalConfigured,
  resolveWorkspaceImagePath
} from "./multimodal"

const MAX_FOCUS_QUESTION_CHARS = 1200

function extractTextFromBlocks(content: ContentBlock[]): string {
  return content
    .map((block) => (block.type === "text" && typeof block.text === "string" ? block.text : ""))
    .join("\n")
    .trim()
}

function trimFocusQuestion(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ")
  if (trimmed.length <= MAX_FOCUS_QUESTION_CHARS) return trimmed
  return `${trimmed.slice(0, MAX_FOCUS_QUESTION_CHARS)}...`
}

function hasImageBlocks(message: string | ContentBlock[]): boolean {
  if (!Array.isArray(message)) return false
  return message.some((block) => block.type === "image" || block.type === "image_url")
}

function getImageFilePath(block: ContentBlock): string {
  const candidate = typeof block.file_path === "string" ? block.file_path.trim() : ""
  if (!candidate) {
    throw new Error(
      "Image preprocessing requires file_path. Please attach images from workspace and retry."
    )
  }
  return candidate
}

function buildToolReferenceText(index: number, resolvedPath: string): string {
  return [
    `[Attached Image #${index}]`,
    `file_path: ${resolvedPath}`,
    "note: use analyze_image(file_path, prompt) when visual detail is required"
  ].join("\n")
}

export async function prepareIncomingMessage({
  workspacePath,
  message
}: {
  threadId: string
  workspacePath: string
  mode: ThreadMode
  message: string | ContentBlock[]
}): Promise<{ processedMessage: string | ContentBlock[]; processedText: string }> {
  if (!Array.isArray(message)) {
    return {
      processedMessage: message,
      processedText: typeof message === "string" ? message : ""
    }
  }

  const originalText = extractTextFromBlocks(message)
  if (!hasImageBlocks(message)) {
    return { processedMessage: message, processedText: originalText }
  }

  const settings = getSettings()
  const vision = settings.vision ?? {
    preprocessInterceptEnabled: true,
    toolCallingEnabled: true
  }
  const providerState = getProviderState()
  const activeProvider = providerState?.active
  const multimodalReady = isMultimodalConfigured(providerState)

  if (vision.preprocessInterceptEnabled && activeProvider !== "multimodal") {
    if (!multimodalReady) {
      throw new Error(getMultimodalDisabledReason(providerState))
    }

    const processedBlocks: ContentBlock[] = []
    let imageIndex = 0
    const focusQuestion = trimFocusQuestion(originalText)
    for (const block of message) {
      if (block.type !== "image" && block.type !== "image_url") {
        processedBlocks.push(block)
        continue
      }

      imageIndex += 1
      const imagePath = getImageFilePath(block)
      const { analysis, resolvedPath } = await analyzeImageFile({
        workspacePath,
        filePath: imagePath,
        prompt: DEFAULT_IMAGE_ANALYSIS_PROMPT,
        userQuestion: focusQuestion
      })
      processedBlocks.push({
        type: "text",
        text: [
          `[Image Analysis #${imageIndex}]`,
          `file_path: ${resolvedPath}`,
          `focus_question: ${focusQuestion || "（无）"}`,
          `description: ${analysis}`
        ].join("\n")
      })
    }

    return {
      processedMessage: processedBlocks,
      processedText: extractTextFromBlocks(processedBlocks)
    }
  }

  if (vision.toolCallingEnabled) {
    if (!multimodalReady) {
      throw new Error(getMultimodalDisabledReason(providerState))
    }

    const processedBlocks: ContentBlock[] = []
    let imageIndex = 0
    for (const block of message) {
      if (block.type !== "image" && block.type !== "image_url") {
        processedBlocks.push(block)
        continue
      }

      imageIndex += 1
      const imagePath = getImageFilePath(block)
      const resolvedPath = resolveWorkspaceImagePath(workspacePath, imagePath)
      processedBlocks.push({
        type: "text",
        text: buildToolReferenceText(imageIndex, resolvedPath)
      })
    }

    return {
      processedMessage: processedBlocks,
      processedText: extractTextFromBlocks(processedBlocks)
    }
  }

  return {
    processedMessage: message,
    processedText: originalText
  }
}
