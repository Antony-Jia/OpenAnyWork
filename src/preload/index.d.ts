import type {
  Thread,
  ModelConfig,
  Provider,
  ProviderState,
  StreamEvent,
  HITLDecision,
  SubagentConfig,
  SkillItem,
  ToolInfo,
  ToolKeyUpdateParams,
  ToolEnableScopeUpdateParams,
  ToolEnableUpdateParams,
  MiddlewareDefinition,
  McpServerConfig,
  McpServerCreateParams,
  McpServerListItem,
  McpServerStatus,
  McpServerUpdateParams,
  McpToolInfo,
  AppSettings,
  SettingsUpdateParams,
  SpeechSttRequest,
  SpeechSttResponse,
  SpeechTtsRequest,
  SpeechTtsResponse,
  DockerConfig,
  DockerSessionStatus,
  RalphLogEntry,
  ExpertLogEntry,
  ContentBlock,
  Attachment,
  LoopConfig,
  ExpertConfig,
  ExpertConfigInput,
  ExpertHistoryCreateInput,
  ExpertHistoryListDetailedResult,
  ExpertHistoryItem,
  ButlerState,
  ButlerTask,
  TaskCompletionNotice,
  CalendarWatchEvent,
  CalendarWatchEventCreateInput,
  CalendarWatchEventUpdateInput,
  CountdownWatchItem,
  CountdownWatchItemCreateInput,
  CountdownWatchItemUpdateInput,
  MailWatchRule,
  MailWatchRuleCreateInput,
  MailWatchRuleUpdateInput,
  MailWatchMessage,
  RssWatchSubscription,
  RssWatchSubscriptionCreateInput,
  RssWatchSubscriptionUpdateInput,
  RssWatchItem,
  ButlerMonitorBusEvent,
  ButlerMonitorPullResult,
  ButlerMonitorSnapshot,
  CapabilityScope,
  ThreadDeleteOptions,
  PromptTemplate,
  PromptCreateInput,
  PromptUpdateInput,
  MemorySummary,
  DailyProfile
} from "../main/types"
import type {
  ActionbookEvent,
  ActionbookRuntimeState,
  KnowledgebaseCollectionSummary,
  KnowledgebaseDeleteCollectionRequest,
  KnowledgebaseDeleteCollectionResult,
  KnowledgebaseDeleteDocumentRequest,
  KnowledgebaseDeleteDocumentResult,
  KnowledgebaseCreateCollectionRequest,
  KnowledgebaseConfigUpdate,
  KnowledgebaseEvent,
  KnowledgebaseListChunksResult,
  KnowledgebaseListDocumentsResult,
  KnowledgebaseRuntimeState,
  KnowledgebaseStorageStatus,
  KnowledgebaseUploadItemResult,
  KnowledgebaseUploadRequest,
  PluginEnableUpdateParams,
  PresetPluginItem
} from "../main/plugins/core/contracts"

interface ElectronAPI {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    once: (channel: string, listener: (...args: unknown[]) => void) => void
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  }
  process: {
    platform: NodeJS.Platform
    versions: NodeJS.ProcessVersions
  }
}

interface CustomAPI {
  agent: {
    invoke: (
      threadId: string,
      message: string | ContentBlock[],
      onEvent: (event: StreamEvent) => void,
      modelId?: string
    ) => () => void
    streamAgent: (
      threadId: string,
      message: string | ContentBlock[],
      command: unknown,
      onEvent: (event: StreamEvent) => void,
      modelId?: string
    ) => () => void
    interrupt: (
      threadId: string,
      decision: HITLDecision,
      onEvent?: (event: StreamEvent) => void
    ) => () => void
    cancel: (threadId: string) => Promise<void>
  }
  threads: {
    list: () => Promise<Thread[]>
    get: (threadId: string) => Promise<Thread | null>
    create: (metadata?: Record<string, unknown>) => Promise<Thread>
    update: (threadId: string, updates: Partial<Thread>) => Promise<Thread>
    delete: (threadId: string, options?: ThreadDeleteOptions) => Promise<void>
    getHistory: (threadId: string) => Promise<unknown[]>
    getRalphLogTail: (threadId: string, limit?: number) => Promise<RalphLogEntry[]>
    getExpertLogTail: (threadId: string, limit?: number) => Promise<ExpertLogEntry[]>
    generateTitle: (message: string) => Promise<string>
  }
  loop: {
    getConfig: (threadId: string) => Promise<LoopConfig | null>
    updateConfig: (threadId: string, config: LoopConfig) => Promise<LoopConfig>
    start: (threadId: string) => Promise<LoopConfig>
    stop: (threadId: string) => Promise<LoopConfig>
    status: (threadId: string) => Promise<{ running: boolean; queueLength: number }>
  }
  expert: {
    getConfig: (threadId: string) => Promise<ExpertConfig | null>
    updateConfig: (
      threadId: string,
      config: ExpertConfigInput | ExpertConfig
    ) => Promise<ExpertConfig>
    listHistory: () => Promise<ExpertHistoryItem[]>
    listHistoryDetailed: () => Promise<ExpertHistoryListDetailedResult>
    createHistory: (input: ExpertHistoryCreateInput) => Promise<ExpertHistoryItem>
    deleteHistory: (id: string) => Promise<void>
  }
  butler: {
    getState: () => Promise<ButlerState>
    send: (message: string) => Promise<ButlerState>
    listTasks: () => Promise<ButlerTask[]>
    clearHistory: () => Promise<ButlerState>
    clearTasks: () => Promise<ButlerTask[]>
    onTaskUpdate: (callback: (tasks: ButlerTask[]) => void) => () => void
    onTaskCompleted: (callback: (card: TaskCompletionNotice) => void) => () => void
  }
  butlerMonitor: {
    getSnapshot: () => Promise<ButlerMonitorSnapshot>
    listCalendarEvents: () => Promise<CalendarWatchEvent[]>
    createCalendarEvent: (input: CalendarWatchEventCreateInput) => Promise<CalendarWatchEvent>
    updateCalendarEvent: (
      id: string,
      updates: CalendarWatchEventUpdateInput
    ) => Promise<CalendarWatchEvent>
    deleteCalendarEvent: (id: string) => Promise<void>
    listCountdownTimers: () => Promise<CountdownWatchItem[]>
    createCountdownTimer: (input: CountdownWatchItemCreateInput) => Promise<CountdownWatchItem>
    updateCountdownTimer: (
      id: string,
      updates: CountdownWatchItemUpdateInput
    ) => Promise<CountdownWatchItem>
    deleteCountdownTimer: (id: string) => Promise<void>
    listMailRules: () => Promise<MailWatchRule[]>
    createMailRule: (input: MailWatchRuleCreateInput) => Promise<MailWatchRule>
    updateMailRule: (id: string, updates: MailWatchRuleUpdateInput) => Promise<MailWatchRule>
    deleteMailRule: (id: string) => Promise<void>
    listRecentMails: (limit?: number) => Promise<MailWatchMessage[]>
    listRssSubscriptions: () => Promise<RssWatchSubscription[]>
    createRssSubscription: (input: RssWatchSubscriptionCreateInput) => Promise<RssWatchSubscription>
    updateRssSubscription: (
      id: string,
      updates: RssWatchSubscriptionUpdateInput
    ) => Promise<RssWatchSubscription>
    deleteRssSubscription: (id: string) => Promise<void>
    listRecentRssItems: (limit?: number) => Promise<RssWatchItem[]>
    pullNow: () => Promise<ButlerMonitorPullResult>
    pullMailNow: () => Promise<MailWatchMessage[]>
    onEvent: (callback: (event: ButlerMonitorBusEvent) => void) => () => void
  }
  prompts: {
    list: (query?: string) => Promise<PromptTemplate[]>
    get: (id: string) => Promise<PromptTemplate | null>
    create: (input: PromptCreateInput) => Promise<PromptTemplate>
    update: (id: string, updates: PromptUpdateInput) => Promise<PromptTemplate>
    delete: (id: string) => Promise<void>
  }
  memory: {
    listConversationSummaries: (limit?: number) => Promise<MemorySummary[]>
    listDailyProfiles: (limit?: number) => Promise<DailyProfile[]>
    clearAll: () => Promise<void>
  }
  models: {
    list: () => Promise<ModelConfig[]>
    listProviders: () => Promise<Provider[]>
    getDefault: () => Promise<string>
    deleteApiKey: (provider: string) => Promise<void>
    setDefault: (modelId: string) => Promise<void>
    setApiKey: (provider: string, apiKey: string) => Promise<void>
    getApiKey: (provider: string) => Promise<string | null>
  }
  provider: {
    getConfig: () => Promise<ProviderState | null>
    setConfig: (config: ProviderState) => Promise<void>
  }
  attachments: {
    pick: (input: { kind: "image" | "document" }) => Promise<Attachment[] | null>
  }
  subagents: {
    list: () => Promise<SubagentConfig[]>
    create: (input: Omit<SubagentConfig, "id">) => Promise<SubagentConfig>
    update: (id: string, updates: Partial<Omit<SubagentConfig, "id">>) => Promise<SubagentConfig>
    delete: (id: string) => Promise<void>
  }
  skills: {
    list: () => Promise<SkillItem[]>
    scan: () => Promise<SkillItem[]>
    create: (input: { name: string; description: string; content?: string }) => Promise<SkillItem>
    install: (input: { path: string }) => Promise<SkillItem>
    delete: (name: string) => Promise<void>
    setEnabled: (input: { name: string; enabled: boolean }) => Promise<SkillItem>
    setEnabledScope: (input: {
      name: string
      enabled: boolean
      scope: CapabilityScope
    }) => Promise<SkillItem>
    getContent: (name: string) => Promise<string>
    saveContent: (input: { name: string; content: string }) => Promise<SkillItem>
  }
  tools: {
    list: () => Promise<ToolInfo[]>
    setKey: (input: ToolKeyUpdateParams) => Promise<ToolInfo>
    setEnabled: (input: ToolEnableUpdateParams) => Promise<ToolInfo>
    setEnabledScope: (input: ToolEnableScopeUpdateParams) => Promise<ToolInfo>
  }
  middleware: {
    list: () => Promise<MiddlewareDefinition[]>
  }
  docker: {
    check: () => Promise<{ available: boolean; error?: string }>
    getConfig: () => Promise<DockerConfig>
    setConfig: (config: DockerConfig) => Promise<DockerConfig>
    status: () => Promise<DockerSessionStatus>
    enter: () => Promise<DockerSessionStatus>
    exit: () => Promise<DockerSessionStatus>
    restart: () => Promise<DockerSessionStatus>
    runtimeConfig: () => Promise<{ config: DockerConfig | null; containerId: string | null }>
    selectMountPath: (currentPath?: string) => Promise<string | null>
    mountFiles: () => Promise<{
      success: boolean
      files: Array<{
        path: string
        is_dir: boolean
        size?: number
        modified_at?: string
      }>
      mounts?: Array<{
        hostPath: string
        containerPath: string
        readOnly?: boolean
      }>
      error?: string
    }>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (input: SettingsUpdateParams) => Promise<AppSettings>
  }
  notifications: {
    muteTask: (taskIdentity: string) => Promise<void>
    unmuteTask: (taskIdentity: string) => Promise<void>
    listMutedTasks: () => Promise<string[]>
  }
  plugins: {
    list: () => Promise<PresetPluginItem[]>
    setEnabled: (input: PluginEnableUpdateParams) => Promise<PresetPluginItem>
    actionbookGetState: () => Promise<ActionbookRuntimeState>
    actionbookRefreshChecks: () => Promise<ActionbookRuntimeState>
    actionbookStart: () => Promise<ActionbookRuntimeState>
    actionbookStop: () => Promise<ActionbookRuntimeState>
    actionbookStatus: () => Promise<ActionbookRuntimeState>
    actionbookPing: () => Promise<ActionbookRuntimeState>
    onActionbookEvent: (callback: (event: ActionbookEvent) => void) => () => void
    knowledgebaseGetState: () => Promise<KnowledgebaseRuntimeState>
    knowledgebaseUpdateConfig: (
      input: KnowledgebaseConfigUpdate
    ) => Promise<KnowledgebaseRuntimeState>
    knowledgebasePickExe: () => Promise<string | null>
    knowledgebasePickDataDir: () => Promise<string | null>
    knowledgebasePickUploadFiles: () => Promise<string[] | null>
    knowledgebaseUploadDocuments: (
      input: KnowledgebaseUploadRequest
    ) => Promise<KnowledgebaseUploadItemResult[]>
    knowledgebaseStart: () => Promise<KnowledgebaseRuntimeState>
    knowledgebaseStop: () => Promise<KnowledgebaseRuntimeState>
    knowledgebaseRefresh: () => Promise<KnowledgebaseRuntimeState>
    knowledgebaseStorageStatus: () => Promise<KnowledgebaseStorageStatus>
    knowledgebaseListCollections: () => Promise<KnowledgebaseCollectionSummary[]>
    knowledgebaseCreateCollection: (
      input: KnowledgebaseCreateCollectionRequest
    ) => Promise<KnowledgebaseCollectionSummary>
    knowledgebaseDeleteDocument: (
      input: KnowledgebaseDeleteDocumentRequest
    ) => Promise<KnowledgebaseDeleteDocumentResult>
    knowledgebaseDeleteCollection: (
      input: KnowledgebaseDeleteCollectionRequest
    ) => Promise<KnowledgebaseDeleteCollectionResult>
    knowledgebaseListDocuments: (input: {
      collectionId: string
      limit?: number
      offset?: number
    }) => Promise<KnowledgebaseListDocumentsResult>
    knowledgebaseListChunks: (input: {
      documentId: string
      limit?: number
      offset?: number
    }) => Promise<KnowledgebaseListChunksResult>
    knowledgebaseOpenDataDir: () => Promise<boolean>
    onKnowledgebaseEvent: (callback: (event: KnowledgebaseEvent) => void) => () => void
  }
  speech: {
    stt: (input: SpeechSttRequest) => Promise<SpeechSttResponse>
    tts: (input: SpeechTtsRequest) => Promise<SpeechTtsResponse>
  }
  mcp: {
    list: () => Promise<McpServerListItem[]>
    tools: () => Promise<McpToolInfo[]>
    create: (input: McpServerCreateParams) => Promise<McpServerConfig>
    update: (input: McpServerUpdateParams) => Promise<McpServerConfig>
    delete: (id: string) => Promise<void>
    start: (id: string) => Promise<McpServerStatus>
    stop: (id: string) => Promise<McpServerStatus>
  }
  workspace: {
    get: (threadId?: string) => Promise<string | null>
    set: (threadId: string | undefined, path: string | null) => Promise<string | null>
    select: (threadId?: string) => Promise<string | null>
    loadFromDisk: (threadId: string) => Promise<{
      success: boolean
      files: Array<{
        path: string
        is_dir: boolean
        size?: number
        modified_at?: string
      }>
      workspacePath?: string
      mounts?: Array<{
        hostPath: string
        containerPath: string
        readOnly?: boolean
      }>
      error?: string
    }>
    readFile: (
      threadId: string,
      filePath: string
    ) => Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }>
    readBinaryFile: (
      threadId: string,
      filePath: string
    ) => Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }>
    onFilesChanged: (
      callback: (data: { threadId: string; workspacePath: string }) => void
    ) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
