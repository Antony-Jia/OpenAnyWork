import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import type { CapabilityScope, ToolInfo } from "@/types"
import type { PresetPluginItem } from "@/plugins/types"

function isToolEnabledInScope(tool: ToolInfo, scope: CapabilityScope): boolean {
  return scope === "butler"
    ? (tool.enabledButler ?? tool.enabled)
    : (tool.enabledClassic ?? tool.enabled)
}

export function ToolsManager(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"native" | "plugin">("native")
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [plugins, setPlugins] = useState<PresetPluginItem[]>([])
  const [pluginGroupsExpanded, setPluginGroupsExpanded] = useState<Record<string, boolean>>({})
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const { t } = useLanguage()

  const loadTools = useCallback(async () => {
    try {
      if (!window.api?.tools?.list) {
        setError(t("tools.load_failed"))
        return
      }
      const [items, pluginItems] = await Promise.all([
        window.api.tools.list(),
        window.api.plugins.list()
      ])
      setTools(items)
      setPlugins(pluginItems)
    } catch (e) {
      const message = e instanceof Error ? e.message : t("tools.load_failed")
      setError(message)
    }
  }, [t])

  useEffect(() => {
    if (!open) return
    loadTools()
  }, [open, loadTools])

  const resetState = (): void => {
    setActiveTab("native")
    setPluginGroupsExpanded({})
    setKeyInputs({})
    setShowKeys({})
    setSaving({})
    setToggling({})
    setError(null)
  }

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      resetState()
    }
    setOpen(next)
  }

  const handleSave = async (tool: ToolInfo, clear = false): Promise<void> => {
    setError(null)
    setSaving((prev) => ({ ...prev, [tool.name]: true }))

    try {
      if (!window.api?.tools?.setKey) {
        setError(t("tools.save_failed"))
        return
      }
      const raw = clear ? "" : keyInputs[tool.name] || ""
      const trimmed = raw.trim()
      await window.api.tools.setKey({ name: tool.name, key: trimmed ? trimmed : null })
      setKeyInputs((prev) => ({ ...prev, [tool.name]: "" }))
      await loadTools()
    } catch (e) {
      const message = e instanceof Error ? e.message : t("tools.save_failed")
      setError(message)
    } finally {
      setSaving((prev) => ({ ...prev, [tool.name]: false }))
    }
  }

  const handleToggle = async (tool: ToolInfo, scope: CapabilityScope): Promise<void> => {
    setError(null)
    const toggleKey = `${tool.name}:${scope}`
    setToggling((prev) => ({ ...prev, [toggleKey]: true }))

    try {
      if (!window.api?.tools?.setEnabledScope) {
        setError(t("tools.save_failed"))
        return
      }
      await window.api.tools.setEnabledScope({
        name: tool.name,
        scope,
        enabled: !isToolEnabledInScope(tool, scope)
      })
      await loadTools()
    } catch (e) {
      const message = e instanceof Error ? e.message : t("tools.save_failed")
      setError(message)
    } finally {
      setToggling((prev) => ({ ...prev, [toggleKey]: false }))
    }
  }

  const handleKeyChange = (toolName: string, value: string): void => {
    setKeyInputs((prev) => ({ ...prev, [toolName]: value }))
  }

  const toggleShowKey = (toolName: string): void => {
    setShowKeys((prev) => ({ ...prev, [toolName]: !prev[toolName] }))
  }

  const nativeTools = useMemo(
    () => tools.filter((tool) => (tool.kind ?? "native") === "native"),
    [tools]
  )
  const pluginTools = useMemo(
    () => tools.filter((tool) => (tool.kind ?? "native") === "plugin"),
    [tools]
  )
  const visibleTools = activeTab === "native" ? nativeTools : pluginTools

  const pluginById = useMemo(() => {
    return new Map(plugins.map((plugin) => [plugin.id, plugin]))
  }, [plugins])

  const pluginToolGroups = useMemo(() => {
    const groups = new Map<string, ToolInfo[]>()
    for (const tool of pluginTools) {
      const key = tool.pluginId || "__unknown__"
      const group = groups.get(key) ?? []
      group.push(tool)
      groups.set(key, group)
    }
    return Array.from(groups.entries())
  }, [pluginTools])

  useEffect(() => {
    if (pluginToolGroups.length === 0) return
    setPluginGroupsExpanded((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [groupId] of pluginToolGroups) {
        if (next[groupId] === undefined) {
          next[groupId] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [pluginToolGroups])

  const renderToolCard = (tool: ToolInfo): React.JSX.Element => (
    <div
      key={tool.name}
      className={cn("rounded-lg border border-border p-3 space-y-3", !tool.available && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">{tool.label}</div>
          <div className="text-xs text-muted-foreground">{tool.description}</div>
          <div className="text-[10px] text-muted-foreground font-mono">{tool.name}</div>
          {tool.envVar && (
            <div className="text-[10px] text-muted-foreground">
              {t("tools.env_var")}: {tool.envVar}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            {(["classic", "butler"] as const).map((scope) => {
              const enabled = isToolEnabledInScope(tool, scope)
              const toggleKey = `${tool.name}:${scope}`
              return (
                <button
                  key={scope}
                  type="button"
                  disabled={toggling[toggleKey] || !tool.available}
                  onClick={() => void handleToggle(tool, scope)}
                  className={cn(
                    "text-[10px] uppercase tracking-[0.12em] transition-colors",
                    enabled ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(`scope.${scope}`)}: {enabled ? t("tools.enabled") : t("tools.disabled")}
                </button>
              )
            })}
          </div>
          <span
            className={cn(
              "text-[10px] uppercase tracking-[0.2em]",
              tool.hasKey ? "text-status-success" : "text-muted-foreground"
            )}
          >
            {tool.hasKey ? t("tools.status_configured") : t("tools.status_missing")}
          </span>
        </div>
      </div>

      {tool.requiresKey !== false && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">{tool.keyLabel || t("tools.key")}</label>
          <div className="relative">
            <Input
              type={showKeys[tool.name] ? "text" : "password"}
              value={keyInputs[tool.name] ?? ""}
              onChange={(e) => handleKeyChange(tool.name, e.target.value)}
              placeholder={t("tools.key_placeholder")}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => toggleShowKey(tool.name)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKeys[tool.name] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      )}

      {!tool.available && tool.disabledReason && (
        <div className="text-xs text-muted-foreground">
          {tool.name === "analyze_image" ? t("tools.analyze_image_unavailable") : tool.disabledReason}
        </div>
      )}

      {!tool.enabledClassic && !tool.enabledButler && (
        <div className="text-xs text-muted-foreground">{t("tools.disabled_hint")}</div>
      )}
      {tool.requiresKey !== false && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleSave(tool, true)}
            disabled={saving[tool.name]}
          >
            {t("tools.clear")}
          </Button>
          <Button size="sm" onClick={() => void handleSave(tool)} disabled={saving[tool.name]}>
            {t("tools.save")}
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "h-8 w-8 rounded-lg border border-transparent",
          open
            ? "bg-background/70 text-foreground border-border/80"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        )}
        title={t("titlebar.tools")}
        aria-label={t("titlebar.tools")}
        onClick={() => setOpen(true)}
      >
        <Wrench className="size-4" />
      </Button>

      <DialogContent className="w-[900px] h-[640px] max-w-[90vw] max-h-[85vh] p-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {t("tools.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-4">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-md border border-border p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("native")}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] transition-colors",
                    activeTab === "native" ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  {t("tools.tab_native")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("plugin")}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] transition-colors",
                    activeTab === "plugin" ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  {t("tools.tab_plugins")}
                </button>
              </div>

              {activeTab === "native" ? (
                visibleTools.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("tools.empty")}
                  </div>
                ) : (
                  <div className="space-y-3">{visibleTools.map((tool) => renderToolCard(tool))}</div>
                )
              ) : pluginToolGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {t("tools.empty")}
                </div>
              ) : (
                <div className="space-y-3">
                  {pluginToolGroups.map(([pluginId, groupedTools]) => {
                    const plugin = pluginById.get(pluginId as "actionbook" | "knowledgebase")
                    const groupTitle = plugin?.name || t("tools.plugin_group_unknown")
                    const groupDescription = plugin?.description
                    const expanded = pluginGroupsExpanded[pluginId] ?? true

                    return (
                      <div key={pluginId} className="rounded-lg border border-border">
                        <button
                          type="button"
                          onClick={() =>
                            setPluginGroupsExpanded((prev) => ({
                              ...prev,
                              [pluginId]: !(prev[pluginId] ?? true)
                            }))
                          }
                          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-muted/30"
                        >
                          <div>
                            <div className="text-sm font-medium">{groupTitle}</div>
                            {groupDescription && (
                              <div className="text-xs text-muted-foreground">{groupDescription}</div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {groupedTools.length} ·{" "}
                            {expanded ? t("tools.plugin_group_collapse") : t("tools.plugin_group_expand")}
                          </div>
                        </button>
                        {expanded && <div className="p-3 space-y-3">{groupedTools.map((tool) => renderToolCard(tool))}</div>}
                      </div>
                    )
                  })}
                </div>
              )}

              {error && <div className="text-xs text-status-critical">{error}</div>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
