import { dialog, IpcMain } from "electron"
import * as fs from "fs/promises"
import * as path from "path"
import type { Attachment } from "../types"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGES = 6

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

export function registerAttachmentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("attachments:pick", async (_event, input: { kind: "image" }) => {
    if (!input || input.kind !== "image") return null

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
        size: stat.size
      })
    }

    return attachments
  })
}
