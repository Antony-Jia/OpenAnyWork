import { create } from 'zustand'
import type {
  Thread,
  Message,
  Todo,
  ModelConfig,
  Provider,
  HITLRequest,
  FileInfo,
  Subagent
} from '@/types'

// Open file tab type
export interface OpenFile {
  path: string
  name: string
}

interface AppState {
  // Threads
  threads: Thread[]
  currentThreadId: string | null

  // Messages for current thread
  messages: Message[]

  // HITL state
  pendingApproval: HITLRequest | null

  // Todos (from agent)
  todos: Todo[]

  // Workspace files (from agent)
  workspaceFiles: FileInfo[]
  workspacePath: string | null

  // Subagents (from agent)
  subagents: Subagent[]

  // Models and Providers
  models: ModelConfig[]
  providers: Provider[]
  currentModel: string

  // Right panel state
  rightPanelTab: 'todos' | 'files' | 'subagents'

  // Settings dialog state
  settingsOpen: boolean

  // Sidebar state
  sidebarCollapsed: boolean

  // File viewer tabs state
  openFiles: OpenFile[]
  activeTab: 'agent' | string // 'agent' or file path
  fileContents: Record<string, string> // path -> content cache

  // Actions
  loadThreads: () => Promise<void>
  createThread: (metadata?: Record<string, unknown>) => Promise<Thread>
  selectThread: (threadId: string) => Promise<void>
  deleteThread: (threadId: string) => Promise<void>
  updateThread: (threadId: string, updates: Partial<Thread>) => Promise<void>

  // Message actions
  appendMessage: (message: Message) => void
  setMessages: (messages: Message[]) => void
  generateTitleForFirstMessage: (threadId: string, content: string) => Promise<void>

  // HITL actions
  setPendingApproval: (request: HITLRequest | null) => void
  respondToApproval: (
    decision: 'approve' | 'reject' | 'edit',
    editedArgs?: Record<string, unknown>
  ) => Promise<void>

  // Todo actions
  setTodos: (todos: Todo[]) => void

  // Workspace actions
  setWorkspaceFiles: (files: FileInfo[]) => void
  setWorkspacePath: (path: string | null) => void

  // Subagent actions
  setSubagents: (subagents: Subagent[]) => void

  // Model actions
  loadModels: () => Promise<void>
  loadProviders: () => Promise<void>
  setCurrentModel: (modelId: string) => Promise<void>
  setApiKey: (providerId: string, apiKey: string) => Promise<void>
  deleteApiKey: (providerId: string) => Promise<void>

  // Panel actions
  setRightPanelTab: (tab: 'todos' | 'files' | 'subagents') => void

  // Settings actions
  setSettingsOpen: (open: boolean) => void

  // Sidebar actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // File viewer tab actions
  openFile: (path: string, name: string) => void
  closeFile: (path: string) => void
  setActiveTab: (tab: 'agent' | string) => void
  setFileContents: (path: string, content: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  threads: [],
  currentThreadId: null,
  messages: [],
  pendingApproval: null,
  todos: [],
  workspaceFiles: [],
  workspacePath: null,
  subagents: [],
  models: [],
  providers: [],
  currentModel: 'claude-sonnet-4-5-20250929',
  rightPanelTab: 'todos',
  settingsOpen: false,
  sidebarCollapsed: false,
  openFiles: [],
  activeTab: 'agent',
  fileContents: {},

  // Thread actions
  loadThreads: async () => {
    const threads = await window.api.threads.list()
    set({ threads })

    // Select first thread if none selected
    if (!get().currentThreadId && threads.length > 0) {
      await get().selectThread(threads[0].thread_id)
    }
  },

  createThread: async (metadata?: Record<string, unknown>) => {
    const thread = await window.api.threads.create(metadata)
    set((state) => ({
      threads: [thread, ...state.threads],
      currentThreadId: thread.thread_id,
      messages: [],
      todos: [],
      workspaceFiles: [],
      workspacePath: null,
      subagents: []
    }))
    return thread
  },

  selectThread: async (threadId: string) => {
    set({
      currentThreadId: threadId,
      messages: [],
      todos: [],
      workspaceFiles: [],
      workspacePath: null,
      subagents: []
    })

    // Load thread history from checkpoints
    try {
      const history = await window.api.threads.getHistory(threadId)

      // Get the most recent checkpoint (first in the list since it's ordered DESC)
      if (history.length > 0) {
        const latestCheckpoint = history[0] as {
          checkpoint?: {
            channel_values?: {
              messages?: Array<{
                id?: string
                _getType?: () => string
                type?: string
                content?: string | unknown[]
                tool_calls?: unknown[]
              }>
              todos?: Array<{
                id?: string
                content?: string
                status?: string
              }>
            }
          }
        }

        const channelValues = latestCheckpoint.checkpoint?.channel_values

        // Extract messages
        if (channelValues?.messages && Array.isArray(channelValues.messages)) {
          const messages: Message[] = channelValues.messages.map((msg, index) => {
            // Determine role from message type
            let role: 'user' | 'assistant' | 'system' | 'tool' = 'assistant'
            if (typeof msg._getType === 'function') {
              const type = msg._getType()
              if (type === 'human') role = 'user'
              else if (type === 'ai') role = 'assistant'
              else if (type === 'system') role = 'system'
              else if (type === 'tool') role = 'tool'
            } else if (msg.type) {
              if (msg.type === 'human') role = 'user'
              else if (msg.type === 'ai') role = 'assistant'
              else if (msg.type === 'system') role = 'system'
              else if (msg.type === 'tool') role = 'tool'
            }

            // Handle content - could be string or array of content blocks
            let content: Message['content'] = ''
            if (typeof msg.content === 'string') {
              content = msg.content
            } else if (Array.isArray(msg.content)) {
              content = msg.content as Message['content']
            }

            return {
              id: msg.id || `msg-${index}`,
              role,
              content,
              tool_calls: msg.tool_calls as Message['tool_calls'],
              created_at: new Date()
            }
          })

          set({ messages })
        }

        // Extract todos if present
        if (channelValues?.todos && Array.isArray(channelValues.todos)) {
          const todos: Todo[] = channelValues.todos.map((todo, index) => ({
            id: todo.id || `todo-${index}`,
            content: todo.content || '',
            status: (todo.status as Todo['status']) || 'pending'
          }))

          set({ todos })
        }
      }
    } catch (error) {
      console.error('Failed to load thread history:', error)
    }
  },

  deleteThread: async (threadId: string) => {
    console.log('[Store] Deleting thread:', threadId)
    try {
      await window.api.threads.delete(threadId)
      console.log('[Store] Thread deleted from backend')

      set((state) => {
        const threads = state.threads.filter((t) => t.thread_id !== threadId)
        const wasCurrentThread = state.currentThreadId === threadId
        const newCurrentId = wasCurrentThread
          ? threads[0]?.thread_id || null
          : state.currentThreadId

        console.log('[Store] Updating state:', {
          remainingThreads: threads.length,
          wasCurrentThread,
          newCurrentId
        })

        return {
          threads,
          currentThreadId: newCurrentId,
          // Clear messages if we deleted the current thread
          messages: wasCurrentThread ? [] : state.messages,
          // Clear other state if we deleted the current thread
          todos: wasCurrentThread ? [] : state.todos,
          workspaceFiles: wasCurrentThread ? [] : state.workspaceFiles,
          workspacePath: wasCurrentThread ? null : state.workspacePath,
          subagents: wasCurrentThread ? [] : state.subagents
        }
      })
    } catch (error) {
      console.error('[Store] Failed to delete thread:', error)
    }
  },

  updateThread: async (threadId: string, updates: Partial<Thread>) => {
    const updated = await window.api.threads.update(threadId, updates)
    set((state) => ({
      threads: state.threads.map((t) => (t.thread_id === threadId ? updated : t))
    }))
  },

  // Message actions
  appendMessage: (message: Message) => {
    set((state) => {
      // Check if message already exists (by id)
      const exists = state.messages.some((m) => m.id === message.id)
      if (exists) {
        return { messages: state.messages.map((m) => (m.id === message.id ? message : m)) }
      }
      return { messages: [...state.messages, message] }
    })
  },

  setMessages: (messages: Message[]) => {
    set({ messages })
  },

  // Auto-generate title for first message in a thread
  generateTitleForFirstMessage: async (threadId: string, content: string) => {
    try {
      const generatedTitle = await window.api.threads.generateTitle(content)
      await get().updateThread(threadId, { title: generatedTitle })
    } catch (error) {
      console.error('[Store] Failed to generate title:', error)
    }
  },

  // HITL actions
  setPendingApproval: (request: HITLRequest | null) => {
    set({ pendingApproval: request })
  },

  respondToApproval: async (
    decision: 'approve' | 'reject' | 'edit',
    editedArgs?: Record<string, unknown>
  ) => {
    const { currentThreadId, pendingApproval } = get()
    if (!currentThreadId || !pendingApproval) return

    await window.api.agent.interrupt(currentThreadId, {
      type: decision,
      tool_call_id: pendingApproval.tool_call.id,
      edited_args: editedArgs
    })

    set({ pendingApproval: null })
  },

  // Todo actions
  setTodos: (todos: Todo[]) => {
    set({ todos })
  },

  // Workspace actions
  setWorkspaceFiles: (files: FileInfo[]) => {
    set({ workspaceFiles: files })
  },

  setWorkspacePath: (path: string | null) => {
    set({ workspacePath: path })
  },

  // Subagent actions
  setSubagents: (subagents: Subagent[]) => {
    set({ subagents })
  },

  // Model actions
  loadModels: async () => {
    const models = await window.api.models.list()
    const currentModel = await window.api.models.getDefault()
    set({ models, currentModel })
  },

  loadProviders: async () => {
    const providers = await window.api.models.listProviders()
    set({ providers })
  },

  setCurrentModel: async (modelId: string) => {
    await window.api.models.setDefault(modelId)
    set({ currentModel: modelId })
  },

  setApiKey: async (providerId: string, apiKey: string) => {
    console.log('[Store] setApiKey called:', { providerId, keyLength: apiKey.length })
    try {
      await window.api.models.setApiKey(providerId, apiKey)
      console.log('[Store] API key saved via IPC')
      // Reload providers and models to update availability
      await get().loadProviders()
      await get().loadModels()
      console.log('[Store] Providers and models reloaded')
    } catch (e) {
      console.error('[Store] Failed to set API key:', e)
      throw e
    }
  },

  deleteApiKey: async (providerId: string) => {
    await window.api.models.deleteApiKey(providerId)
    // Reload providers and models to update availability
    await get().loadProviders()
    await get().loadModels()
  },

  // Panel actions
  setRightPanelTab: (tab: 'todos' | 'files' | 'subagents') => {
    set({ rightPanelTab: tab })
  },

  // Settings actions
  setSettingsOpen: (open: boolean) => {
    set({ settingsOpen: open })
  },

  // Sidebar actions
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed })
  },

  // File viewer tab actions
  openFile: (path: string, name: string) => {
    set((state) => {
      // Check if file is already open
      const alreadyOpen = state.openFiles.some((f) => f.path === path)
      if (alreadyOpen) {
        // Just switch to it
        return { activeTab: path }
      }
      // Add to open files and switch to it
      return {
        openFiles: [...state.openFiles, { path, name }],
        activeTab: path
      }
    })
  },

  closeFile: (path: string) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((f) => f.path !== path)
      // Remove from content cache
      const { [path]: _, ...newFileContents } = state.fileContents

      // If closing the active tab, switch to agent or the previous file
      let newActiveTab = state.activeTab
      if (state.activeTab === path) {
        const closedIndex = state.openFiles.findIndex((f) => f.path === path)
        if (newOpenFiles.length === 0) {
          newActiveTab = 'agent'
        } else if (closedIndex > 0) {
          newActiveTab = newOpenFiles[closedIndex - 1].path
        } else {
          newActiveTab = newOpenFiles[0].path
        }
      }

      return {
        openFiles: newOpenFiles,
        activeTab: newActiveTab,
        fileContents: newFileContents
      }
    })
  },

  setActiveTab: (tab: 'agent' | string) => {
    set({ activeTab: tab })
  },

  setFileContents: (path: string, content: string) => {
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content }
    }))
  }
}))
