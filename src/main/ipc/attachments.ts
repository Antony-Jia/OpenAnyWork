import { dialog, IpcMain } from "electron"
import * as fs from "fs/promises"
import * as path from "path"
import {
  DEFAULT_DOCUMENT_RETURN_CHARS,
  parseDocumentText,
  SUPPORTED_DOCUMENT_FILTER_EXTENSIONS
} from "../services/document-parser"
import type { Attachment } from "../types"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
const MAX_IMAGES = 6
const MAX_DOCUMENTS = 6

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
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

function getDocumentMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case ".pdf":
      return "application/pdf"
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    case ".md":
    case ".markdown":
      return "text/markdown"
    case ".txt":
      return "text/plain"
    default:
      return "text/plain"
  }
}

export function registerAttachmentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("attachments:pick", async (_event, input: { kind: "image" | "document" }) => {
    if (!input || (input.kind !== "image" && input.kind !== "document")) return null

    if (input.kind === "image") {
      const result = await dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
        title: "Select Images",
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"]
          }
        ]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      const selected = result.filePaths.slice(0, MAX_IMAGES)
      const attachments: Attachment[] = []

      for (const filePath of selected) {
        const stat = await fs.stat(filePath)
        if (stat.size > MAX_IMAGE_BYTES) {
          throw new Error(`Image too large: ${path.basename(filePath)}`)
        }

        const buffer = await fs.readFile(filePath)
        const mimeType = getMimeType(filePath)
        const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`
        attachments.push({
          kind: "image",
          name: path.basename(filePath),
          mimeType,
          dataUrl,
          size: stat.size,
          path: filePath
        })
      }

      return attachments
    }

    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      title: "Select Documents",
      filters: [
        {
          name: "Supported Documents",
          extensions: SUPPORTED_DOCUMENT_FILTER_EXTENSIONS
        }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selected = result.filePaths.slice(0, MAX_DOCUMENTS)
    const attachments: Attachment[] = []

    for (const filePath of selected) {
      const stat = await fs.stat(filePath)
      if (stat.size > MAX_DOCUMENT_BYTES) {
        throw new Error(`Document too large: ${path.basename(filePath)}`)
      }

      try {
        const parsed = await parseDocumentText({
          filePath,
          returnChars: DEFAULT_DOCUMENT_RETURN_CHARS,
          returnAll: false
        })

        attachments.push({
          kind: "document",
          name: path.basename(filePath),
          path: parsed.filePath,
          mimeType: getDocumentMimeType(filePath),
          size: stat.size,
          parser: parsed.parser,
          parseNotice: parsed.parseNotice,
          extractedText: parsed.text,
          fullTextLength: parsed.fullTextLength,
          returnedTextLength: parsed.returnedTextLength,
          truncated: parsed.truncated
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to parse document ${path.basename(filePath)}: ${message}`)
      }
    }

    return attachments
  })
}
