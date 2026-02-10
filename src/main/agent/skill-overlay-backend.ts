import { join, resolve } from "node:path"
import type {
  EditResult,
  ExecuteResponse,
  FileData,
  FileInfo,
  GrepMatch,
  SandboxBackendProtocol,
  WriteResult
} from "deepagents"
import type { LocalSandbox } from "./local-sandbox"

export const SKILL_OVERLAY_PREFIX = "/__openwork_skills__"

interface SkillPathResolution {
  sourceRoot: string
  skillName?: string
  virtualSkillRoot?: string
  realSkillRoot?: string
  realPath?: string
}

function normalizeVirtualPath(path: string): string {
  const normalized = path.replace(/\\/g, "/")
  if (!normalized) return "/"
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.replace(/\/+$/, "")
  }
  return normalized
}

function normalizeRealPath(path: string): string {
  return resolve(path).replace(/\\/g, "/")
}

function toRealPath(root: string, suffix: string): string {
  if (!suffix) return root
  const parts = suffix.split("/").filter(Boolean)
  return join(root, ...parts)
}

export class SkillOverlayBackend implements SandboxBackendProtocol {
  readonly id: string

  private readonly sourceRoots = new Map<string, Map<string, string>>()

  constructor(private readonly base: LocalSandbox) {
    this.id = base.id
  }

  registerSkillSource(sourceRoot: string, skillsByName: Record<string, string>): void {
    const normalizedSource = normalizeVirtualPath(sourceRoot)
    if (!normalizedSource.startsWith(SKILL_OVERLAY_PREFIX)) {
      throw new Error(`Invalid skill source root: ${sourceRoot}`)
    }

    const normalizedSkills = new Map<string, string>()
    for (const [skillName, realRoot] of Object.entries(skillsByName)) {
      const trimmed = skillName.trim()
      if (!trimmed || !realRoot.trim()) continue
      normalizedSkills.set(trimmed, resolve(realRoot))
    }

    this.sourceRoots.set(normalizedSource, normalizedSkills)
  }

  private resolveSkillPath(inputPath: string): SkillPathResolution | null {
    const normalizedPath = normalizeVirtualPath(inputPath)
    const sortedSources = Array.from(this.sourceRoots.keys()).sort((a, b) => b.length - a.length)
    for (const sourceRoot of sortedSources) {
      if (normalizedPath === sourceRoot) {
        return { sourceRoot }
      }
      const prefix = `${sourceRoot}/`
      if (!normalizedPath.startsWith(prefix)) continue

      const remainder = normalizedPath.slice(prefix.length)
      const [skillName, ...restParts] = remainder.split("/")
      if (!skillName) {
        return { sourceRoot }
      }

      const sourceSkills = this.sourceRoots.get(sourceRoot)
      const realSkillRoot = sourceSkills?.get(skillName)
      const virtualSkillRoot = `${sourceRoot}/${skillName}`
      if (!realSkillRoot) {
        return { sourceRoot, skillName, virtualSkillRoot }
      }
      const suffix = restParts.join("/")
      const realPath = toRealPath(realSkillRoot, suffix)
      return {
        sourceRoot,
        skillName,
        virtualSkillRoot,
        realSkillRoot,
        realPath
      }
    }
    return null
  }

  private rewritePathToVirtual(realPath: string, virtualRoot: string, realRoot: string): string {
    const normalizedRealPath = normalizeRealPath(realPath)
    const normalizedRealRoot = normalizeRealPath(realRoot)
    const normalizedVirtualRoot = normalizeVirtualPath(virtualRoot)

    if (normalizedRealPath === normalizedRealRoot) {
      return normalizedVirtualRoot
    }
    if (normalizedRealPath.startsWith(`${normalizedRealRoot}/`)) {
      return `${normalizedVirtualRoot}${normalizedRealPath.slice(normalizedRealRoot.length)}`
    }
    return normalizedVirtualRoot
  }

  private rewriteFileInfo(info: FileInfo, resolution: SkillPathResolution): FileInfo {
    if (!resolution.virtualSkillRoot || !resolution.realSkillRoot) {
      return info
    }
    const rewrittenPath = this.rewritePathToVirtual(
      info.path,
      resolution.virtualSkillRoot,
      resolution.realSkillRoot
    )
    return {
      ...info,
      path: info.is_dir && !rewrittenPath.endsWith("/") ? `${rewrittenPath}/` : rewrittenPath
    }
  }

  async lsInfo(path: string): Promise<FileInfo[]> {
    const resolution = this.resolveSkillPath(path)
    if (!resolution) {
      return this.base.lsInfo(path)
    }

    if (!resolution.skillName) {
      const sourceSkills = this.sourceRoots.get(resolution.sourceRoot)
      if (!sourceSkills) return []
      return Array.from(sourceSkills.keys())
        .sort((a, b) => a.localeCompare(b))
        .map((skillName) => ({
          path: `${resolution.sourceRoot}/${skillName}/`,
          is_dir: true
        }))
    }

    if (!resolution.realPath) {
      return []
    }
    const infos = await this.base.lsInfo(resolution.realPath)
    return infos.map((info) => this.rewriteFileInfo(info, resolution))
  }

  async read(filePath: string, offset?: number, limit?: number): Promise<string> {
    const resolution = this.resolveSkillPath(filePath)
    if (!resolution) {
      return this.base.read(filePath, offset, limit)
    }
    if (!resolution.realPath) {
      return "Error: Skill path not found."
    }
    return this.base.read(resolution.realPath, offset, limit)
  }

  async readRaw(filePath: string): Promise<FileData> {
    const resolution = this.resolveSkillPath(filePath)
    if (!resolution) {
      return this.base.readRaw(filePath)
    }
    if (!resolution.realPath) {
      throw new Error("Skill path not found.")
    }
    return this.base.readRaw(resolution.realPath)
  }

  async grepRaw(
    pattern: string,
    path?: string | null,
    glob?: string | null
  ): Promise<GrepMatch[] | string> {
    if (!path) {
      return this.base.grepRaw(pattern, path ?? undefined, glob)
    }

    const resolution = this.resolveSkillPath(path)
    if (!resolution) {
      return this.base.grepRaw(pattern, path, glob)
    }

    if (!resolution.skillName) {
      const sourceSkills = this.sourceRoots.get(resolution.sourceRoot)
      if (!sourceSkills || sourceSkills.size === 0) return []
      const merged: GrepMatch[] = []
      for (const [skillName, realRoot] of sourceSkills.entries()) {
        const result = await this.base.grepRaw(pattern, realRoot, glob)
        if (typeof result === "string") {
          return result
        }
        const virtualRoot = `${resolution.sourceRoot}/${skillName}`
        for (const match of result) {
          merged.push({
            ...match,
            path: this.rewritePathToVirtual(match.path, virtualRoot, realRoot)
          })
        }
      }
      return merged
    }

    if (!resolution.realPath || !resolution.realSkillRoot || !resolution.virtualSkillRoot) {
      return []
    }
    const result = await this.base.grepRaw(pattern, resolution.realPath, glob)
    if (typeof result === "string") {
      return result
    }
    return result.map((match) => ({
      ...match,
      path: this.rewritePathToVirtual(
        match.path,
        resolution.virtualSkillRoot as string,
        resolution.realSkillRoot as string
      )
    }))
  }

  async globInfo(pattern: string, path = "/"): Promise<FileInfo[]> {
    const resolution = this.resolveSkillPath(path)
    if (!resolution) {
      return this.base.globInfo(pattern, path)
    }

    if (!resolution.skillName) {
      const sourceSkills = this.sourceRoots.get(resolution.sourceRoot)
      if (!sourceSkills || sourceSkills.size === 0) return []
      const merged: FileInfo[] = []
      for (const [skillName, realRoot] of sourceSkills.entries()) {
        const result = await this.base.globInfo(pattern, realRoot)
        const virtualRoot = `${resolution.sourceRoot}/${skillName}`
        merged.push(
          ...result.map((item) => ({
            ...item,
            path: this.rewritePathToVirtual(item.path, virtualRoot, realRoot)
          }))
        )
      }
      return merged
    }

    if (!resolution.realPath || !resolution.realSkillRoot || !resolution.virtualSkillRoot) {
      return []
    }
    const infos = await this.base.globInfo(pattern, resolution.realPath)
    return infos.map((item) => ({
      ...item,
      path: this.rewritePathToVirtual(
        item.path,
        resolution.virtualSkillRoot as string,
        resolution.realSkillRoot as string
      )
    }))
  }

  async write(filePath: string, content: string): Promise<WriteResult> {
    const resolution = this.resolveSkillPath(filePath)
    if (!resolution) {
      return this.base.write(filePath, content)
    }
    return {
      error: "Skill paths are read-only."
    }
  }

  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll?: boolean
  ): Promise<EditResult> {
    const resolution = this.resolveSkillPath(filePath)
    if (!resolution) {
      return this.base.edit(filePath, oldString, newString, replaceAll)
    }
    return {
      error: "Skill paths are read-only."
    }
  }

  execute(command: string): Promise<ExecuteResponse> {
    return this.base.execute(command)
  }
}
