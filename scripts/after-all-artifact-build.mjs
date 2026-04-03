import { existsSync } from "node:fs"
import { basename, resolve } from "node:path"
import { rcedit } from "rcedit"

const iconPath = resolve("resources/icon.ico")

function shouldPatchExe(artifactPath) {
  const name = basename(artifactPath).toLowerCase()
  return name.endsWith(".exe") && !name.includes("setup")
}

export default async function afterAllArtifactBuild(buildResult) {
  if (process.platform !== "win32") {
    return []
  }

  if (!existsSync(iconPath)) {
    console.warn(`[after-all-artifact-build] Icon not found: ${iconPath}`)
    return []
  }

  const artifactPaths = Array.isArray(buildResult?.artifactPaths) ? buildResult.artifactPaths : []
  const exePaths = artifactPaths.filter(shouldPatchExe)

  for (const exePath of exePaths) {
    await rcedit(exePath, { icon: iconPath })
    console.log(`[after-all-artifact-build] Updated icon for ${exePath}`)
  }

  return []
}
