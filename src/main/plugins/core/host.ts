import { EventEmitter } from "node:events"
import { getSettings, updateSettings } from "../../settings"
import { ActionbookPluginService } from "../actionbook/service"
import { KnowledgebasePluginService } from "../knowledgebase/service"
import type {
  ActionbookEvent,
  ActionbookRuntimeState,
  KnowledgebaseCollectionSummary,
  KnowledgebaseCreateCollectionRequest,
  KnowledgebaseConfig,
  KnowledgebaseConfigUpdate,
  KnowledgebaseEvent,
  KnowledgebaseListChunksResult,
  KnowledgebaseListDocumentsResult,
  KnowledgebaseRuntimeState,
  KnowledgebaseStorageStatus,
  KnowledgebaseUploadItemResult,
  KnowledgebaseUploadRequest,
  PluginEnableUpdateParams,
  PresetPluginId,
  PresetPluginItem
} from "./contracts"
import { buildPresetPluginItems } from "./registry"

const ACTIONBOOK_EVENT_NAME = "plugins:actionbook:event"
const KNOWLEDGEBASE_EVENT_NAME = "plugins:knowledgebase:event"

function createDefaultKnowledgebaseConfig(): KnowledgebaseConfig {
  return {
    daemonExePath: null,
    dataDir: null,
    activeCollectionIds: [],
    llmProvider: "ollama",
    embeddingProvider: "ollama",
    ollama: {
      baseUrl: "http://127.0.0.1:11434",
      llmModel: "qwen2.5:7b-instruct",
      embedModel: "nomic-embed-text"
    },
    openCompat: {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      llmModel: "gpt-4o-mini",
      embedModel: "text-embedding-3-small"
    },
    retrieveTopK: 10,
    chunkSize: 800,
    chunkOverlap: 120
  }
}

function resolveKnowledgebaseConfig(settings = getSettings()): KnowledgebaseConfig {
  const config = settings.plugins.knowledgebase
  return {
    daemonExePath: config.daemonExePath,
    dataDir: config.dataDir,
    activeCollectionIds: Array.isArray(config.activeCollectionIds)
      ? config.activeCollectionIds
      : [],
    llmProvider: config.llmProvider,
    embeddingProvider: config.embeddingProvider,
    ollama: {
      ...config.ollama
    },
    openCompat: {
      ...config.openCompat
    },
    retrieveTopK: config.retrieveTopK,
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap
  }
}

function resolvePluginEnabledMap(): Record<PresetPluginId, boolean> {
  const settings = getSettings()
  return {
    actionbook: !!settings.plugins?.actionbook?.enabled,
    knowledgebase: !!settings.plugins?.knowledgebase?.enabled
  }
}

function writePluginEnabledState(input: Record<PresetPluginId, boolean>): void {
  const current = getSettings()
  updateSettings({
    plugins: {
      ...current.plugins,
      actionbook: {
        ...current.plugins.actionbook,
        enabled: !!input.actionbook
      },
      knowledgebase: {
        ...current.plugins.knowledgebase,
        enabled: !!input.knowledgebase
      }
    }
  })
}

export class PluginHost {
  private readonly emitter = new EventEmitter()
  private readonly actionbook: ActionbookPluginService
  private readonly knowledgebase: KnowledgebasePluginService
  private hydrated = false

  constructor() {
    this.actionbook = new ActionbookPluginService({
      enabled: false,
      emit: (event) => {
        this.emitter.emit(ACTIONBOOK_EVENT_NAME, event)
      }
    })
    this.knowledgebase = new KnowledgebasePluginService({
      enabled: false,
      config: createDefaultKnowledgebaseConfig(),
      emit: (event) => {
        this.emitter.emit(KNOWLEDGEBASE_EVENT_NAME, event)
      }
    })
  }

  async hydrateFromSettings(): Promise<void> {
    if (this.hydrated) return
    const settings = getSettings()
    const enabledMap = resolvePluginEnabledMap()
    this.knowledgebase.setConfig(resolveKnowledgebaseConfig(settings))
    await this.actionbook.setEnabled(enabledMap.actionbook)
    await this.knowledgebase.setEnabled(enabledMap.knowledgebase)
    await this.actionbook.refreshChecks()
    this.knowledgebase.refreshStatus()
    this.hydrated = true
  }

  listPlugins(): PresetPluginItem[] {
    return buildPresetPluginItems(resolvePluginEnabledMap())
  }

  async setEnabled(input: PluginEnableUpdateParams): Promise<PresetPluginItem> {
    await this.hydrateFromSettings()
    const enabledMap = resolvePluginEnabledMap()
    enabledMap[input.id] = input.enabled
    writePluginEnabledState(enabledMap)

    if (input.id === "actionbook") {
      await this.actionbook.setEnabled(input.enabled)
      if (input.enabled) {
        await this.actionbook.refreshChecks()
      }
    } else if (input.id === "knowledgebase") {
      await this.knowledgebase.setEnabled(input.enabled)
      if (input.enabled) {
        this.knowledgebase.refreshStatus()
      }
    }

    const plugin = this.listPlugins().find((item) => item.id === input.id)
    if (!plugin) {
      throw new Error(`Unknown plugin id: ${input.id}`)
    }
    return plugin
  }

  async getActionbookState(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.getState()
  }

  async refreshActionbookChecks(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.refreshChecks()
  }

  async startActionbookBridge(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.startBridge()
  }

  async stopActionbookBridge(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.stopBridge()
  }

  async runActionbookStatus(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.runStatusCheck()
  }

  async runActionbookPing(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.runPingCheck()
  }

  async getKnowledgebaseState(): Promise<KnowledgebaseRuntimeState> {
    await this.hydrateFromSettings()
    return this.knowledgebase.getState()
  }

  async updateKnowledgebaseConfig(
    input: KnowledgebaseConfigUpdate
  ): Promise<KnowledgebaseRuntimeState> {
    await this.hydrateFromSettings()
    const currentSettings = getSettings()
    const currentConfig = currentSettings.plugins.knowledgebase
    const mergedConfig = {
      ...currentConfig,
      ...input,
      ollama: {
        ...currentConfig.ollama,
        ...(input.ollama ?? {})
      },
      openCompat: {
        ...currentConfig.openCompat,
        ...(input.openCompat ?? {})
      },
      activeCollectionIds: Array.isArray(input.activeCollectionIds)
        ? input.activeCollectionIds
        : currentConfig.activeCollectionIds
    }
    updateSettings({
      plugins: {
        ...currentSettings.plugins,
        knowledgebase: mergedConfig
      }
    })
    return this.knowledgebase.setConfig(resolveKnowledgebaseConfig(getSettings()))
  }

  async refreshKnowledgebaseStatus(): Promise<KnowledgebaseRuntimeState> {
    await this.hydrateFromSettings()
    return this.knowledgebase.refreshStatus()
  }

  async startKnowledgebaseDaemon(): Promise<KnowledgebaseRuntimeState> {
    await this.hydrateFromSettings()
    return this.knowledgebase.startDaemon()
  }

  async stopKnowledgebaseDaemon(): Promise<KnowledgebaseRuntimeState> {
    await this.hydrateFromSettings()
    return this.knowledgebase.stopDaemon()
  }

  async openKnowledgebaseDataDir(): Promise<void> {
    await this.hydrateFromSettings()
    await this.knowledgebase.openDataDir()
  }

  async getKnowledgebaseStorageStatus(): Promise<KnowledgebaseStorageStatus> {
    await this.hydrateFromSettings()
    return this.knowledgebase.getStorageStatus()
  }

  async listKnowledgebaseCollections(): Promise<KnowledgebaseCollectionSummary[]> {
    await this.hydrateFromSettings()
    return this.knowledgebase.listCollections()
  }

  async createKnowledgebaseCollection(
    input: KnowledgebaseCreateCollectionRequest
  ): Promise<KnowledgebaseCollectionSummary> {
    await this.hydrateFromSettings()
    return this.knowledgebase.createCollection(input)
  }

  async listKnowledgebaseDocuments(
    collectionId: string,
    limit = 200,
    offset = 0
  ): Promise<KnowledgebaseListDocumentsResult> {
    await this.hydrateFromSettings()
    return this.knowledgebase.listDocuments(collectionId, limit, offset)
  }

  async listKnowledgebaseChunks(
    documentId: string,
    limit = 200,
    offset = 0
  ): Promise<KnowledgebaseListChunksResult> {
    await this.hydrateFromSettings()
    return this.knowledgebase.listChunks(documentId, limit, offset)
  }

  async retrieveKnowledgebase(input: {
    query: string
    collection_ids: string[]
    top_k?: number
    include_chunks?: boolean
    filters?: Record<string, string | number | boolean>
  }): Promise<{
    chunks: Array<{
      chunk: {
        id: string
        document_id: string
        text: string
        index: number
      }
      document: {
        id: string
        filename?: string
      }
      score?: number
    }>
  }> {
    await this.hydrateFromSettings()
    return this.knowledgebase.retrieve(input)
  }

  async uploadKnowledgebaseDocuments(
    input: KnowledgebaseUploadRequest
  ): Promise<KnowledgebaseUploadItemResult[]> {
    await this.hydrateFromSettings()
    return this.knowledgebase.uploadDocuments(input)
  }

  onActionbookEvent(listener: (event: ActionbookEvent) => void): () => void {
    this.emitter.on(ACTIONBOOK_EVENT_NAME, listener)
    return () => this.emitter.off(ACTIONBOOK_EVENT_NAME, listener)
  }

  onKnowledgebaseEvent(listener: (event: KnowledgebaseEvent) => void): () => void {
    this.emitter.on(KNOWLEDGEBASE_EVENT_NAME, listener)
    return () => this.emitter.off(KNOWLEDGEBASE_EVENT_NAME, listener)
  }

  async shutdown(): Promise<void> {
    await this.actionbook.shutdown()
    await this.knowledgebase.shutdown()
  }

  shutdownNow(): void {
    this.actionbook.shutdownNow()
    this.knowledgebase.shutdownNow()
  }
}

export const pluginHost = new PluginHost()
