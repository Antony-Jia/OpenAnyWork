import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import { useKnowledgebasePlugin } from "./useKnowledgebasePlugin"
import type { KnowledgebaseConfig, KnowledgebaseProvider } from "@/plugins/types"

function formatTime(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString()
}

function formatSize(size?: number): string {
  if (typeof size !== "number" || Number.isNaN(size)) return "-"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function Section({
  title,
  open,
  onToggle,
  children
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/30"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span>{title}</span>
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  )
}

interface KnowledgebasePluginCardProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function KnowledgebasePluginCard({
  collapsed,
  onToggleCollapsed
}: KnowledgebasePluginCardProps): React.JSX.Element {
  const { t } = useLanguage()
  const [setupOpen, setSetupOpen] = useState(true)
  const [envOpen, setEnvOpen] = useState(true)
  const [contentsOpen, setContentsOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [contentTab, setContentTab] = useState<"collections" | "documents" | "chunks" | "upload">(
    "collections"
  )
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [uploadCollectionId, setUploadCollectionId] = useState<string>("")
  const [uploadCreationFeedback, setUploadCreationFeedback] = useState<{
    kind: "success" | "error"
    message: string
  } | null>(null)
  const [draft, setDraft] = useState<Partial<KnowledgebaseConfig>>({})
  const {
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
  } = useKnowledgebasePlugin()

  useEffect(() => {
    if (contentsOpen && runtime?.ready && collections.length === 0) {
      void loadCollections()
    }
  }, [collections.length, contentsOpen, loadCollections, runtime?.ready])

  useEffect(() => {
    if (collections.length === 0) {
      setUploadCollectionId("")
      return
    }
    if (!uploadCollectionId || !collections.some((item) => item.id === uploadCollectionId)) {
      setUploadCollectionId(collections[0].id)
    }
  }, [collections, uploadCollectionId])

  useEffect(() => {
    if (!selectedCollectionId) return
    if (!collections.some((item) => item.id === selectedCollectionId)) {
      const fallbackCollectionId = collections[0]?.id ?? null
      setSelectedCollectionId(fallbackCollectionId)
      setSelectedDocumentId(null)
      if (fallbackCollectionId) {
        void loadDocuments(fallbackCollectionId)
      }
    }
  }, [collections, loadDocuments, selectedCollectionId])

  const form = useMemo(() => {
    if (!runtime) return null
    return {
      ...runtime.config,
      ...draft,
      ollama: {
        ...runtime.config.ollama,
        ...(draft.ollama ?? {})
      },
      openCompat: {
        ...runtime.config.openCompat,
        ...(draft.openCompat ?? {})
      }
    }
  }, [draft, runtime])

  const runtimeStatusKey = useMemo(() => {
    if (!runtime) return "plugin.knowledgebase.status.unknown"
    if (runtime.ready) return "plugin.knowledgebase.status.ready"
    if (runtime.running) return "plugin.knowledgebase.status.running"
    return "plugin.knowledgebase.status.stopped"
  }, [runtime])

  const selectedDocuments = selectedCollectionId
    ? (documentsByCollection[selectedCollectionId]?.documents ?? [])
    : []
  const selectedChunks = selectedDocumentId
    ? (chunksByDocument[selectedDocumentId]?.chunks ?? [])
    : []
  const activeCollectionSet = new Set(runtime?.config.activeCollectionIds ?? [])
  const yesOrNo = (value?: boolean): string =>
    value ? t("plugin.knowledgebase.yes") : t("plugin.knowledgebase.no")

  useEffect(() => {
    if (!selectedDocumentId) return
    if (!selectedDocuments.some((item) => item.id === selectedDocumentId)) {
      setSelectedDocumentId(null)
    }
  }, [selectedDocumentId, selectedDocuments])

  if (loading && !runtime) {
    return (
      <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (!plugin || !runtime || !form) {
    return (
      <div className="rounded-lg border border-border p-4 text-xs text-status-critical">
        {t("plugin.knowledgebase.unavailable")}
      </div>
    )
  }

  const canEditConfig = !runtime.running

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 px-5 py-3.5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {collapsed ? (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-[15px] font-semibold">{t("plugin.knowledgebase.name")}</span>
        </button>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={runtime.enabled}
            onChange={(event) => void toggleEnabled(event.target.checked)}
            disabled={!!busy["toggle"]}
          />
          {t("plugin.knowledgebase.enabled")}
        </label>
      </div>
      {!collapsed && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          <div className="space-y-1">
            <div className="text-[13px] text-muted-foreground">
              {t("plugin.knowledgebase.description")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t("plugin.knowledgebase.setup_hint")}
            </div>
          </div>

          <div className="rounded-md border border-border p-3 text-[13px] space-y-1">
            <div>
              {t("plugin.knowledgebase.status")}:{" "}
              <span className={cn(runtime.ready ? "text-status-nominal" : "text-muted-foreground")}>
                {t(runtimeStatusKey)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {t("plugin.knowledgebase.checked_at")}: {formatTime(runtime.checkedAt)}
            </div>
            <div className="text-muted-foreground break-all">
              {t("plugin.knowledgebase.base_url")}: {runtime.baseUrl ?? "-"}
            </div>
            <div className="text-muted-foreground break-all">
              {t("plugin.knowledgebase.token")}: {runtime.token ?? "-"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void startDaemon()}
              disabled={!!busy["start"] || !runtime.enabled}
            >
              {t("plugin.knowledgebase.start")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void stopDaemon()}
              disabled={!!busy["stop"]}
            >
              {t("plugin.knowledgebase.stop")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshStatus()}
              disabled={!!busy["refresh"]}
            >
              {t("plugin.knowledgebase.refresh")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void openDataDir()}
              disabled={!!busy["openDataDir"]}
            >
              {t("plugin.knowledgebase.open_data_dir")}
            </Button>
          </div>

          <Section
            title={t("plugin.knowledgebase.section.setup")}
            open={setupOpen}
            onToggle={() => setSetupOpen((prev) => !prev)}
          >
            <div className="space-y-3 text-[13px]">
              <div className="space-y-1">
                <div className="text-muted-foreground">
                  {t("plugin.knowledgebase.daemon_executable")}
                </div>
                <div className="font-mono text-[12px] break-all">{form.daemonExePath || "-"}</div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void pickExe()}
                    disabled={!!busy["pickExe"]}
                  >
                    {t("plugin.knowledgebase.select_executable")}
                  </Button>
                  <span
                    className={cn(
                      "text-[11px]",
                      runtime.daemonExeExists ? "text-status-nominal" : "text-status-critical"
                    )}
                  >
                    {runtime.daemonExeExists
                      ? t("plugin.knowledgebase.detected")
                      : t("plugin.knowledgebase.missing")}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">
                  {t("plugin.knowledgebase.data_directory")}
                </div>
                <div className="font-mono text-[12px] break-all">
                  {form.dataDir || storage?.dataDir || "-"}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void pickDataDir()}
                    disabled={!!busy["pickDataDir"] || !canEditConfig}
                  >
                    {t("plugin.knowledgebase.select_data_dir")}
                  </Button>
                  <span
                    className={cn(
                      "text-[11px]",
                      runtime.dataDirExists ? "text-status-nominal" : "text-muted-foreground"
                    )}
                  >
                    {runtime.dataDirExists
                      ? t("plugin.knowledgebase.exists")
                      : t("plugin.knowledgebase.will_create_on_start")}
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title={t("plugin.knowledgebase.section.environment")}
            open={envOpen}
            onToggle={() => setEnvOpen((prev) => !prev)}
          >
            <div className="space-y-3 text-[13px]">
              {!canEditConfig && (
                <div className="text-[12px] text-muted-foreground">
                  {t("plugin.knowledgebase.stop_before_editing")}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.llm_provider")}
                  </div>
                  <select
                    value={form.llmProvider}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        llmProvider: event.target.value as KnowledgebaseProvider
                      }))
                    }
                    className="w-full rounded-md border border-border bg-transparent px-2 py-1.5"
                  >
                    <option value="ollama">{t("plugin.knowledgebase.provider.ollama")}</option>
                    <option value="open_compat">
                      {t("plugin.knowledgebase.provider.open_compat")}
                    </option>
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.embedding_provider")}
                  </div>
                  <select
                    value={form.embeddingProvider}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        embeddingProvider: event.target.value as KnowledgebaseProvider
                      }))
                    }
                    className="w-full rounded-md border border-border bg-transparent px-2 py-1.5"
                  >
                    <option value="ollama">{t("plugin.knowledgebase.provider.ollama")}</option>
                    <option value="open_compat">
                      {t("plugin.knowledgebase.provider.open_compat")}
                    </option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.ollama.base_url")}
                  </div>
                  <Input
                    value={form.ollama.baseUrl}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        ollama: {
                          ...form.ollama,
                          ...prev.ollama,
                          baseUrl: event.target.value
                        }
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.ollama.llm_model")}
                  </div>
                  <Input
                    value={form.ollama.llmModel}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        ollama: {
                          ...form.ollama,
                          ...prev.ollama,
                          llmModel: event.target.value
                        }
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.ollama.embed_model")}
                  </div>
                  <Input
                    value={form.ollama.embedModel}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        ollama: {
                          ...form.ollama,
                          ...prev.ollama,
                          embedModel: event.target.value
                        }
                      }))
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.open_compat.base_url")}
                  </div>
                  <Input
                    value={form.openCompat.baseUrl}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        openCompat: {
                          ...form.openCompat,
                          ...prev.openCompat,
                          baseUrl: event.target.value
                        }
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.open_compat.api_key")}
                  </div>
                  <Input
                    type="password"
                    value={form.openCompat.apiKey}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        openCompat: {
                          ...form.openCompat,
                          ...prev.openCompat,
                          apiKey: event.target.value
                        }
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.open_compat.llm_model")}
                  </div>
                  <Input
                    value={form.openCompat.llmModel}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        openCompat: {
                          ...form.openCompat,
                          ...prev.openCompat,
                          llmModel: event.target.value
                        }
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.open_compat.embed_model")}
                  </div>
                  <Input
                    value={form.openCompat.embedModel}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        openCompat: {
                          ...form.openCompat,
                          ...prev.openCompat,
                          embedModel: event.target.value
                        }
                      }))
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.retrieve_top_k")}
                  </div>
                  <Input
                    type="number"
                    value={String(form.retrieveTopK)}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        retrieveTopK: Number(event.target.value) || form.retrieveTopK
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.chunk_size")}
                  </div>
                  <Input
                    type="number"
                    value={String(form.chunkSize)}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        chunkSize: Number(event.target.value) || form.chunkSize
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-muted-foreground">
                    {t("plugin.knowledgebase.chunk_overlap")}
                  </div>
                  <Input
                    type="number"
                    value={String(form.chunkOverlap)}
                    disabled={!canEditConfig}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        chunkOverlap: Number(event.target.value) || form.chunkOverlap
                      }))
                    }
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!canEditConfig || !!busy["saveConfig"]}
                  onClick={() =>
                    void updateConfig({
                      llmProvider: form.llmProvider,
                      embeddingProvider: form.embeddingProvider,
                      ollama: form.ollama,
                      openCompat: form.openCompat,
                      retrieveTopK: form.retrieveTopK,
                      chunkSize: form.chunkSize,
                      chunkOverlap: form.chunkOverlap
                    })
                  }
                >
                  {t("plugin.knowledgebase.save_environment")}
                </Button>
              </div>
            </div>
          </Section>

          <Section
            title={t("plugin.knowledgebase.section.data_contents")}
            open={contentsOpen}
            onToggle={() => setContentsOpen((prev) => !prev)}
          >
            {!runtime.ready ? (
              <div className="text-[12px] text-muted-foreground">
                {t("plugin.knowledgebase.start_before_browsing")}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border border-border p-3 text-[12px] space-y-1">
                  <div className="font-medium">{t("plugin.knowledgebase.storage")}</div>
                  <div className="text-muted-foreground break-all">
                    {t("plugin.knowledgebase.storage.sqlite")}: {yesOrNo(storage?.sqlite.exists)} (
                    {formatSize(storage?.sqlite.sizeBytes)})
                  </div>
                  <div className="text-muted-foreground break-all">
                    {t("plugin.knowledgebase.storage.chroma")}: {yesOrNo(storage?.chromaDir.exists)} (
                    {formatSize(storage?.chromaDir.sizeBytes)})
                  </div>
                  <div className="text-muted-foreground break-all">
                    {t("plugin.knowledgebase.storage.blobs")}: {yesOrNo(storage?.blobsDir.exists)} (
                    {formatSize(storage?.blobsDir.sizeBytes)})
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void loadStorage()}>
                    {t("plugin.knowledgebase.refresh_storage")}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    ["collections", "documents", "chunks", "upload"] as Array<
                      "collections" | "documents" | "chunks" | "upload"
                    >
                  ).map((tabKey) => (
                    <Button
                      key={tabKey}
                      size="sm"
                      variant={contentTab === tabKey ? "secondary" : "ghost"}
                      onClick={() => setContentTab(tabKey)}
                    >
                      {t(`plugin.knowledgebase.tab.${tabKey}`)}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => void loadCollections()}>
                    {t("plugin.knowledgebase.reload")}
                  </Button>
                </div>

                {contentTab === "collections" && (
                  <div className="rounded-md border border-border p-3 space-y-2">
                    <div className="text-sm font-medium">{t("plugin.knowledgebase.collections")}</div>
                    <div className="max-h-[360px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground text-left">
                          <tr>
                            <th className="pb-2 pr-3">{t("plugin.knowledgebase.active_for_query")}</th>
                            <th className="pb-2 pr-3">{t("plugin.knowledgebase.name_label")}</th>
                            <th className="pb-2 pr-3">{t("plugin.knowledgebase.id_label")}</th>
                            <th className="pb-2">{t("plugin.knowledgebase.created_label")}</th>
                            <th className="pb-2 text-right">{t("plugin.knowledgebase.delete_collection")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {collections.map((collection) => (
                            <tr
                              key={collection.id}
                              className={cn(
                                "border-t border-border/70 cursor-pointer hover:bg-muted/40",
                                selectedCollectionId === collection.id && "bg-muted/40"
                              )}
                              onClick={() => {
                                setSelectedCollectionId(collection.id)
                                setUploadCollectionId(collection.id)
                                setContentTab("documents")
                                void loadDocuments(collection.id)
                              }}
                            >
                              <td className="py-2 pr-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={activeCollectionSet.has(collection.id)}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    const next = new Set(runtime.config.activeCollectionIds ?? [])
                                    if (event.target.checked) {
                                      next.add(collection.id)
                                    } else {
                                      next.delete(collection.id)
                                    }
                                    void setActiveCollections(Array.from(next))
                                  }}
                                />
                              </td>
                              <td className="py-2 pr-3 align-top">{collection.name}</td>
                              <td className="py-2 pr-3 align-top font-mono break-all">{collection.id}</td>
                              <td className="py-2 align-top">{formatTime(collection.created_at)}</td>
                              <td className="py-2 text-right align-top">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-status-critical"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    if (!window.confirm(t("plugin.knowledgebase.delete_collection_confirm"))) {
                                      return
                                    }
                                    void deleteCollection(collection.id)
                                  }}
                                  disabled={!!busy[`deleteCollection:${collection.id}`]}
                                >
                                  {busy[`deleteCollection:${collection.id}`]
                                    ? t("plugin.knowledgebase.delete_collection_running")
                                    : t("plugin.knowledgebase.delete_collection")}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {collections.length === 0 && (
                        <div className="text-sm text-muted-foreground">{t("plugin.knowledgebase.empty_collections")}</div>
                      )}
                    </div>
                  </div>
                )}

                {contentTab === "documents" && (
                  <div className="rounded-md border border-border p-3 space-y-2">
                    <div className="text-sm font-medium">{t("plugin.knowledgebase.documents")}</div>
                    {!selectedCollectionId ? (
                      <div className="text-sm text-muted-foreground">
                        {t("plugin.knowledgebase.select_collection_first")}
                      </div>
                    ) : (
                      <div className="max-h-[360px] overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="text-muted-foreground text-left">
                            <tr>
                              <th className="pb-2 pr-3">{t("plugin.knowledgebase.filename_label")}</th>
                              <th className="pb-2 pr-3">{t("plugin.knowledgebase.id_label")}</th>
                              <th className="pb-2 pr-3">{t("plugin.knowledgebase.mime_label")}</th>
                              <th className="pb-2">{t("plugin.knowledgebase.created_label")}</th>
                              <th className="pb-2 text-right">{t("plugin.knowledgebase.delete_document")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDocuments.map((document) => (
                              <tr
                                key={document.id}
                                className={cn(
                                  "border-t border-border/70 cursor-pointer hover:bg-muted/40",
                                  selectedDocumentId === document.id && "bg-muted/40"
                                )}
                                onClick={() => {
                                  setSelectedDocumentId(document.id)
                                  setContentTab("chunks")
                                  void loadChunks(document.id)
                                }}
                              >
                                <td className="py-2 pr-3 align-top">{document.filename}</td>
                                <td className="py-2 pr-3 align-top font-mono break-all">{document.id}</td>
                                <td className="py-2 pr-3 align-top">{document.mime || "-"}</td>
                                <td className="py-2 align-top">{formatTime(document.created_at)}</td>
                                <td className="py-2 text-right align-top">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-status-critical"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      if (!window.confirm(t("plugin.knowledgebase.delete_document_confirm"))) {
                                        return
                                      }
                                      void deleteDocument(document.id)
                                    }}
                                    disabled={!!busy[`deleteDocument:${document.id}`]}
                                  >
                                    {busy[`deleteDocument:${document.id}`]
                                      ? t("plugin.knowledgebase.delete_document_running")
                                      : t("plugin.knowledgebase.delete_document")}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {selectedDocuments.length === 0 && (
                          <div className="text-sm text-muted-foreground">
                            {t("plugin.knowledgebase.empty_documents")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {contentTab === "chunks" && (
                  <div className="rounded-md border border-border p-3 space-y-2">
                    <div className="text-sm font-medium">{t("plugin.knowledgebase.chunks")}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("plugin.knowledgebase.chunk_delete_not_supported")}
                    </div>
                    {!selectedDocumentId ? (
                      <div className="text-sm text-muted-foreground">
                        {t("plugin.knowledgebase.select_document_first")}
                      </div>
                    ) : (
                      <div className="max-h-[360px] overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="text-muted-foreground text-left">
                            <tr>
                              <th className="pb-2 pr-3">#</th>
                              <th className="pb-2 pr-3">{t("plugin.knowledgebase.id_label")}</th>
                              <th className="pb-2">{t("plugin.knowledgebase.text_label")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedChunks.map((chunk) => (
                              <tr key={chunk.id} className="border-t border-border/70 align-top">
                                <td className="py-2 pr-3 align-top">{chunk.index}</td>
                                <td className="py-2 pr-3 align-top font-mono break-all">{chunk.id}</td>
                                <td className="py-2 whitespace-pre-wrap">{chunk.text}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {selectedChunks.length === 0 && (
                          <div className="text-sm text-muted-foreground">{t("plugin.knowledgebase.empty_chunks")}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {contentTab === "upload" && (
                  <div className="rounded-md border border-border p-3 space-y-3">
                    <div className="text-sm font-medium">{t("plugin.knowledgebase.upload_title")}</div>
                    {collections.length === 0 ? (
                      <div className="rounded border border-border p-3 space-y-3">
                        <div className="text-sm text-muted-foreground">
                          {t("plugin.knowledgebase.upload_empty_collections_hint")}
                        </div>
                        <Button
                          size="sm"
                          onClick={async () => {
                            setUploadCreationFeedback(null)
                            const created = await createDefaultCollection()
                            if (created) {
                              setUploadCollectionId(created.id)
                              setUploadCreationFeedback({
                                kind: "success",
                                message: t("plugin.knowledgebase.create_default_collection_success")
                              })
                              return
                            }
                            setUploadCreationFeedback({
                              kind: "error",
                              message: t("plugin.knowledgebase.create_default_collection_failed")
                            })
                          }}
                          disabled={!!busy["createDefaultCollection"]}
                        >
                          {t("plugin.knowledgebase.create_default_collection")}
                        </Button>
                        {uploadCreationFeedback && (
                          <div
                            className={cn(
                              "text-xs",
                              uploadCreationFeedback.kind === "success"
                                ? "text-status-nominal"
                                : "text-status-critical"
                            )}
                          >
                            {uploadCreationFeedback.message}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                        <label className="space-y-1">
                          <div className="text-muted-foreground text-xs">
                            {t("plugin.knowledgebase.upload_collection")}
                          </div>
                          <select
                            value={uploadCollectionId}
                            onChange={(event) => setUploadCollectionId(event.target.value)}
                            className="w-full rounded-md border border-border bg-transparent px-2 py-1.5"
                          >
                            <option value="">
                              {t("plugin.knowledgebase.upload_collection_placeholder")}
                            </option>
                            {collections.map((collection) => (
                              <option key={collection.id} value={collection.id}>
                                {collection.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void pickUploadFiles()}
                          disabled={!!busy["pickUploadFiles"]}
                        >
                          {t("plugin.knowledgebase.upload_pick_files")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearUploadFiles}
                          disabled={uploadFilePaths.length === 0}
                        >
                          {t("plugin.knowledgebase.upload_clear_files")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            void uploadDocuments({
                              collectionId: uploadCollectionId,
                              options: {
                                chunkSize: runtime.config.chunkSize,
                                chunkOverlap: runtime.config.chunkOverlap
                              }
                            })
                          }
                          disabled={
                            !!busy["uploadDocuments"] ||
                            uploadFilePaths.length === 0 ||
                            !uploadCollectionId
                          }
                        >
                          {busy["uploadDocuments"]
                            ? t("plugin.knowledgebase.upload_submitting")
                            : t("plugin.knowledgebase.upload_submit")}
                        </Button>
                      </div>
                    )}

                    <div className="max-h-[180px] overflow-auto rounded border border-border">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground text-left">
                          <tr>
                            <th className="px-2 py-1.5">{t("plugin.knowledgebase.upload_file")}</th>
                            <th className="px-2 py-1.5">{t("plugin.knowledgebase.upload_path")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadFilePaths.map((filePath) => (
                            <tr key={filePath} className="border-t border-border/70">
                              <td className="px-2 py-1.5">{filePath.split(/[/\\]/).pop()}</td>
                              <td className="px-2 py-1.5 font-mono break-all">{filePath}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {uploadFilePaths.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground">
                          {t("plugin.knowledgebase.upload_no_files")}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{t("plugin.knowledgebase.upload_results")}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearUploadResults}
                          disabled={uploadResults.length === 0}
                        >
                          {t("plugin.knowledgebase.upload_clear_results")}
                        </Button>
                      </div>
                      <div className="max-h-[220px] overflow-auto rounded border border-border">
                        <table className="w-full text-sm">
                          <thead className="text-muted-foreground text-left">
                            <tr>
                              <th className="px-2 py-1.5">{t("plugin.knowledgebase.upload_file")}</th>
                              <th className="px-2 py-1.5">{t("plugin.knowledgebase.upload_status")}</th>
                              <th className="px-2 py-1.5">{t("plugin.knowledgebase.upload_job")}</th>
                              <th className="px-2 py-1.5">{t("plugin.knowledgebase.upload_error")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uploadResults.map((result) => (
                              <tr key={`${result.filePath}:${result.jobId ?? "no-job"}`} className="border-t border-border/70">
                                <td className="px-2 py-1.5">{result.fileName}</td>
                                <td className="px-2 py-1.5">{result.status}</td>
                                <td className="px-2 py-1.5 font-mono break-all">{result.jobId ?? "-"}</td>
                                <td className="px-2 py-1.5 text-status-critical break-all">
                                  {result.error ?? "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {uploadResults.length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground">
                            {t("plugin.knowledgebase.upload_no_results")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {runtime.config.activeCollectionIds.length === 0 && (
                  <div className="rounded border border-border p-2 text-xs text-muted-foreground">
                    {t("plugin.knowledgebase.active_collections_hint")}
                  </div>
                )}
                {staleCollectionsPruned && (
                  <div className="rounded border border-border p-2 text-xs text-muted-foreground">
                    {t("plugin.knowledgebase.stale_collections_pruned")}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section
            title={t("plugin.knowledgebase.section.logs_milestones")}
            open={logsOpen}
            onToggle={() => setLogsOpen((prev) => !prev)}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-md border border-border p-3">
                <div className="text-[12px] text-muted-foreground mb-2">
                  {t("plugin.knowledgebase.milestones")}
                </div>
                <div className="max-h-40 overflow-auto space-y-1 text-[12px]">
                  {runtime.milestones.length === 0 ? (
                    <div className="text-muted-foreground">
                      {t("plugin.knowledgebase.empty_milestones")}
                    </div>
                  ) : (
                    runtime.milestones
                      .slice()
                      .reverse()
                      .map((item) => (
                        <div key={item.id}>
                          <span
                            className={cn(item.ok ? "text-status-nominal" : "text-status-critical")}
                          >
                            [{formatTime(item.at)}]
                          </span>{" "}
                          {item.message}
                        </div>
                      ))
                  )}
                </div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-[12px] text-muted-foreground mb-2">
                  {t("plugin.knowledgebase.logs")}
                </div>
                <div className="max-h-40 overflow-auto text-[12px]">
                  {runtime.logs.length === 0 ? (
                    <div className="text-muted-foreground">
                      {t("plugin.knowledgebase.empty_logs")}
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words">
                      {runtime.logs
                        .map((entry) => `[${formatTime(entry.at)}][${entry.source}] ${entry.line}`)
                        .join("\n")}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {(runtime.lastError || error) && (
            <div className="rounded-md border border-border p-3 text-[13px] text-status-critical break-all">
              {runtime.lastError || error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
