import { mkdirSync } from "fs"
import { join } from "path"
import { randomBytes } from "crypto"

export function createButlerTaskFolder(rootPath: string, mode: string): string {
  const now = new Date()
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`
  const shortCode = randomBytes(3).toString("hex")
  const folderName = `${day}_${mode}_${shortCode}`
  const fullPath = join(rootPath, folderName)
  mkdirSync(fullPath, { recursive: true })
  return fullPath
}
