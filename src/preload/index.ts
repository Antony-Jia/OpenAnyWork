import { contextBridge, ipcRenderer } from "electron"
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
  CapabilityScope,
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
  RalphLogEntry,
  Attachment,
  ContentBlock,
  LoopConfig,
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
  ButlerMonitorBusEvent,
  ButlerMonitorSnapshot,
  ThreadDeleteOptions,
  PromptTemplate,
  PromptCreateInput,
  PromptUpdateInput,
  MemorySummary,
  DailyProfile
} from "../main/types"

// Simple electron API - replaces @electron-toolkit/preload
const electronAPI = {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      const wrappedListener = (_event: unknown, ...args: unknown[]): void => listener(...args)
      ipcRenderer.on(channel, wrappedListener)
      return () => ipcRenderer.removeListener(channel, wrappedListener)
    },
    once: (channel: string, listener: (...args: unknown[]) => void) => {
      const wrappedListener = (_event: unknown, ...args: unknown[]): void => listener(...args)
      ipcRenderer.once(channel, wrappedListener)
    },
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  },
  process: {
    platform: process.platform,
    versions: process.versions
  }
}

// Custom APIs for renderer
const api = {
  agent: {
    // Send message and receive events via callback
    invoke: (
      threadId: string,
      message: string | ContentBlock[],
      onEvent: (event: StreamEvent) => void,
      modelId?: string
    ): (() => void) => {
      const channel = `agent:stream:${threadId}`

      const handler = (_: unknown, data: StreamEvent): void => {
        onEvent(data)
        if (data.type === "done" || data.type === "error") {
          ipcRenderer.removeListener(channel, handler)
        }
      }

      ipcRenderer.on(channel, handler)
      ipcRenderer.send("agent:invoke", { threadId, message, modelId })

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, handler)
      }
    },
    // Stream agent events for useStream transport
    streamAgent: (
      threadId: string,
      message: string | ContentBlock[],
      command: unknown,
      onEvent: (event: StreamEvent) => void,
      modelId?: string
    ): (() => void) => {
      const channel = `agent:stream:${threadId}`

      const handler = (_: unknown, data: StreamEvent): void => {
        onEvent(data)
        if (data.type === "done" || data.type === "error") {
          ipcRenderer.removeListener(channel, handler)
        }
      }

      ipcRenderer.on(channel, handler)

      // If we have a command, it might be a resume/retry
      if (command) {
        ipcRenderer.send("agent:resume", { threadId, command, modelId })
      } else {
        ipcRenderer.send("agent:invoke", { threadId, message, modelId })
      }

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, handler)
      }
    },
    interrupt: (
      threadId: string,
      decision: HITLDecision,
      onEvent?: (event: StreamEvent) => void
    ): (() => void) => {
      const channel = `agent:stream:${threadId}`

      const handler = (_: unknown, data: StreamEvent): void => {
        onEvent?.(data)
        if (data.type === "done" || data.type === "error") {
          ipcRenderer.removeListener(channel, handler)
        }
      }

      ipcRenderer.on(channel, handler)
      ipcRenderer.send("agent:interrupt", { threadId, decision })

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, handler)
      }
    },
    cancel: (threadId: string): Promise<void> => {
      return ipcRenderer.invoke("agent:cancel", { threadId })
    }
  },
  threads: {
    list: (): Promise<Thread[]> => {
      return ipcRenderer.invoke("threads:list")
    },
    get: (threadId: string): Promise<Thread | null> => {
      return ipcRenderer.invoke("threads:get", threadId)
    },
    create: (metadata?: Record<string, unknown>): Promise<Thread> => {
      return ipcRenderer.invoke("threads:create", metadata)
    },
    update: (threadId: string, updates: Partial<Thread>): Promise<Thread> => {
      return ipcRenderer.invoke("threads:update", { threadId, updates })
    },
    delete: (threadId: string, options?: ThreadDeleteOptions): Promise<void> => {
      if (options) {
        return ipcRenderer.invoke("threads:delete", { threadId, options })
      }
      return ipcRenderer.invoke("threads:delete", threadId)
    },
    getHistory: (threadId: string): Promise<unknown[]> => {
      return ipcRenderer.invoke("threads:history", threadId)
    },
    getRalphLogTail: (threadId: string, limit?: number): Promise<RalphLogEntry[]> => {
      return ipcRenderer.invoke("threads:ralphLogTail", threadId, limit)
    },
    generateTitle: (message: string): Promise<string> => {
      return ipcRenderer.invoke("threads:generateTitle", message)
    }
  },
  loop: {
    getConfig: (threadId: string): Promise<LoopConfig | null> => {
      return ipcRenderer.invoke("loop:getConfig", threadId)
    },
    updateConfig: (threadId: string, config: LoopConfig): Promise<LoopConfig> => {
      return ipcRenderer.invoke("loop:updateConfig", { threadId, config })
    },
    start: (threadId: string): Promise<LoopConfig> => {
      return ipcRenderer.invoke("loop:start", threadId)
    },
    stop: (threadId: string): Promise<LoopConfig> => {
      return ipcRenderer.invoke("loop:stop", threadId)
    },
    status: (threadId: string): Promise<{ running: boolean; queueLength: number }> => {
      return ipcRenderer.invoke("loop:status", threadId)
    }
  },
  butler: {
    getState: (): Promise<ButlerState> => {
      return ipcRenderer.invoke("butler:getState")
    },
    send: (message: string): Promise<ButlerState> => {
      return ipcRenderer.invoke("butler:send", message)
    },
    listTasks: (): Promise<ButlerTask[]> => {
      return ipcRenderer.invoke("butler:listTasks")
    },
    clearHistory: (): Promise<ButlerState> => {
      return ipcRenderer.invoke("butler:clearHistory")
    },
    clearTasks: (): Promise<ButlerTask[]> => {
      return ipcRenderer.invoke("butler:clearTasks")
    },
    onTaskUpdate: (callback: (tasks: ButlerTask[]) => void): (() => void) => {
      const handler = (_: unknown, tasks: ButlerTask[]): void => callback(tasks)
      ipcRenderer.on("butler:tasks-changed", handler)
      return () => ipcRenderer.removeListener("butler:tasks-changed", handler)
    },
    onTaskCompleted: (
      callback: (card: TaskCompletionNotice) => void
    ): (() => void) => {
      const handler = (_: unknown, card: TaskCompletionNotice): void => callback(card)
      ipcRenderer.on("app:task-card", handler)
      return () => ipcRenderer.removeListener("app:task-card", handler)
    }
  },
  butlerMonitor: {
    getSnapshot: (): Promise<ButlerMonitorSnapshot> => {
      return ipcRenderer.invoke("butler-monitor:getSnapshot")
    },
    listCalendarEvents: (): Promise<CalendarWatchEvent[]> => {
      return ipcRenderer.invoke("butler-monitor:calendar:list")
    },
    createCalendarEvent: (input: CalendarWatchEventCreateInput): Promise<CalendarWatchEvent> => {
      return ipcRenderer.invoke("butler-monitor:calendar:create", input)
    },
    updateCalendarEvent: (
      id: string,
      updates: CalendarWatchEventUpdateInput
    ): Promise<CalendarWatchEvent> => {
      return ipcRenderer.invoke("butler-monitor:calendar:update", { id, updates })
    },
    deleteCalendarEvent: (id: string): Promise<void> => {
      return ipcRenderer.invoke("butler-monitor:calendar:delete", id)
    },
    listCountdownTimers: (): Promise<CountdownWatchItem[]> => {
      return ipcRenderer.invoke("butler-monitor:countdown:list")
    },
    createCountdownTimer: (
      input: CountdownWatchItemCreateInput
    ): Promise<CountdownWatchItem> => {
      return ipcRenderer.invoke("butler-monitor:countdown:create", input)
    },
    updateCountdownTimer: (
      id: string,
      updates: CountdownWatchItemUpdateInput
    ): Promise<CountdownWatchItem> => {
      return ipcRenderer.invoke("butler-monitor:countdown:update", { id, updates })
    },
    deleteCountdownTimer: (id: string): Promise<void> => {
      return ipcRenderer.invoke("butler-monitor:countdown:delete", id)
    },
    listMailRules: (): Promise<MailWatchRule[]> => {
      return ipcRenderer.invoke("butler-monitor:mail:listRules")
    },
    createMailRule: (input: MailWatchRuleCreateInput): Promise<MailWatchRule> => {
      return ipcRenderer.invoke("butler-monitor:mail:createRule", input)
    },
    updateMailRule: (id: string, updates: MailWatchRuleUpdateInput): Promise<MailWatchRule> => {
      return ipcRenderer.invoke("butler-monitor:mail:updateRule", { id, updates })
    },
    deleteMailRule: (id: string): Promise<void> => {
      return ipcRenderer.invoke("butler-monitor:mail:deleteRule", id)
    },
    listRecentMails: (limit?: number): Promise<MailWatchMessage[]> => {
      return ipcRenderer.invoke("butler-monitor:mail:listMessages", limit)
    },
    pullMailNow: (): Promise<MailWatchMessage[]> => {
      return ipcRenderer.invoke("butler-monitor:mail:pullNow")
    },
    onEvent: (
      callback: (event: ButlerMonitorBusEvent) => void
    ): (() => void) => {
      const handler = (_: unknown, event: ButlerMonitorBusEvent): void => callback(event)
      ipcRenderer.on("butler-monitor:event", handler)
      return () => ipcRenderer.removeListener("butler-monitor:event", handler)
    }
  },
  prompts: {
    list: (query?: string): Promise<PromptTemplate[]> => {
      return ipcRenderer.invoke("prompts:list", query)
    },
    get: (id: string): Promise<PromptTemplate | null> => {
      return ipcRenderer.invoke("prompts:get", id)
    },
    create: (input: PromptCreateInput): Promise<PromptTemplate> => {
      return ipcRenderer.invoke("prompts:create", input)
    },
    update: (id: string, updates: PromptUpdateInput): Promise<PromptTemplate> => {
      return ipcRenderer.invoke("prompts:update", { id, updates })
    },
    delete: (id: string): Promise<void> => {
      return ipcRenderer.invoke("prompts:delete", id)
    }
  },
  memory: {
    listConversationSummaries: (limit?: number): Promise<MemorySummary[]> => {
      return ipcRenderer.invoke("memory:listConversationSummaries", limit)
    },
    listDailyProfiles: (limit?: number): Promise<DailyProfile[]> => {
      return ipcRenderer.invoke("memory:listDailyProfiles", limit)
    },
    clearAll: (): Promise<void> => {
      return ipcRenderer.invoke("memory:clearAll")
    }
  },
  models: {
    list: (): Promise<ModelConfig[]> => {
      return ipcRenderer.invoke("models:list")
    },
    listProviders: (): Promise<Provider[]> => {
      return ipcRenderer.invoke("models:listProviders")
    },
    getDefault: (): Promise<string> => {
      return ipcRenderer.invoke("models:getDefault")
    },
    setDefault: (modelId: string): Promise<void> => {
      return ipcRenderer.invoke("models:setDefault", modelId)
    },
    setApiKey: (provider: string, apiKey: string): Promise<void> => {
      return ipcRenderer.invoke("models:setApiKey", { provider, apiKey })
    },
    getApiKey: (provider: string): Promise<string | null> => {
      return ipcRenderer.invoke("models:getApiKey", provider)
    },
    deleteApiKey: (provider: string): Promise<void> => {
      return ipcRenderer.invoke("models:deleteApiKey", provider)
    }
  },
  provider: {
    getConfig: (): Promise<ProviderState | null> => {
      return ipcRenderer.invoke("provider:getConfig")
    },
    setConfig: (config: ProviderState): Promise<void> => {
      return ipcRenderer.invoke("provider:setConfig", config)
    }
  },
  attachments: {
    pick: (input: { kind: "image" }): Promise<Attachment[] | null> => {
      return ipcRenderer.invoke("attachments:pick", input)
    }
  },
  subagents: {
    list: (): Promise<SubagentConfig[]> => {
      return ipcRenderer.invoke("subagents:list")
    },
    create: (input: Omit<SubagentConfig, "id">): Promise<SubagentConfig> => {
      return ipcRenderer.invoke("subagents:create", input)
    },
    update: (id: string, updates: Partial<Omit<SubagentConfig, "id">>): Promise<SubagentConfig> => {
      return ipcRenderer.invoke("subagents:update", { id, updates })
    },
    delete: (id: string): Promise<void> => {
      return ipcRenderer.invoke("subagents:delete", id)
    }
  },
  skills: {
    list: (): Promise<SkillItem[]> => {
      return ipcRenderer.invoke("skills:list")
    },
    create: (input: {
      name: string
      description: string
      content?: string
    }): Promise<SkillItem> => {
      return ipcRenderer.invoke("skills:create", input)
    },
    install: (input: { path: string }): Promise<SkillItem> => {
      return ipcRenderer.invoke("skills:install", input)
    },
    delete: (name: string): Promise<void> => {
      return ipcRenderer.invoke("skills:delete", name)
    },
    setEnabled: (input: { name: string; enabled: boolean }): Promise<SkillItem> => {
      return ipcRenderer.invoke("skills:setEnabled", input)
    },
    setEnabledScope: (input: {
      name: string
      enabled: boolean
      scope: CapabilityScope
    }): Promise<SkillItem> => {
      return ipcRenderer.invoke("skills:setEnabledScope", input)
    },
    getContent: (name: string): Promise<string> => {
      return ipcRenderer.invoke("skills:getContent", name)
    },
    saveContent: (input: { name: string; content: string }): Promise<SkillItem> => {
      return ipcRenderer.invoke("skills:saveContent", input)
    }
  },
  tools: {
    list: (): Promise<ToolInfo[]> => {
      return ipcRenderer.invoke("tools:list")
    },
    setKey: (input: ToolKeyUpdateParams): Promise<ToolInfo> => {
      return ipcRenderer.invoke("tools:setKey", input)
    },
    setEnabled: (input: ToolEnableUpdateParams): Promise<ToolInfo> => {
      return ipcRenderer.invoke("tools:setEnabled", input)
    },
    setEnabledScope: (input: ToolEnableScopeUpdateParams): Promise<ToolInfo> => {
      return ipcRenderer.invoke("tools:setEnabledScope", input)
    }
  },
  middleware: {
    list: (): Promise<MiddlewareDefinition[]> => {
      return ipcRenderer.invoke("middleware:list")
    }
  },
  docker: {
    check: (): Promise<{ available: boolean; error?: string }> => {
      return ipcRenderer.invoke("docker:check")
    },
    getConfig: (): Promise<unknown> => {
      return ipcRenderer.invoke("docker:getConfig")
    },
    setConfig: (config: unknown): Promise<unknown> => {
      return ipcRenderer.invoke("docker:setConfig", config)
    },
    status: (): Promise<unknown> => {
      return ipcRenderer.invoke("docker:status")
    },
    enter: (): Promise<unknown> => {
      return ipcRenderer.invoke("docker:enter")
    },
    exit: (): Promise<unknown> => {
      return ipcRenderer.invoke("docker:exit")
    },
    restart: (): Promise<unknown> => {
      return ipcRenderer.invoke("docker:restart")
    },
    runtimeConfig: (): Promise<unknown> => {
      return ipcRenderer.invoke("docker:runtimeConfig")
    },
    selectMountPath: (currentPath?: string): Promise<string | null> => {
      return ipcRenderer.invoke("docker:selectMountPath", currentPath)
    },
    mountFiles: (): Promise<unknown> => {
      return ipcRenderer.invoke("docker:mountFiles")
    }
  },
  settings: {
    get: (): Promise<AppSettings> => {
      return ipcRenderer.invoke("settings:get")
    },
    update: (input: SettingsUpdateParams): Promise<AppSettings> => {
      return ipcRenderer.invoke("settings:update", input)
    }
  },
  speech: {
    stt: (input: SpeechSttRequest): Promise<SpeechSttResponse> => {
      return ipcRenderer.invoke("speech:stt", input)
    },
    tts: (input: SpeechTtsRequest): Promise<SpeechTtsResponse> => {
      return ipcRenderer.invoke("speech:tts", input)
    }
  },
  mcp: {
    list: (): Promise<McpServerListItem[]> => {
      return ipcRenderer.invoke("mcp:list")
    },
    tools: (): Promise<McpToolInfo[]> => {
      return ipcRenderer.invoke("mcp:tools")
    },
    create: (input: McpServerCreateParams): Promise<McpServerConfig> => {
      return ipcRenderer.invoke("mcp:create", input)
    },
    update: (input: McpServerUpdateParams): Promise<McpServerConfig> => {
      return ipcRenderer.invoke("mcp:update", input)
    },
    delete: (id: string): Promise<void> => {
      return ipcRenderer.invoke("mcp:delete", id)
    },
    start: (id: string): Promise<McpServerStatus> => {
      return ipcRenderer.invoke("mcp:start", id)
    },
    stop: (id: string): Promise<McpServerStatus> => {
      return ipcRenderer.invoke("mcp:stop", id)
    }
  },
  workspace: {
    get: (threadId?: string): Promise<string | null> => {
      return ipcRenderer.invoke("workspace:get", threadId)
    },
    set: (threadId: string | undefined, path: string | null): Promise<string | null> => {
      return ipcRenderer.invoke("workspace:set", { threadId, path })
    },
    select: (threadId?: string): Promise<string | null> => {
      return ipcRenderer.invoke("workspace:select", threadId)
    },
    loadFromDisk: (
      threadId: string
    ): Promise<{
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
    }> => {
      return ipcRenderer.invoke("workspace:loadFromDisk", { threadId })
    },
    readFile: (
      threadId: string,
      filePath: string
    ): Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }> => {
      return ipcRenderer.invoke("workspace:readFile", { threadId, filePath })
    },
    readBinaryFile: (
      threadId: string,
      filePath: string
    ): Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }> => {
      return ipcRenderer.invoke("workspace:readBinaryFile", { threadId, filePath })
    },
    // Listen for file changes in the workspace
    onFilesChanged: (
      callback: (data: { threadId: string; workspacePath: string }) => void
    ): (() => void) => {
      const handler = (_: unknown, data: { threadId: string; workspacePath: string }): void => {
        callback(data)
      }
      ipcRenderer.on("workspace:files-changed", handler)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener("workspace:files-changed", handler)
      }
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
