export const ACTIONBOOK_BRIDGE_PORT = 19222

export type PresetPluginId = "actionbook" | "knowledgebase"

export interface PresetPluginItem {
  id: PresetPluginId
  name: string
  description: string
  enabled: boolean
}

export interface PluginEnableUpdateParams {
  id: PresetPluginId
  enabled: boolean
}

export interface ActionbookCliCheck {
  ok: boolean
  message: string
  version?: string
}

export interface ActionbookSkillCheck {
  ok: boolean
  message: string
  path?: string
}

export interface ActionbookExtensionCheck {
  ok: boolean
  message: string
  path?: string
  version?: string
  bridgeRunning: boolean
  extensionConnected: boolean
  statusMessage?: string
  pingMessage?: string
}

export interface ActionbookPrereqStatus {
  checkedAt: string
  cli: ActionbookCliCheck
  skill: ActionbookSkillCheck
  extension: ActionbookExtensionCheck
}

export type ActionbookTokenSource = "log" | "file" | null
export type ActionbookLogSource = "stdout" | "stderr" | "system"

export interface ActionbookLogEntry {
  id: string
  at: string
  source: ActionbookLogSource
  line: string
}

export type ActionbookMilestoneType =
  | "bridge_started"
  | "bridge_waiting_extension"
  | "bridge_stopped"
  | "bridge_exited"
  | "token_found"
  | "token_file_found"
  | "status_ok"
  | "status_fail"
  | "ping_ok"
  | "ping_fail"
  | "error"

export interface ActionbookMilestone {
  id: string
  at: string
  type: ActionbookMilestoneType
  ok: boolean
  message: string
}

export interface ActionbookBridgeState {
  running: boolean
  managed: boolean
  port: number
  pid?: number
}

export interface ActionbookRuntimeState {
  enabled: boolean
  bridge: ActionbookBridgeState
  token: string | null
  tokenSource: ActionbookTokenSource
  checks: ActionbookPrereqStatus
  milestones: ActionbookMilestone[]
  logs: ActionbookLogEntry[]
  lastStatusMessage?: string | null
  lastPingMessage?: string | null
  lastError?: string | null
}

export interface ActionbookCommandResult {
  ok: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  output: string
  message: string
}

export type ActionbookEvent = {
  type: "state"
  state: ActionbookRuntimeState
}

export type KnowledgebaseProvider = "ollama" | "open_compat"
export type KnowledgebaseLogSource = "stdout" | "stderr" | "system"

export interface KnowledgebaseProviderOllamaSettings {
  baseUrl: string
  llmModel: string
  embedModel: string
}

export interface KnowledgebaseProviderOpenCompatSettings {
  baseUrl: string
  apiKey: string
  llmModel: string
  embedModel: string
}

export interface KnowledgebaseConfig {
  daemonExePath: string | null
  dataDir: string | null
  llmProvider: KnowledgebaseProvider
  embeddingProvider: KnowledgebaseProvider
  ollama: KnowledgebaseProviderOllamaSettings
  openCompat: KnowledgebaseProviderOpenCompatSettings
  retrieveTopK: number
  chunkSize: number
  chunkOverlap: number
}

export interface KnowledgebaseConfigUpdate {
  daemonExePath?: string | null
  dataDir?: string | null
  llmProvider?: KnowledgebaseProvider
  embeddingProvider?: KnowledgebaseProvider
  ollama?: Partial<KnowledgebaseProviderOllamaSettings>
  openCompat?: Partial<KnowledgebaseProviderOpenCompatSettings>
  retrieveTopK?: number
  chunkSize?: number
  chunkOverlap?: number
}

export interface KnowledgebaseLogEntry {
  id: string
  at: string
  source: KnowledgebaseLogSource
  line: string
}

export type KnowledgebaseMilestoneType =
  | "start_requested"
  | "started"
  | "health_ok"
  | "health_fail"
  | "stopped"
  | "exited"
  | "error"

export interface KnowledgebaseMilestone {
  id: string
  at: string
  type: KnowledgebaseMilestoneType
  ok: boolean
  message: string
}

export interface KnowledgebaseRuntimeState {
  enabled: boolean
  running: boolean
  managed: boolean
  ready: boolean
  pid?: number
  port?: number
  baseUrl: string | null
  token: string | null
  daemonExeExists: boolean
  dataDirExists: boolean
  config: KnowledgebaseConfig
  checkedAt: string
  logs: KnowledgebaseLogEntry[]
  milestones: KnowledgebaseMilestone[]
  lastError?: string | null
}

export interface KnowledgebaseStorageFileInfo {
  path: string
  exists: boolean
  sizeBytes?: number
}

export interface KnowledgebaseStorageStatus {
  dataDir: string | null
  sqlite: KnowledgebaseStorageFileInfo
  chromaDir: KnowledgebaseStorageFileInfo
  blobsDir: KnowledgebaseStorageFileInfo
}

export interface KnowledgebaseCollectionSummary {
  id: string
  name: string
  description?: string | null
  settings?: Record<string, unknown>
  created_at?: string
}

export interface KnowledgebaseDocumentSummary {
  id: string
  collection_id: string
  filename: string
  mime?: string
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface KnowledgebaseChunkSummary {
  id: string
  document_id: string
  text: string
  index: number
}

export interface KnowledgebaseListDocumentsResult {
  collection: {
    id: string
    name?: string
  }
  documents: KnowledgebaseDocumentSummary[]
  limit: number
  offset: number
}

export interface KnowledgebaseListChunksResult {
  document: {
    id: string
    filename?: string
  }
  chunks: KnowledgebaseChunkSummary[]
  limit: number
  offset: number
}

export type KnowledgebaseEvent = {
  type: "state"
  state: KnowledgebaseRuntimeState
}
