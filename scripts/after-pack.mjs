import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { rcedit } from "rcedit"

const iconPath = resolve("resources/icon.ico")

/**
 * @param {object} context
 * @param {string} context.electronPlatformName
 * @param {object} context.packager
 * @param {object} context.packager.appInfo
 * @param {string} context.packager.appInfo.productFilename
 * @param {string} context.appOutDir
 * @returns {Promise<void>}
 */
export default async function afterPack(context) {
  if (context?.electronPlatformName !== "win32") {
    return
  }

  if (!existsSync(iconPath)) {
    console.warn(`[after-pack] Icon not found: ${iconPath}`)
    return
  }

  const productFilename = context?.packager?.appInfo?.productFilename
  const appOutDir = context?.appOutDir
  if (!productFilename || !appOutDir) {
    console.warn("[after-pack] Missing app output context, skip icon patch.")
    return
  }

  const exePath = join(appOutDir, `${productFilename}.exe`)
  if (!existsSync(exePath)) {
    console.warn(`[after-pack] Executable not found: ${exePath}`)
    return
  }

  await rcedit(exePath, { icon: iconPath })
  console.log(`[after-pack] Updated icon for ${exePath}`)
}
