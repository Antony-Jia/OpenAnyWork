import { existsSync } from "node:fs"
import * as path from "node:path"
import { tool, type ToolRuntime } from "@langchain/core/tools"
import { z } from "zod"
import { getThread } from "../db"
import {
  DEFAULT_DOCUMENT_RETURN_CHARS,
  parseDocumentText,
  type ParseDocumentTextResult
} from "../services/document-parser"
import type { ToolDefinition } from "../types"

const parseWorkspaceDocumentSchema = z.object({
  file_path: z
    .string()
    .trim()
    .min(1)
    .describe("File path (absolute path or path relative to workspace)"),
  file_name: z.string().trim().min(1).describe("File name including extension"),
  return_chars: z
    .number()
    .int()
    .positive()
    .optional()
    .default(DEFAULT_DOCUMENT_RETURN_CHARS)
    .describe("Number of characters to return when return_all is false"),
  return_all: z.boolean().optional().default(false).describe("Return full parsed text when true")
})

export const parseWorkspaceDocumentDefinition: ToolDefinition = {
  name: "parse_workspace_document",
  label: "Parse Workspace Document",
  description:
    "Basic parser tool: parse text from workspace documents using common extraction methods only.",
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
  return path.resolve(workspacePath)
}

function isPathInsideWorkspace(workspacePath: string, targetPath: string): boolean {
  const relative = path.relative(workspacePath, targetPath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function resolveTargetFilePath(
  workspacePath: string,
  filePathInput: string,
  fileNameInput: string
): string {
  const filePath = filePathInput.trim()
  const fileName = fileNameInput.trim()

  const baseCandidate = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(workspacePath, filePath)
  const directCandidateMatches =
    path.basename(baseCandidate).toLowerCase() === fileName.toLowerCase()
  const joinedCandidate = path.resolve(baseCandidate, fileName)
  return directCandidateMatches ? baseCandidate : joinedCandidate
}

function formatToolResult(result: ParseDocumentTextResult) {
  return {
    ok: true,
    file_path: result.filePath,
    file_name: result.fileName,
    extension: result.extension,
    parser: result.parser,
    parse_notice: result.parseNotice,
    full_text_length: result.fullTextLength,
    returned_text_length: result.returnedTextLength,
    truncated: result.truncated,
    text: result.text
  }
}

export const parseWorkspaceDocumentTool = tool(
  async (
    {
      file_path,
      file_name,
      return_chars,
      return_all
    }: z.infer<typeof parseWorkspaceDocumentSchema>,
    runtime?: ToolRuntime
  ) => {
    const threadId = resolveRuntimeThreadId(runtime)
    if (!threadId) {
      throw new Error("Thread ID is required to resolve workspace path.")
    }

    const workspacePath = resolveWorkspacePath(threadId)
    const targetPath = resolveTargetFilePath(workspacePath, file_path, file_name)

    if (!isPathInsideWorkspace(workspacePath, targetPath)) {
      throw new Error("Path outside workspace is not allowed.")
    }

    if (!existsSync(targetPath)) {
      throw new Error(`File not found: ${targetPath}`)
    }

    try {
      const parsed = await parseDocumentText({
        filePath: targetPath,
        returnChars: return_chars,
        returnAll: return_all
      })
      return formatToolResult(parsed)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to parse document: ${message}`)
    }
  },
  {
    name: parseWorkspaceDocumentDefinition.name,
    description: parseWorkspaceDocumentDefinition.description,
    schema: parseWorkspaceDocumentSchema
  }
)
