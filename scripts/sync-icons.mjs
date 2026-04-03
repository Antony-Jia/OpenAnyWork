import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import pngToIco from "png-to-ico"

const resourcesDir = resolve("resources")
const pngPath = resolve(resourcesDir, "icon.png")
const icoPath = resolve(resourcesDir, "icon.ico")

async function main() {
  const pngBuffer = await readFile(pngPath)
  const icoBuffer = await pngToIco(pngBuffer)

  await mkdir(resourcesDir, { recursive: true })
  await writeFile(icoPath, icoBuffer)

  console.log(`Synced ${icoPath}`)
}

main().catch((error) => {
  console.error("Failed to sync app icons:", error)
  process.exitCode = 1
})
