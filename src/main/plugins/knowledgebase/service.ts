import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import { app, shell } from "electron"
import type {
  KnowledgebaseChunkSummary,
  KnowledgebaseCollectionSummary,
  KnowledgebaseDeleteCollectionRequest,
  KnowledgebaseDeleteCollectionResult,
  KnowledgebaseDeleteDocumentRequest,
  KnowledgebaseDeleteDocumentResult,
  KnowledgebaseCreateCollectionRequest,
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
  KnowledgebaseStorageStatus,
  KnowledgebaseUploadItemResult,
  KnowledgebaseUploadRequest,
  KnowledgebaseUploadStatus
} from "../core/contracts"

const START_TIMEOUT_MS = 15000
const HEALTH_TIMEOUT_MS = 12000
const HEALTH_POLL_INTERVAL_MS = 500
const JOB_POLL_INTERVAL_MS = 1200
const JOB_POLL_TIMEOUT_MS = 180000
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
  const activeCollectionIds = Array.isArray(config.activeCollectionIds)
    ? Array.from(
        new Set(
          config.activeCollectionIds
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0)
        )
      )
    : []

  return {
    daemonExePath: trimOrNull(config.daemonExePath),
    dataDir: trimOrNull(config.dataDir),
    activeCollectionIds,
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

function toUploadMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case ".pdf":
      return "application/pdf"
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    case ".txt":
      return "text/plain"
    default:
      return "application/octet-stream"
  }
}

function normalizeJobStatus(rawStatus: unknown): KnowledgebaseUploadStatus {
  const value = String(rawStatus ?? "")
    .trim()
    .toLowerCase()
  if (value === "queued") return "queued"
  if (value === "running") return "running"
  if (value === "done" || value === "succeeded") return "done"
  return "failed"
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
    return Array.isArray(data) ? data.map((item) => this.normalizeCollectionSummary(item)) : []
  }

  async createCollection(
    input: KnowledgebaseCreateCollectionRequest
  ): Promise<KnowledgebaseCollectionSummary> {
    await this.ensureDaemonReady()
    const name = String(input.name ?? "").trim()
    if (!name) {
      throw new Error("Collection name is required.")
    }
    const payload: Record<string, unknown> = { name }
    if (input.description !== undefined) {
      payload.description = input.description
    }
    if (input.settings && typeof input.settings === "object") {
      payload.settings = input.settings
    }
    const response = await this.requestJson("/api/v1/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    return this.normalizeCollectionSummary(response)
  }

  async deleteDocument(
    input: KnowledgebaseDeleteDocumentRequest
  ): Promise<KnowledgebaseDeleteDocumentResult> {
    await this.ensureDaemonReady()
    const documentId = String(input.documentId ?? "").trim()
    if (!documentId) {
      throw new Error("Document ID is required.")
    }
    const poll = input.poll !== false

    try {
      const safeDocumentId = encodeURIComponent(documentId)
      const response = await this.requestJson<{
        job_id?: string
        jobId?: string
      }>(`/api/v1/documents/${safeDocumentId}`, {
        method: "DELETE"
      })
      const jobId = response.job_id ?? response.jobId
      if (!jobId) {
        throw new Error("Delete document response missing job ID.")
      }

      if (!poll) {
        return {
          documentId,
          jobId,
          status: "queued"
        }
      }

      const finalJob = await this.waitForJob(jobId)
      const status = normalizeJobStatus(finalJob.status)
      return {
        documentId,
        jobId,
        status,
        error: status === "failed" ? this.jobErrorMessage(finalJob) : undefined
      }
    } catch (error) {
      if (this.isHttpStatus(error, 404)) {
        return {
          documentId,
          status: "done"
        }
      }
      return {
        documentId,
        status: "failed",
        error: this.toErrorMessage(error, "Failed to delete document.")
      }
    }
  }

  async deleteCollection(
    input: KnowledgebaseDeleteCollectionRequest
  ): Promise<KnowledgebaseDeleteCollectionResult> {
    await this.ensureDaemonReady()
    const collectionId = String(input.collectionId ?? "").trim()
    if (!collectionId) {
      throw new Error("Collection ID is required.")
    }

    const cascadeDocuments = input.cascadeDocuments !== false
    const poll = input.poll !== false
    const documentResults: KnowledgebaseDeleteDocumentResult[] = []

    if (cascadeDocuments) {
      while (true) {
        let page: KnowledgebaseListDocumentsResult
        try {
          page = await this.listDocuments(collectionId, 200, 0)
        } catch (error) {
          return {
            collectionId,
            collectionDeleted: false,
            documentResults,
            error: this.toErrorMessage(error, "Failed to list collection documents.")
          }
        }

        if (page.documents.length === 0) {
          break
        }

        for (const document of page.documents) {
          const result = await this.deleteDocument({
            documentId: document.id,
            poll
          })
          documentResults.push(result)
          if (result.status === "failed") {
            return {
              collectionId,
              collectionDeleted: false,
              documentResults,
              error: result.error ?? `Failed to delete document ${document.id}.`
            }
          }
          if (result.status !== "done") {
            return {
              collectionId,
              collectionDeleted: false,
              documentResults,
              error: "Collection delete requires poll=true so document deletion can be verified."
            }
          }
        }
      }
    }

    try {
      const safeCollectionId = encodeURIComponent(collectionId)
      await this.requestJson(`/api/v1/collections/${safeCollectionId}`, {
        method: "DELETE"
      })
      return {
        collectionId,
        collectionDeleted: true,
        documentResults
      }
    } catch (error) {
      return {
        collectionId,
        collectionDeleted: false,
        documentResults,
        error: this.toErrorMessage(error, "Failed to delete collection.")
      }
    }
  }

  async listDocuments(
    collectionId: string,
    limit = 200,
    offset = 0
  ): Promise<KnowledgebaseListDocumentsResult> {
    await this.ensureDaemonReady()
    const safeCollectionId = encodeURIComponent(collectionId)
    const response = await this.requestJson<KnowledgebaseListDocumentsResult & { documents?: unknown[] }>(
      withQuery(`/api/v1/collections/${safeCollectionId}/documents`, { limit, offset })
    )
    return {
      collection: {
        id: response.collection?.id ?? collectionId,
        name: response.collection?.name
      },
      documents: Array.isArray(response.documents)
        ? response.documents.map((item) => this.normalizeDocumentSummary(item))
        : [],
      limit: response.limit ?? limit,
      offset: response.offset ?? offset
    }
  }

  async listChunks(
    documentId: string,
    limit = 200,
    offset = 0
  ): Promise<KnowledgebaseListChunksResult> {
    await this.ensureDaemonReady()
    const safeDocumentId = encodeURIComponent(documentId)
    const response = await this.requestJson<KnowledgebaseListChunksResult & { chunks?: unknown[] }>(
      withQuery(`/api/v1/documents/${safeDocumentId}/chunks`, { limit, offset })
    )
    const normalizedDocument = this.normalizeDocumentRef(response.document)
    return {
      document: {
        ...normalizedDocument,
        id: normalizedDocument.id || documentId
      },
      chunks: Array.isArray(response.chunks)
        ? response.chunks.map((item) => this.normalizeChunkSummary(item))
        : [],
      limit: response.limit ?? limit,
      offset: response.offset ?? offset
    }
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
    const response = await this.requestJson<{
      chunks?: Array<{
        chunk?: unknown
        document?: unknown
        score?: number
      }>
      hits?: Array<{
        chunk_id?: string
        score?: number
        text?: string | null
        citation?: {
          document_id?: string
          chunk_id?: string
          snippet?: string
        }
        document?: {
          id?: string
          title?: string
          filename?: string
        }
      }>
    }>("/api/v1/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })

    if (Array.isArray(response.chunks)) {
      return {
        chunks: response.chunks.map((item) => ({
          chunk: this.normalizeChunkSummary(item.chunk),
          document: this.normalizeDocumentRef(item.document),
          score: item.score
        }))
      }
    }

    if (Array.isArray(response.hits)) {
      return {
        chunks: response.hits.map((hit, index) => {
          const documentId = hit.document?.id ?? hit.citation?.document_id ?? ""
          const text = typeof hit.text === "string" ? hit.text : (hit.citation?.snippet ?? "")
          return {
            chunk: {
              id: hit.chunk_id || hit.citation?.chunk_id || `hit:${index}`,
              document_id: documentId,
              text,
              index
            },
            document: {
              id: documentId,
              filename: hit.document?.filename ?? hit.document?.title
            },
            score: hit.score
          }
        })
      }
    }

    return { chunks: [] }
  }

  async uploadDocuments(input: KnowledgebaseUploadRequest): Promise<KnowledgebaseUploadItemResult[]> {
    await this.ensureDaemonReady()
    if (!input.collectionId || !input.collectionId.trim()) {
      throw new Error("Collection ID is required for upload.")
    }
    const filePaths = Array.isArray(input.filePaths) ? input.filePaths : []
    if (filePaths.length === 0) {
      throw new Error("At least one file path is required.")
    }

    const poll = input.poll !== false
    const results: KnowledgebaseUploadItemResult[] = []

    for (const filePath of filePaths) {
      const fileName = basename(filePath)
      try {
        const content = await readFile(filePath)
        const formData = new FormData()
        const blob = new Blob([content], { type: toUploadMimeType(filePath) })
        formData.append("file", blob, fileName)
        formData.append("collection_id", input.collectionId)
        if (input.options) {
          formData.append(
            "options",
            JSON.stringify({
              chunk_size: input.options.chunkSize,
              chunk_overlap: input.options.chunkOverlap,
              parser_name: input.options.parserName,
              metadata: input.options.metadata
            })
          )
        }

        const uploadResponse = await this.requestJson<{
          job_id?: string
          jobId?: string
          document_id?: string
          documentId?: string
        }>("/api/v1/ingest/upload", {
          method: "POST",
          body: formData
        })

        const jobId = uploadResponse.job_id ?? uploadResponse.jobId
        const documentId = uploadResponse.document_id ?? uploadResponse.documentId
        if (!jobId) {
          throw new Error("Upload response missing job ID.")
        }

        if (!poll) {
          results.push({
            filePath,
            fileName,
            jobId,
            documentId,
            status: "queued"
          })
          continue
        }

        const finalJob = await this.waitForJob(jobId)
        const status = normalizeJobStatus(finalJob.status)
        results.push({
          filePath,
          fileName,
          jobId,
          documentId,
          status,
          error: status === "failed" ? this.jobErrorMessage(finalJob) : undefined
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({
          filePath,
          fileName,
          status: "failed",
          error: message
        })
      }
    }

    return results
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

  private async getJob(jobId: string): Promise<{
    status?: unknown
    error?: string | null
    message?: string | null
  }> {
    const safeJobId = encodeURIComponent(jobId)
    return this.requestJson(`/api/v1/jobs/${safeJobId}`)
  }

  private async waitForJob(jobId: string): Promise<{
    status?: unknown
    error?: string | null
    message?: string | null
  }> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < JOB_POLL_TIMEOUT_MS) {
      const job = await this.getJob(jobId)
      const status = normalizeJobStatus(job.status)
      if (status === "done" || status === "failed") {
        return job
      }
      await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS))
    }
    throw new Error(`Timed out waiting for job completion: ${jobId}`)
  }

  private jobErrorMessage(job: { error?: string | null; message?: string | null }): string {
    return job.error || job.message || "Job failed."
  }

  private isHttpStatus(error: unknown, statusCode: number): boolean {
    return error instanceof Error && error.message.includes(`request failed (${statusCode})`)
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }
    if (typeof error === "string" && error.trim()) {
      return error
    }
    return fallback
  }

  private normalizeCollectionSummary(raw: unknown): KnowledgebaseCollectionSummary {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    return {
      id: String(value.id ?? ""),
      name: String(value.name ?? ""),
      description: value.description === null ? null : typeof value.description === "string" ? value.description : undefined,
      settings:
        value.settings && typeof value.settings === "object"
          ? (value.settings as Record<string, unknown>)
          : undefined,
      created_at: typeof value.created_at === "string" ? value.created_at : undefined
    }
  }

  private normalizeDocumentSummary(raw: unknown): KnowledgebaseListDocumentsResult["documents"][number] {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    return {
      id: String(value.id ?? ""),
      collection_id: String(value.collection_id ?? ""),
      filename: String(value.filename ?? value.title ?? ""),
      mime: typeof value.mime === "string" ? value.mime : undefined,
      metadata:
        value.metadata && typeof value.metadata === "object"
          ? (value.metadata as Record<string, unknown>)
          : undefined,
      created_at: typeof value.created_at === "string" ? value.created_at : undefined
    }
  }

  private normalizeChunkSummary(raw: unknown): KnowledgebaseChunkSummary {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const normalizedIndex =
      typeof value.index === "number"
        ? value.index
        : typeof value.order === "number"
          ? value.order
          : 0
    return {
      id: String(value.id ?? ""),
      document_id: String(value.document_id ?? ""),
      text: typeof value.text === "string" ? value.text : "",
      index: normalizedIndex
    }
  }

  private normalizeDocumentRef(raw: unknown): KnowledgebaseListChunksResult["document"] {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    return {
      id: String(value.id ?? ""),
      filename:
        typeof value.filename === "string"
          ? value.filename
          : typeof value.title === "string"
            ? value.title
            : undefined
    }
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
