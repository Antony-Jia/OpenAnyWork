import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { app, shell } from "electron"
import type {
  KnowledgebaseChunkSummary,
  KnowledgebaseCollectionSummary,
  KnowledgebaseConfig,
  KnowledgebaseEvent,
  KnowledgebaseListChunksResult,
  KnowledgebaseListDocumentsResult,
  KnowledgebaseLogEntry,
  KnowledgebaseLogSource,
  KnowledgebaseMilestone,
  KnowledgebaseMilestoneType,
  KnowledgebaseRuntimeState,
  KnowledgebaseStorageFileInfo,
  KnowledgebaseStorageStatus
} from "../core/contracts"

const START_TIMEOUT_MS = 15000
const HEALTH_TIMEOUT_MS = 12000
const HEALTH_POLL_INTERVAL_MS = 500
const MAX_LOG_ENTRIES = 300
const MAX_MILESTONES = 160

interface DaemonInfo {
  port: number
  token: string
  base_url: string
}

function trimOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeProvider(value: string): "ollama" | "open_compat" {
  return value === "open_compat" ? "open_compat" : "ollama"
}

function sanitizeConfig(config: KnowledgebaseConfig): KnowledgebaseConfig {
  return {
    daemonExePath: trimOrNull(config.daemonExePath),
    dataDir: trimOrNull(config.dataDir),
    llmProvider: sanitizeProvider(config.llmProvider),
    embeddingProvider: sanitizeProvider(config.embeddingProvider),
    ollama: {
      baseUrl: (config.ollama.baseUrl || "").trim(),
      llmModel: (config.ollama.llmModel || "").trim(),
      embedModel: (config.ollama.embedModel || "").trim()
    },
    openCompat: {
      baseUrl: (config.openCompat.baseUrl || "").trim(),
      apiKey: config.openCompat.apiKey || "",
      llmModel: (config.openCompat.llmModel || "").trim(),
      embedModel: (config.openCompat.embedModel || "").trim()
    },
    retrieveTopK: Number.isFinite(config.retrieveTopK)
      ? Math.max(1, Math.round(config.retrieveTopK))
      : 10,
    chunkSize: Number.isFinite(config.chunkSize)
      ? Math.max(100, Math.round(config.chunkSize))
      : 800,
    chunkOverlap: Number.isFinite(config.chunkOverlap)
      ? Math.max(0, Math.round(config.chunkOverlap))
      : 120
  }
}

function withQuery(pathname: string, params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    searchParams.set(key, String(value))
  }
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

export class KnowledgebasePluginService {
  private readonly emit: (event: KnowledgebaseEvent) => void
  private readonly defaultDataDirResolver: () => string
  private sequence = 0
  private daemonProcess: ChildProcess | null = null
  private startPromise: Promise<KnowledgebaseRuntimeState> | null = null
  private stdoutRemainder = ""
  private stderrRemainder = ""
  private daemonInfoResolver: ((value: DaemonInfo) => void) | null = null
  private daemonInfoRejecter: ((reason?: unknown) => void) | null = null
  private state: KnowledgebaseRuntimeState

  constructor(params: {
    enabled: boolean
    config: KnowledgebaseConfig
    emit: (event: KnowledgebaseEvent) => void
    defaultDataDirResolver?: () => string
  }) {
    this.emit = params.emit
    this.defaultDataDirResolver =
      params.defaultDataDirResolver ?? (() => join(app.getPath("userData"), "kb-data"))
    this.state = {
      enabled: params.enabled,
      running: false,
      managed: false,
      ready: false,
      baseUrl: null,
      token: null,
      daemonExeExists: false,
      dataDirExists: false,
      config: sanitizeConfig(params.config),
      checkedAt: new Date(0).toISOString(),
      logs: [],
      milestones: [],
      lastError: null
    }
  }

  getState(): KnowledgebaseRuntimeState {
    return JSON.parse(JSON.stringify(this.state)) as KnowledgebaseRuntimeState
  }

  setConfig(config: KnowledgebaseConfig): KnowledgebaseRuntimeState {
    this.state.config = sanitizeConfig(config)
    this.refreshFilesystemFlags()
    this.emitState()
    return this.getState()
  }

  async setEnabled(enabled: boolean): Promise<KnowledgebaseRuntimeState> {
    this.state.enabled = enabled
    if (!enabled) {
      await this.stopDaemon()
    } else {
      this.refreshFilesystemFlags()
      this.emitState()
    }
    return this.getState()
  }

  refreshStatus(): KnowledgebaseRuntimeState {
    this.refreshFilesystemFlags()
    this.emitState()
    return this.getState()
  }

  async startDaemon(): Promise<KnowledgebaseRuntimeState> {
    if (!this.state.enabled) {
      throw new Error("Knowledge Base plugin is disabled.")
    }
    if (this.state.ready && this.daemonProcess) {
      return this.getState()
    }
    if (this.startPromise) {
      return this.startPromise
    }

    const startTask = this.startDaemonInternal()
    this.startPromise = startTask
    try {
      return await startTask
    } finally {
      this.startPromise = null
    }
  }

  async stopDaemon(): Promise<KnowledgebaseRuntimeState> {
    const proc = this.daemonProcess
    if (!proc) {
      this.state.running = false
      this.state.managed = false
      this.state.ready = false
      this.state.pid = undefined
      this.state.port = undefined
      this.state.baseUrl = null
      this.state.token = null
      this.emitState()
      return this.getState()
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        resolve()
      }, 2000)
      proc.once("exit", () => {
        clearTimeout(timer)
        resolve()
      })
      proc.kill()
    })

    this.pushMilestone("stopped", true, "Knowledge Base daemon stopped.")
    this.pushSystemLog("Knowledge Base daemon stopped.")
    this.state.running = false
    this.state.ready = false
    this.state.managed = false
    this.state.pid = undefined
    this.state.port = undefined
    this.state.baseUrl = null
    this.state.token = null
    this.emitState()
    return this.getState()
  }

  async openDataDir(): Promise<void> {
    const dataDir = this.resolveDataDir()
    mkdirSync(dataDir, { recursive: true })
    await shell.openPath(dataDir)
  }

  async listCollections(): Promise<KnowledgebaseCollectionSummary[]> {
    await this.ensureDaemonReady()
    const data = await this.requestJson<KnowledgebaseCollectionSummary[]>("/api/v1/collections")
    return Array.isArray(data) ? data : []
  }

  async listDocuments(
    collectionId: string,
    limit = 200,
    offset = 0
  ): Promise<KnowledgebaseListDocumentsResult> {
    await this.ensureDaemonReady()
    const safeCollectionId = encodeURIComponent(collectionId)
    return this.requestJson<KnowledgebaseListDocumentsResult>(
      withQuery(`/api/v1/collections/${safeCollectionId}/documents`, { limit, offset })
    )
  }

  async listChunks(
    documentId: string,
    limit = 200,
    offset = 0
  ): Promise<KnowledgebaseListChunksResult> {
    await this.ensureDaemonReady()
    const safeDocumentId = encodeURIComponent(documentId)
    return this.requestJson<KnowledgebaseListChunksResult>(
      withQuery(`/api/v1/documents/${safeDocumentId}/chunks`, { limit, offset })
    )
  }

  async retrieve(payload: {
    query: string
    collection_ids: string[]
    top_k?: number
    include_chunks?: boolean
    filters?: Record<string, string | number | boolean>
  }): Promise<{
    chunks: Array<{
      chunk: KnowledgebaseChunkSummary
      document: KnowledgebaseListChunksResult["document"]
      score?: number
    }>
  }> {
    await this.ensureDaemonReady()
    return this.requestJson("/api/v1/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  }

  getStorageStatus(): KnowledgebaseStorageStatus {
    const dataDir = this.resolveDataDir()
    const sqlitePath = join(dataDir, "kb.sqlite3")
    const chromaPath = join(dataDir, "chroma")
    const blobsPath = join(dataDir, "blobs")

    return {
      dataDir,
      sqlite: this.toStorageFileInfo(sqlitePath),
      chromaDir: this.toStorageFileInfo(chromaPath),
      blobsDir: this.toStorageFileInfo(blobsPath)
    }
  }

  async shutdown(): Promise<void> {
    await this.stopDaemon()
  }

  shutdownNow(): void {
    if (this.daemonProcess) {
      this.daemonProcess.kill()
    }
    this.daemonProcess = null
    this.state.running = false
    this.state.managed = false
    this.state.ready = false
    this.state.pid = undefined
    this.state.port = undefined
    this.state.baseUrl = null
    this.state.token = null
  }

  private async ensureDaemonReady(): Promise<void> {
    if (!this.state.ready) {
      await this.startDaemon()
    }
    if (!this.state.ready || !this.state.baseUrl || !this.state.token) {
      throw new Error("Knowledge Base daemon is not ready.")
    }
  }

  private async startDaemonInternal(): Promise<KnowledgebaseRuntimeState> {
    this.pushMilestone("start_requested", true, "Starting Knowledge Base daemon.")
    this.pushSystemLog("Starting Knowledge Base daemon.")
    this.refreshFilesystemFlags()
    const exePath = trimOrNull(this.state.config.daemonExePath)
    if (!exePath || !existsSync(exePath)) {
      this.recordError("Knowledge Base daemon executable is not configured or does not exist.")
      throw new Error(this.state.lastError || "Knowledge Base daemon executable missing.")
    }

    const dataDir = this.resolveDataDir()
    mkdirSync(dataDir, { recursive: true })
    this.writeDaemonEnvFile(dataDir)

    const proc = spawn(exePath, [], {
      cwd: dataDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    })
    this.daemonProcess = proc
    this.stdoutRemainder = ""
    this.stderrRemainder = ""
    this.state.running = true
    this.state.managed = true
    this.state.ready = false
    this.state.pid = proc.pid
    this.state.port = undefined
    this.state.baseUrl = null
    this.state.token = null
    this.state.lastError = null
    this.pushMilestone("started", true, `Daemon process started (pid=${proc.pid ?? "unknown"}).`)
    this.emitState()

    proc.stdout?.on("data", (chunk: Buffer) => {
      this.handleStdoutChunk(chunk.toString("utf8"))
    })
    proc.stderr?.on("data", (chunk: Buffer) => {
      this.handleStderrChunk(chunk.toString("utf8"))
    })
    proc.on("error", (error) => {
      this.recordError(error instanceof Error ? error.message : String(error))
      if (this.daemonInfoRejecter) {
        this.daemonInfoRejecter(error)
        this.daemonInfoRejecter = null
        this.daemonInfoResolver = null
      }
    })
    proc.on("exit", (code, signal) => {
      this.daemonProcess = null
      this.state.running = false
      this.state.ready = false
      this.state.managed = false
      this.state.pid = undefined
      this.state.port = undefined
      this.state.baseUrl = null
      this.state.token = null
      this.pushMilestone(
        "exited",
        code === 0,
        `Daemon exited (code=${code ?? "null"}, signal=${signal ?? "null"}).`
      )
      this.emitState()
    })

    try {
      const info = await this.waitForDaemonInfo()
      this.state.port = info.port
      this.state.baseUrl = info.base_url
      this.state.token = info.token
      await this.waitForHealth(info.base_url)
      this.state.ready = true
      this.pushMilestone("health_ok", true, "Knowledge Base daemon health check passed.")
      this.emitState()
      return this.getState()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.pushMilestone("health_fail", false, message)
      this.recordError(message)
      await this.stopDaemon()
      throw error
    } finally {
      this.daemonInfoResolver = null
      this.daemonInfoRejecter = null
    }
  }

  private waitForDaemonInfo(): Promise<DaemonInfo> {
    return new Promise<DaemonInfo>((resolve, reject) => {
      this.daemonInfoResolver = resolve
      this.daemonInfoRejecter = reject
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for daemon startup info."))
      }, START_TIMEOUT_MS)

      const originalResolve = resolve
      const originalReject = reject
      this.daemonInfoResolver = (info) => {
        clearTimeout(timer)
        originalResolve(info)
      }
      this.daemonInfoRejecter = (reason) => {
        clearTimeout(timer)
        originalReject(reason)
      }
    })
  }

  private async waitForHealth(baseUrl: string): Promise<void> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
      try {
        const response = await fetch(`${baseUrl}/healthz`)
        if (response.ok) return
      } catch {
        // retry
      }
      await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS))
    }
    throw new Error("Timed out waiting for daemon health check.")
  }

  private handleStdoutChunk(chunk: string): void {
    const combined = `${this.stdoutRemainder}${chunk}`
    const lines = combined.split(/\r?\n/)
    this.stdoutRemainder = lines.pop() ?? ""
    for (const line of lines) {
      this.handleDaemonLine("stdout", line)
    }
  }

  private handleStderrChunk(chunk: string): void {
    const combined = `${this.stderrRemainder}${chunk}`
    const lines = combined.split(/\r?\n/)
    this.stderrRemainder = lines.pop() ?? ""
    for (const line of lines) {
      this.handleDaemonLine("stderr", line)
    }
  }

  private handleDaemonLine(source: KnowledgebaseLogSource, rawLine: string): void {
    const line = rawLine.trim()
    if (!line) return
    this.pushLog(source, line)

    if (source === "stdout" && this.daemonInfoResolver) {
      try {
        const parsed = JSON.parse(line) as Partial<DaemonInfo>
        if (
          typeof parsed.port === "number" &&
          typeof parsed.token === "string" &&
          typeof parsed.base_url === "string"
        ) {
          this.daemonInfoResolver({
            port: parsed.port,
            token: parsed.token,
            base_url: parsed.base_url
          })
          this.daemonInfoResolver = null
          this.daemonInfoRejecter = null
        }
      } catch {
        // non-json stdout lines are expected
      }
    }
  }

  private resolveDataDir(): string {
    const explicit = trimOrNull(this.state.config.dataDir)
    return explicit ?? this.defaultDataDirResolver()
  }

  private refreshFilesystemFlags(): void {
    const exePath = trimOrNull(this.state.config.daemonExePath)
    const dataDir = this.resolveDataDir()
    this.state.daemonExeExists = !!exePath && existsSync(exePath)
    this.state.dataDirExists = existsSync(dataDir)
    this.state.checkedAt = new Date().toISOString()
  }

  private toStorageFileInfo(path: string): KnowledgebaseStorageFileInfo {
    if (!existsSync(path)) {
      return { path, exists: false }
    }
    try {
      const stat = statSync(path)
      return {
        path,
        exists: true,
        sizeBytes: stat.size
      }
    } catch {
      return { path, exists: true }
    }
  }

  private writeDaemonEnvFile(dataDir: string): void {
    const config = this.state.config
    const envLines = [
      "APP_HOST=127.0.0.1",
      "APP_PORT=0",
      `APP_DATA_DIR=${dataDir}`,
      "AUTH_TOKEN=",
      `LLM_PROVIDER=${config.llmProvider}`,
      `EMBEDDING_PROVIDER=${config.embeddingProvider}`,
      `OLLAMA_BASE_URL=${config.ollama.baseUrl}`,
      `OLLAMA_LLM_MODEL=${config.ollama.llmModel}`,
      `OLLAMA_EMBED_MODEL=${config.ollama.embedModel}`,
      `OPEN_COMPAT_BASE_URL=${config.openCompat.baseUrl}`,
      `OPEN_COMPAT_API_KEY=${config.openCompat.apiKey}`,
      `OPEN_COMPAT_LLM_MODEL=${config.openCompat.llmModel}`,
      `OPEN_COMPAT_EMBED_MODEL=${config.openCompat.embedModel}`,
      `RETRIEVE_TOP_K=${config.retrieveTopK}`,
      `CHUNK_SIZE=${config.chunkSize}`,
      `CHUNK_OVERLAP=${config.chunkOverlap}`
    ]
    writeFileSync(join(dataDir, ".env"), `${envLines.join("\n")}\n`, "utf8")
  }

  private async requestJson<T>(pathname: string, init: RequestInit = {}): Promise<T> {
    if (!this.state.baseUrl || !this.state.token) {
      throw new Error("Knowledge Base daemon is not ready.")
    }
    const headers = new Headers(init.headers ?? {})
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${this.state.token}`)
    }
    const response = await fetch(`${this.state.baseUrl}${pathname}`, {
      ...init,
      headers
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `Knowledge Base request failed (${response.status}): ${text || response.statusText}`
      )
    }
    const text = await response.text()
    if (!text) return null as T
    return JSON.parse(text) as T
  }

  private pushLog(source: KnowledgebaseLogSource, line: string): void {
    const entry: KnowledgebaseLogEntry = {
      id: String(++this.sequence),
      at: new Date().toISOString(),
      source,
      line
    }
    this.state.logs.push(entry)
    if (this.state.logs.length > MAX_LOG_ENTRIES) {
      this.state.logs.splice(0, this.state.logs.length - MAX_LOG_ENTRIES)
    }
    this.emitState()
  }

  private pushSystemLog(line: string): void {
    this.pushLog("system", line)
  }

  private pushMilestone(type: KnowledgebaseMilestoneType, ok: boolean, message: string): void {
    const milestone: KnowledgebaseMilestone = {
      id: String(++this.sequence),
      at: new Date().toISOString(),
      type,
      ok,
      message
    }
    this.state.milestones.push(milestone)
    if (this.state.milestones.length > MAX_MILESTONES) {
      this.state.milestones.splice(0, this.state.milestones.length - MAX_MILESTONES)
    }
    this.emitState()
  }

  private recordError(message: string): void {
    this.state.lastError = message
    this.pushMilestone("error", false, message)
    this.pushSystemLog(message)
    this.emitState()
  }

  private emitState(): void {
    this.refreshFilesystemFlags()
    this.emit({
      type: "state",
      state: this.getState()
    })
  }
}
