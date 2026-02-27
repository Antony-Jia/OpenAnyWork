import { useCallback, useEffect, useState } from "react"
import type {
  KnowledgebaseCollectionSummary,
  KnowledgebaseConfigUpdate,
  KnowledgebaseEvent,
  KnowledgebaseListChunksResult,
  KnowledgebaseListDocumentsResult,
  KnowledgebaseRuntimeState,
  KnowledgebaseStorageStatus,
  KnowledgebaseUploadItemResult,
  KnowledgebaseUploadOptions,
  PresetPluginItem
} from "@/plugins/types"

interface UseKnowledgebasePluginResult {
  plugin: PresetPluginItem | null
  runtime: KnowledgebaseRuntimeState | null
  storage: KnowledgebaseStorageStatus | null
  collections: KnowledgebaseCollectionSummary[]
  documentsByCollection: Record<string, KnowledgebaseListDocumentsResult | undefined>
  chunksByDocument: Record<string, KnowledgebaseListChunksResult | undefined>
  uploadFilePaths: string[]
  uploadResults: KnowledgebaseUploadItemResult[]
  staleCollectionsPruned: boolean
  loading: boolean
  busy: Record<string, boolean>
  error: string | null
  reload: () => Promise<void>
  toggleEnabled: (enabled: boolean) => Promise<void>
  updateConfig: (updates: KnowledgebaseConfigUpdate) => Promise<void>
  pickExe: () => Promise<void>
  pickDataDir: () => Promise<void>
  startDaemon: () => Promise<void>
  stopDaemon: () => Promise<void>
  refreshStatus: () => Promise<void>
  openDataDir: () => Promise<void>
  loadStorage: () => Promise<void>
  loadCollections: () => Promise<void>
  loadDocuments: (collectionId: string) => Promise<void>
  loadChunks: (documentId: string) => Promise<void>
  setActiveCollections: (collectionIds: string[]) => Promise<void>
  pickUploadFiles: () => Promise<void>
  clearUploadFiles: () => void
  clearUploadResults: () => void
  uploadDocuments: (input: { collectionId: string; options?: KnowledgebaseUploadOptions }) => Promise<void>
  createDefaultCollection: () => Promise<KnowledgebaseCollectionSummary | null>
  deleteDocument: (documentId: string) => Promise<void>
  deleteCollection: (collectionId: string) => Promise<void>
}

const DEFAULT_COLLECTION_NAME = "默认集合"

function toErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return fallback
}

export function useKnowledgebasePlugin(): UseKnowledgebasePluginResult {
  const [plugin, setPlugin] = useState<PresetPluginItem | null>(null)
  const [runtime, setRuntime] = useState<KnowledgebaseRuntimeState | null>(null)
  const [storage, setStorage] = useState<KnowledgebaseStorageStatus | null>(null)
  const [collections, setCollections] = useState<KnowledgebaseCollectionSummary[]>([])
  const [documentsByCollection, setDocumentsByCollection] = useState<
    Record<string, KnowledgebaseListDocumentsResult | undefined>
  >({})
  const [chunksByDocument, setChunksByDocument] = useState<
    Record<string, KnowledgebaseListChunksResult | undefined>
  >({})
  const [uploadFilePaths, setUploadFilePaths] = useState<string[]>([])
  const [uploadResults, setUploadResults] = useState<KnowledgebaseUploadItemResult[]>([])
  const [staleCollectionsPruned, setStaleCollectionsPruned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const setBusyFlag = useCallback((key: string, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }))
  }, [])

  const loadStorage = useCallback(async () => {
    const status = await window.api.plugins.knowledgebaseStorageStatus()
    setStorage(status)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const plugins = await window.api.plugins.list()
      setPlugin(plugins.find((item) => item.id === "knowledgebase") ?? null)
      setRuntime(await window.api.plugins.knowledgebaseGetState())
      await loadStorage()
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load Knowledge Base plugin state."))
    } finally {
      setLoading(false)
    }
  }, [loadStorage])

  useEffect(() => {
    void reload()
    const unsubscribe = window.api.plugins.onKnowledgebaseEvent((event: KnowledgebaseEvent) => {
      if (event.type === "state") {
        setRuntime(event.state)
      }
    })
    return () => {
      if (typeof unsubscribe === "function") unsubscribe()
    }
  }, [reload])

  const runAction = useCallback(
    async (key: string, action: () => Promise<KnowledgebaseRuntimeState>) => {
      setBusyFlag(key, true)
      setError(null)
      try {
        setRuntime(await action())
        await loadStorage()
      } catch (err) {
        setError(toErrorMessage(err, "Knowledge Base action failed."))
      } finally {
        setBusyFlag(key, false)
      }
    },
    [loadStorage, setBusyFlag]
  )

  const toggleEnabled = useCallback(
    async (enabled: boolean) => {
      setBusyFlag("toggle", true)
      setError(null)
      try {
        const item = await window.api.plugins.setEnabled({ id: "knowledgebase", enabled })
        setPlugin(item)
        setRuntime(await window.api.plugins.knowledgebaseGetState())
        await loadStorage()
      } catch (err) {
        setError(toErrorMessage(err, "Failed to update plugin state."))
      } finally {
        setBusyFlag("toggle", false)
      }
    },
    [loadStorage, setBusyFlag]
  )

  const updateConfig = useCallback(
    async (updates: KnowledgebaseConfigUpdate) => {
      setBusyFlag("saveConfig", true)
      setError(null)
      try {
        setRuntime(await window.api.plugins.knowledgebaseUpdateConfig(updates))
        await loadStorage()
      } catch (err) {
        setError(toErrorMessage(err, "Failed to update Knowledge Base config."))
      } finally {
        setBusyFlag("saveConfig", false)
      }
    },
    [loadStorage, setBusyFlag]
  )

  const setActiveCollections = useCallback(
    async (collectionIds: string[]) => {
      const normalized = Array.from(new Set(collectionIds.map((value) => value.trim()).filter(Boolean)))
      await updateConfig({ activeCollectionIds: normalized })
    },
    [updateConfig]
  )

  const pickExe = useCallback(async () => {
    setBusyFlag("pickExe", true)
    setError(null)
    try {
      await window.api.plugins.knowledgebasePickExe()
      setRuntime(await window.api.plugins.knowledgebaseGetState())
      await loadStorage()
    } catch (err) {
      setError(toErrorMessage(err, "Failed to choose executable."))
    } finally {
      setBusyFlag("pickExe", false)
    }
  }, [loadStorage, setBusyFlag])

  const pickDataDir = useCallback(async () => {
    setBusyFlag("pickDataDir", true)
    setError(null)
    try {
      await window.api.plugins.knowledgebasePickDataDir()
      setRuntime(await window.api.plugins.knowledgebaseGetState())
      await loadStorage()
    } catch (err) {
      setError(toErrorMessage(err, "Failed to choose data directory."))
    } finally {
      setBusyFlag("pickDataDir", false)
    }
  }, [loadStorage, setBusyFlag])

  const pickUploadFiles = useCallback(async () => {
    setBusyFlag("pickUploadFiles", true)
    setError(null)
    try {
      const paths = await window.api.plugins.knowledgebasePickUploadFiles()
      if (Array.isArray(paths)) {
        setUploadFilePaths(paths)
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to pick upload files."))
    } finally {
      setBusyFlag("pickUploadFiles", false)
    }
  }, [setBusyFlag])

  const clearUploadFiles = useCallback(() => {
    setUploadFilePaths([])
  }, [])

  const clearUploadResults = useCallback(() => {
    setUploadResults([])
  }, [])

  const createDefaultCollection = useCallback(async (): Promise<KnowledgebaseCollectionSummary | null> => {
    setBusyFlag("createDefaultCollection", true)
    setError(null)
    try {
      const created = await window.api.plugins.knowledgebaseCreateCollection({
        name: DEFAULT_COLLECTION_NAME
      })
      const nextActiveCollectionIds = Array.from(
        new Set([...(runtime?.config.activeCollectionIds ?? []), created.id])
      )
      setRuntime(
        await window.api.plugins.knowledgebaseUpdateConfig({
          activeCollectionIds: nextActiveCollectionIds
        })
      )
      try {
        setCollections(await window.api.plugins.knowledgebaseListCollections())
      } catch (refreshError) {
        setError(
          toErrorMessage(
            refreshError,
            "Failed to refresh collections after creating default collection."
          )
        )
        setCollections((prev) => {
          if (prev.some((item) => item.id === created.id)) {
            return prev
          }
          return [...prev, created]
        })
      }
      return created
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create default collection."))
      return null
    } finally {
      setBusyFlag("createDefaultCollection", false)
    }
  }, [runtime?.config.activeCollectionIds, setBusyFlag])

  const startDaemon = useCallback(async () => {
    await runAction("start", () => window.api.plugins.knowledgebaseStart())
  }, [runAction])

  const stopDaemon = useCallback(async () => {
    await runAction("stop", () => window.api.plugins.knowledgebaseStop())
  }, [runAction])

  const refreshStatus = useCallback(async () => {
    await runAction("refresh", () => window.api.plugins.knowledgebaseRefresh())
  }, [runAction])

  const openDataDir = useCallback(async () => {
    setBusyFlag("openDataDir", true)
    setError(null)
    try {
      await window.api.plugins.knowledgebaseOpenDataDir()
    } catch (err) {
      setError(toErrorMessage(err, "Failed to open data directory."))
    } finally {
      setBusyFlag("openDataDir", false)
    }
  }, [setBusyFlag])

  const loadCollections = useCallback(async () => {
    setBusyFlag("loadCollections", true)
    setError(null)
    try {
      const nextCollections = await window.api.plugins.knowledgebaseListCollections()
      setCollections(nextCollections)

      const activeCollectionIds = runtime?.config.activeCollectionIds ?? []
      if (activeCollectionIds.length > 0) {
        const validIds = new Set(nextCollections.map((item) => item.id))
        const nextActiveCollectionIds = Array.from(
          new Set(activeCollectionIds.filter((collectionId) => validIds.has(collectionId)))
        )
        if (nextActiveCollectionIds.length !== activeCollectionIds.length) {
          setRuntime(
            await window.api.plugins.knowledgebaseUpdateConfig({
              activeCollectionIds: nextActiveCollectionIds
            })
          )
          setStaleCollectionsPruned(true)
        } else {
          setStaleCollectionsPruned(false)
        }
      } else {
        setStaleCollectionsPruned(false)
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load collections."))
    } finally {
      setBusyFlag("loadCollections", false)
    }
  }, [runtime?.config.activeCollectionIds, setBusyFlag])

  const loadDocuments = useCallback(
    async (collectionId: string) => {
      setBusyFlag(`loadDocuments:${collectionId}`, true)
      setError(null)
      try {
        const result = await window.api.plugins.knowledgebaseListDocuments({
          collectionId,
          limit: 200,
          offset: 0
        })
        setDocumentsByCollection((prev) => ({ ...prev, [collectionId]: result }))
      } catch (err) {
        setError(toErrorMessage(err, "Failed to load collection documents."))
      } finally {
        setBusyFlag(`loadDocuments:${collectionId}`, false)
      }
    },
    [setBusyFlag]
  )

  const loadChunks = useCallback(
    async (documentId: string) => {
      setBusyFlag(`loadChunks:${documentId}`, true)
      setError(null)
      try {
        const result = await window.api.plugins.knowledgebaseListChunks({
          documentId,
          limit: 200,
          offset: 0
        })
        setChunksByDocument((prev) => ({ ...prev, [documentId]: result }))
      } catch (err) {
        setError(toErrorMessage(err, "Failed to load document chunks."))
      } finally {
        setBusyFlag(`loadChunks:${documentId}`, false)
      }
    },
    [setBusyFlag]
  )

  const uploadDocuments = useCallback(
    async (input: { collectionId: string; options?: KnowledgebaseUploadOptions }) => {
      const collectionId = input.collectionId?.trim()
      if (!collectionId) {
        setError("Collection ID is required.")
        return
      }
      if (uploadFilePaths.length === 0) {
        setError("No files selected for upload.")
        return
      }

      setBusyFlag("uploadDocuments", true)
      setError(null)
      try {
        const results = await window.api.plugins.knowledgebaseUploadDocuments({
          collectionId,
          filePaths: uploadFilePaths,
          options: input.options,
          poll: true
        })
        setUploadResults(results)
        await loadCollections()
        await loadDocuments(collectionId)
      } catch (err) {
        setError(toErrorMessage(err, "Failed to upload documents."))
      } finally {
        setBusyFlag("uploadDocuments", false)
      }
    },
    [loadCollections, loadDocuments, setBusyFlag, uploadFilePaths]
  )

  const deleteDocument = useCallback(
    async (documentId: string) => {
      const normalizedDocumentId = documentId.trim()
      if (!normalizedDocumentId) {
        setError("Document ID is required.")
        return
      }

      setBusyFlag(`deleteDocument:${normalizedDocumentId}`, true)
      setError(null)
      try {
        const result = await window.api.plugins.knowledgebaseDeleteDocument({
          documentId: normalizedDocumentId,
          poll: true
        })
        if (result.status === "failed") {
          throw new Error(result.error || "Failed to delete document.")
        }

        const parentCollectionId = Object.values(documentsByCollection)
          .flatMap((item) => item?.documents ?? [])
          .find((item) => item.id === normalizedDocumentId)?.collection_id

        setChunksByDocument((prev) => {
          const next = { ...prev }
          delete next[normalizedDocumentId]
          return next
        })

        if (parentCollectionId) {
          await loadDocuments(parentCollectionId)
        }
      } catch (err) {
        setError(toErrorMessage(err, "Failed to delete document."))
      } finally {
        setBusyFlag(`deleteDocument:${normalizedDocumentId}`, false)
      }
    },
    [documentsByCollection, loadDocuments, setBusyFlag]
  )

  const deleteCollection = useCallback(
    async (collectionId: string) => {
      const normalizedCollectionId = collectionId.trim()
      if (!normalizedCollectionId) {
        setError("Collection ID is required.")
        return
      }

      setBusyFlag(`deleteCollection:${normalizedCollectionId}`, true)
      setError(null)
      try {
        const result = await window.api.plugins.knowledgebaseDeleteCollection({
          collectionId: normalizedCollectionId,
          poll: true,
          cascadeDocuments: true
        })
        if (!result.collectionDeleted) {
          throw new Error(result.error || "Failed to delete collection.")
        }

        setDocumentsByCollection((prev) => {
          const next = { ...prev }
          delete next[normalizedCollectionId]
          return next
        })
        const deletedDocumentIds = new Set(result.documentResults.map((item) => item.documentId))
        setChunksByDocument((prev) => {
          const next: Record<string, KnowledgebaseListChunksResult | undefined> = {}
          for (const [documentId, chunkResult] of Object.entries(prev)) {
            if (!deletedDocumentIds.has(documentId)) {
              next[documentId] = chunkResult
            }
          }
          return next
        })
        await loadCollections()
      } catch (err) {
        setError(toErrorMessage(err, "Failed to delete collection."))
      } finally {
        setBusyFlag(`deleteCollection:${normalizedCollectionId}`, false)
      }
    },
    [loadCollections, setBusyFlag]
  )

  return {
    plugin,
    runtime,
    storage,
    collections,
    documentsByCollection,
    chunksByDocument,
    uploadFilePaths,
    uploadResults,
    staleCollectionsPruned,
    loading,
    busy,
    error,
    reload,
    toggleEnabled,
    updateConfig,
    pickExe,
    pickDataDir,
    startDaemon,
    stopDaemon,
    refreshStatus,
    openDataDir,
    loadStorage,
    loadCollections,
    loadDocuments,
    loadChunks,
    setActiveCollections,
    pickUploadFiles,
    clearUploadFiles,
    clearUploadResults,
    uploadDocuments,
    createDefaultCollection,
    deleteDocument,
    deleteCollection
  }
}
