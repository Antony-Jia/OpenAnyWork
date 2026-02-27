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

export function KnowledgebasePluginCard(): React.JSX.Element {
  const { t } = useLanguage()
  const [setupOpen, setSetupOpen] = useState(true)
  const [envOpen, setEnvOpen] = useState(true)
  const [contentsOpen, setContentsOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<KnowledgebaseConfig>>({})
  const {
    plugin,
    runtime,
    storage,
    collections,
    documentsByCollection,
    chunksByDocument,
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
    loadChunks
  } = useKnowledgebasePlugin()

  useEffect(() => {
    if (contentsOpen && runtime?.ready && collections.length === 0) {
      void loadCollections()
    }
  }, [collections.length, contentsOpen, loadCollections, runtime?.ready])

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

  const runtimeStatus = useMemo(() => {
    if (!runtime) return "Unknown"
    if (runtime.ready) return "Ready"
    if (runtime.running) return "Running"
    return "Stopped"
  }, [runtime])

  const selectedDocuments = selectedCollectionId
    ? (documentsByCollection[selectedCollectionId]?.documents ?? [])
    : []
  const selectedChunks = selectedDocumentId
    ? (chunksByDocument[selectedDocumentId]?.chunks ?? [])
    : []

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
        Knowledge Base plugin is unavailable.
      </div>
    )
  }

  const canEditConfig = !runtime.running

  return (
    <div className="rounded-lg border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[15px] font-semibold">{plugin.name}</div>
          <div className="text-[13px] text-muted-foreground">{plugin.description}</div>
          <div className="text-[11px] text-muted-foreground">
            Configure daemon executable and env, then start to inspect collections/documents/chunks.
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={runtime.enabled}
            onChange={(event) => void toggleEnabled(event.target.checked)}
            disabled={!!busy["toggle"]}
          />
          Enabled
        </label>
      </div>

      <div className="rounded-md border border-border p-3 text-[13px] space-y-1">
        <div>
          Status:{" "}
          <span className={cn(runtime.ready ? "text-status-nominal" : "text-muted-foreground")}>
            {runtimeStatus}
          </span>
        </div>
        <div className="text-muted-foreground">Checked: {formatTime(runtime.checkedAt)}</div>
        <div className="text-muted-foreground break-all">Base URL: {runtime.baseUrl ?? "-"}</div>
        <div className="text-muted-foreground break-all">Token: {runtime.token ?? "-"}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => void startDaemon()}
          disabled={!!busy["start"] || !runtime.enabled}
        >
          Start
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void stopDaemon()}
          disabled={!!busy["stop"]}
        >
          Stop
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refreshStatus()}
          disabled={!!busy["refresh"]}
        >
          Refresh
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void openDataDir()}
          disabled={!!busy["openDataDir"]}
        >
          Open Data Dir
        </Button>
      </div>

      <Section title="Setup" open={setupOpen} onToggle={() => setSetupOpen((prev) => !prev)}>
        <div className="space-y-3 text-[13px]">
          <div className="space-y-1">
            <div className="text-muted-foreground">Daemon executable</div>
            <div className="font-mono text-[12px] break-all">{form.daemonExePath || "-"}</div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void pickExe()}
                disabled={!!busy["pickExe"]}
              >
                Select Executable
              </Button>
              <span
                className={cn(
                  "text-[11px]",
                  runtime.daemonExeExists ? "text-status-nominal" : "text-status-critical"
                )}
              >
                {runtime.daemonExeExists ? "Detected" : "Missing"}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Data directory</div>
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
                Select Data Dir
              </Button>
              <span
                className={cn(
                  "text-[11px]",
                  runtime.dataDirExists ? "text-status-nominal" : "text-muted-foreground"
                )}
              >
                {runtime.dataDirExists ? "Exists" : "Will be created on start"}
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Environment" open={envOpen} onToggle={() => setEnvOpen((prev) => !prev)}>
        <div className="space-y-3 text-[13px]">
          {!canEditConfig && (
            <div className="text-[12px] text-muted-foreground">
              Stop daemon before editing configuration values.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <div className="text-muted-foreground">LLM Provider</div>
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
                <option value="ollama">ollama</option>
                <option value="open_compat">open_compat</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="text-muted-foreground">Embedding Provider</div>
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
                <option value="ollama">ollama</option>
                <option value="open_compat">open_compat</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <div className="text-muted-foreground">Ollama Base URL</div>
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
              <div className="text-muted-foreground">Ollama LLM Model</div>
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
              <div className="text-muted-foreground">Ollama Embed Model</div>
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
              <div className="text-muted-foreground">OpenCompat Base URL</div>
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
              <div className="text-muted-foreground">OpenCompat API Key</div>
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
              <div className="text-muted-foreground">OpenCompat LLM Model</div>
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
              <div className="text-muted-foreground">OpenCompat Embed Model</div>
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
              <div className="text-muted-foreground">Retrieve Top K</div>
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
              <div className="text-muted-foreground">Chunk Size</div>
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
              <div className="text-muted-foreground">Chunk Overlap</div>
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
              Save Environment
            </Button>
          </div>
        </div>
      </Section>

      <Section
        title="Data Contents"
        open={contentsOpen}
        onToggle={() => setContentsOpen((prev) => !prev)}
      >
        {!runtime.ready ? (
          <div className="text-[12px] text-muted-foreground">
            Start daemon successfully before expanding collections/documents/chunks.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 text-[12px] space-y-1">
              <div className="font-medium">Storage</div>
              <div className="text-muted-foreground break-all">
                sqlite: {storage?.sqlite.exists ? "yes" : "no"} (
                {formatSize(storage?.sqlite.sizeBytes)})
              </div>
              <div className="text-muted-foreground break-all">
                chroma: {storage?.chromaDir.exists ? "yes" : "no"} (
                {formatSize(storage?.chromaDir.sizeBytes)})
              </div>
              <div className="text-muted-foreground break-all">
                blobs: {storage?.blobsDir.exists ? "yes" : "no"} (
                {formatSize(storage?.blobsDir.sizeBytes)})
              </div>
              <Button variant="ghost" size="sm" onClick={() => void loadStorage()}>
                Refresh Storage
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-muted-foreground">Collections</div>
                  <Button variant="ghost" size="sm" onClick={() => void loadCollections()}>
                    Reload
                  </Button>
                </div>
                <div className="max-h-52 overflow-auto space-y-1">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => {
                        setSelectedCollectionId(collection.id)
                        void loadDocuments(collection.id)
                      }}
                      className={cn(
                        "w-full rounded border border-border px-2 py-1 text-left text-[12px]",
                        selectedCollectionId === collection.id && "bg-muted/40"
                      )}
                    >
                      <div className="font-medium">{collection.name}</div>
                      <div className="text-muted-foreground break-all">{collection.id}</div>
                    </button>
                  ))}
                  {collections.length === 0 && (
                    <div className="text-[12px] text-muted-foreground">No collections.</div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="text-[12px] text-muted-foreground">Documents</div>
                <div className="max-h-52 overflow-auto space-y-1">
                  {selectedDocuments.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => {
                        setSelectedDocumentId(document.id)
                        void loadChunks(document.id)
                      }}
                      className={cn(
                        "w-full rounded border border-border px-2 py-1 text-left text-[12px]",
                        selectedDocumentId === document.id && "bg-muted/40"
                      )}
                    >
                      <div className="font-medium">{document.filename}</div>
                      <div className="text-muted-foreground break-all">{document.id}</div>
                    </button>
                  ))}
                  {!selectedCollectionId && (
                    <div className="text-[12px] text-muted-foreground">
                      Select a collection first.
                    </div>
                  )}
                  {selectedCollectionId && selectedDocuments.length === 0 && (
                    <div className="text-[12px] text-muted-foreground">No documents.</div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="text-[12px] text-muted-foreground">Chunks</div>
                <div className="max-h-52 overflow-auto space-y-1">
                  {selectedChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="rounded border border-border px-2 py-1 text-[12px]"
                    >
                      <div className="text-muted-foreground">#{chunk.index}</div>
                      <div className="line-clamp-3 whitespace-pre-wrap">{chunk.text}</div>
                    </div>
                  ))}
                  {!selectedDocumentId && (
                    <div className="text-[12px] text-muted-foreground">
                      Select a document first.
                    </div>
                  )}
                  {selectedDocumentId && selectedChunks.length === 0 && (
                    <div className="text-[12px] text-muted-foreground">No chunks.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Logs & Milestones"
        open={logsOpen}
        onToggle={() => setLogsOpen((prev) => !prev)}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3">
            <div className="text-[12px] text-muted-foreground mb-2">Milestones</div>
            <div className="max-h-40 overflow-auto space-y-1 text-[12px]">
              {runtime.milestones.length === 0 ? (
                <div className="text-muted-foreground">No milestones.</div>
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
            <div className="text-[12px] text-muted-foreground mb-2">Logs</div>
            <div className="max-h-40 overflow-auto text-[12px]">
              {runtime.logs.length === 0 ? (
                <div className="text-muted-foreground">No logs.</div>
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
  )
}
