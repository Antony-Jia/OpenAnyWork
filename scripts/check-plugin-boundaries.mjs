/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, extname, join, normalize, relative, resolve } from "node:path"

const repoRoot = process.cwd()

const MAIN_ROOT = "src/main"
const MAIN_PLUGIN_ACTIONBOOK_ROOT = "src/main/plugins/actionbook"
const RENDERER_ROOT = "src/renderer/src"
const RENDERER_PLUGIN_ROOT = "src/renderer/src/plugins"
const RENDERER_PLUGIN_ACTIONBOOK_ROOT = "src/renderer/src/plugins/actionbook"

const allowedRendererImporters = new Set([
  "src/renderer/src/components/titlebar/SettingsMenu.tsx",
  "src/renderer/src/plugins/index.ts"
])

const IMPORT_REGEXES = [
  /import\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
  /export\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g
]

function toPosixPath(input) {
  return normalize(input).replace(/\\/g, "/")
}

function walkFiles(dir) {
  const files = []
  const queue = [resolve(repoRoot, dir)]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const entries = readdirSync(current)
    for (const entry of entries) {
      const absolute = join(current, entry)
      const stats = statSync(absolute)
      if (stats.isDirectory()) {
        queue.push(absolute)
        continue
      }
      const ext = extname(absolute)
      if (ext === ".ts" || ext === ".tsx") {
        files.push(toPosixPath(relative(repoRoot, absolute)))
      }
    }
  }

  return files
}

function extractImports(content) {
  const specs = []
  for (const regex of IMPORT_REGEXES) {
    regex.lastIndex = 0
    let match = regex.exec(content)
    while (match) {
      specs.push(match[1])
      match = regex.exec(content)
    }
  }
  return specs
}

function resolveImportSpecifier(importerRelPath, spec) {
  if (!spec) return spec
  if (spec.startsWith(".")) {
    const importerDir = dirname(resolve(repoRoot, importerRelPath))
    const base = resolve(importerDir, spec)
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      join(base, "index.ts"),
      join(base, "index.tsx")
    ]
    for (const candidate of candidates) {
      try {
        const stats = statSync(candidate)
        if (stats.isFile()) {
          return toPosixPath(relative(repoRoot, candidate))
        }
      } catch {
        // keep trying
      }
    }
    return toPosixPath(relative(repoRoot, base))
  }

  if (spec.startsWith("@/")) {
    return toPosixPath(join(RENDERER_ROOT, spec.slice(2)))
  }

  if (spec.startsWith("src/")) {
    return toPosixPath(spec)
  }

  return spec
}

function collectViolations() {
  const violations = []

  const mainFiles = walkFiles(MAIN_ROOT)
  for (const file of mainFiles) {
    if (file.startsWith("src/main/plugins/")) continue
    const content = readFileSync(resolve(repoRoot, file), "utf-8")
    const imports = extractImports(content)
    for (const spec of imports) {
      const resolved = resolveImportSpecifier(file, spec)
      const specPath = toPosixPath(spec)
      if (
        resolved.startsWith(MAIN_PLUGIN_ACTIONBOOK_ROOT) ||
        specPath.includes("plugins/actionbook")
      ) {
        violations.push(`${file} imports ${spec}`)
      }
    }
  }

  const rendererFiles = walkFiles(RENDERER_ROOT)
  for (const file of rendererFiles) {
    if (file.startsWith(`${RENDERER_PLUGIN_ROOT}/`)) continue
    const content = readFileSync(resolve(repoRoot, file), "utf-8")
    const imports = extractImports(content)
    for (const spec of imports) {
      const resolved = resolveImportSpecifier(file, spec)
      const specPath = toPosixPath(spec)
      const importsPluginActionbook =
        resolved.startsWith(RENDERER_PLUGIN_ACTIONBOOK_ROOT) ||
        specPath.includes("plugins/actionbook")
      const importsPluginRoot =
        resolved.startsWith(RENDERER_PLUGIN_ROOT) || specPath.startsWith("@/plugins")

      if (importsPluginActionbook && !allowedRendererImporters.has(file)) {
        violations.push(`${file} imports ${spec}`)
      } else if (
        importsPluginRoot &&
        !allowedRendererImporters.has(file) &&
        !file.startsWith(`${RENDERER_PLUGIN_ROOT}/`)
      ) {
        violations.push(`${file} imports ${spec}`)
      }
    }
  }

  return violations
}

const violations = collectViolations()
if (violations.length > 0) {
  console.error("[plugin-boundary] violations detected:")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log("[plugin-boundary] OK")
