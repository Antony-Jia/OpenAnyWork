import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Folder,
  FolderPlus,
  Package,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Terminal,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"
import type {
  CapabilityScope,
  SkillBundle,
  SkillItem,
  SkillTextFile,
  SkillsCliResult
} from "@/types"

type ManagerTab = "installed" | "packages"
type InstalledView = "list" | "install" | "editor"
type EditorMode = "create" | "edit"

interface EditableSkillFile extends SkillTextFile {
  persisted: boolean
}

interface SkillEditorState {
  id: string | null
  name: string
  description: string
  files: EditableSkillFile[]
  removedPaths: string[]
  selectedPath: string | null
}

function isSkillEnabledInScope(skill: SkillItem, scope: CapabilityScope): boolean {
  return scope === "butler" ? skill.enabledButler : skill.enabledClassic
}

function readDescriptionFromSkillMarkdown(content: string): string {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return ""
  const desc = match[1].match(/^description:\s*(.*)$/m)
  if (!desc) return ""
  return desc[1].trim().replace(/^['"]|['"]$/g, "")
}

function upsertFrontmatterLine(frontmatter: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}:\\s*.*$`, "m")
  if (pattern.test(frontmatter)) {
    return frontmatter.replace(pattern, `${key}: ${value}`)
  }
  return frontmatter ? `${frontmatter}\n${key}: ${value}` : `${key}: ${value}`
}

function syncSkillMarkdown(content: string, skillName: string, description: string): string {
  const trimmed = content.trim()
  const bodyFallback = `# ${skillName || "new-skill"}\n\nDescribe what this skill does and how to use it.`
  const frontmatterMatch = trimmed.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)
  const safeName = skillName.trim() || "new-skill"
  const safeDescription =
    description.trim() ||
    readDescriptionFromSkillMarkdown(trimmed) ||
    `Reusable skill for ${safeName}.`
  const serializedDescription = JSON.stringify(safeDescription)

  if (!frontmatterMatch) {
    return [
      "---",
      `name: ${safeName}`,
      `description: ${serializedDescription}`,
      "---",
      "",
      trimmed || bodyFallback,
      ""
    ].join("\n")
  }

  let frontmatter = frontmatterMatch[1].trim()
  frontmatter = upsertFrontmatterLine(frontmatter, "name", safeName)
  frontmatter = upsertFrontmatterLine(frontmatter, "description", serializedDescription)
  const body = frontmatterMatch[2].trim() || bodyFallback
  return ["---", frontmatter, "---", "", body, ""].join("\n")
}

function getDefaultFileContent(path: string, skillName: string, description: string): string {
  const normalized = path.replace(/\\/g, "/")
  if (normalized === "SKILL.md") {
    return syncSkillMarkdown("", skillName, description)
  }
  if (normalized === "REFERENCE.md") {
    return "# Reference\n\nAdd detailed reference material for this skill.\n"
  }
  if (normalized === "scripts/example.py") {
    return [
      '"""Utility script for this skill."""',
      "",
      "def main() -> None:",
      '    print("Adjust this script for your skill.")',
      "",
      'if __name__ == "__main__":',
      "    main()",
      ""
    ].join("\n")
  }
  return ""
}

function createEmptyEditor(): SkillEditorState {
  const files: EditableSkillFile[] = [
    {
      path: "SKILL.md",
      content: syncSkillMarkdown("", "", ""),
      editable: true,
      isText: true,
      persisted: false
    }
  ]
  return {
    id: null,
    name: "",
    description: "",
    files,
    removedPaths: [],
    selectedPath: "SKILL.md"
  }
}

function createEditorFromBundle(bundle: SkillBundle): SkillEditorState {
  return {
    id: bundle.id,
    name: bundle.name,
    description: bundle.description,
    files: bundle.files.map((file) => ({ ...file, persisted: true })),
    removedPaths: [],
    selectedPath: bundle.files[0]?.path ?? null
  }
}

function syncEditorMainFile(
  editor: SkillEditorState,
  nextName: string,
  nextDescription: string
): SkillEditorState {
  const existing = editor.files.find((file) => file.path === "SKILL.md")
  const nextContent = syncSkillMarkdown(existing?.content ?? "", nextName, nextDescription)
  const nextFiles = existing
    ? editor.files.map((file) =>
        file.path === "SKILL.md"
          ? { ...file, content: nextContent, editable: true, isText: true }
          : file
      )
    : [
        {
          path: "SKILL.md",
          content: nextContent,
          editable: true,
          isText: true,
          persisted: false
        },
        ...editor.files
      ]

  return {
    ...editor,
    name: nextName,
    description: nextDescription,
    files: nextFiles,
    selectedPath: editor.selectedPath ?? "SKILL.md"
  }
}

function normalizePathListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function SkillsManager(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ManagerTab>("installed")
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [installedView, setInstalledView] = useState<InstalledView>("list")
  const [editorMode, setEditorMode] = useState<EditorMode>("create")
  const [editor, setEditor] = useState<SkillEditorState | null>(null)
  const [newFilePath, setNewFilePath] = useState("")
  const [installPath, setInstallPath] = useState("")
  const [installedError, setInstalledError] = useState<string | null>(null)
  const [savingEditor, setSavingEditor] = useState(false)
  const [packageSource, setPackageSource] = useState("")
  const [packageSkillNames, setPackageSkillNames] = useState("")
  const [packageQuery, setPackageQuery] = useState("")
  const [packageRemoveNames, setPackageRemoveNames] = useState("")
  const [packageInitName, setPackageInitName] = useState("")
  const [packageError, setPackageError] = useState<string | null>(null)
  const [packageBusy, setPackageBusy] = useState(false)
  const [packageResult, setPackageResult] = useState<SkillsCliResult | null>(null)
  const { t } = useLanguage()

  const getSourceLabel = (skill: SkillItem): string => {
    if (skill.sourceType === "managed") return t("skills.source_managed")
    if (skill.sourceType === "agent-user") return t("skills.source_agent_user")
    if (skill.sourceType === "agent-workspace") return t("skills.source_agent_workspace")
    if (skill.sourceType === "configured-path") return t("skills.source_configured_path")
    return t("skills.source_unknown")
  }

  const loadSkills = useCallback(async () => {
    const items = await window.api.skills.list()
    setSkills(items)
  }, [])

  useEffect(() => {
    if (!open) return
    void loadSkills()
  }, [open, loadSkills])

  const selectedEditorFile = useMemo(() => {
    if (!editor?.selectedPath) return null
    return editor.files.find((file) => file.path === editor.selectedPath) ?? null
  }, [editor])

  const resetInstalledView = (): void => {
    setInstalledView("list")
    setEditorMode("create")
    setEditor(null)
    setNewFilePath("")
    setInstallPath("")
    setInstalledError(null)
    setSavingEditor(false)
  }

  const resetPackageState = (): void => {
    setPackageSource("")
    setPackageSkillNames("")
    setPackageQuery("")
    setPackageRemoveNames("")
    setPackageInitName("")
    setPackageError(null)
    setPackageBusy(false)
    setPackageResult(null)
  }

  const handleTriggerClick = (): void => {
    setInstalledError(null)
    setPackageError(null)
    setOpen(true)
  }

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      resetInstalledView()
      resetPackageState()
      setTab("installed")
    }
    setOpen(next)
  }

  const handleScan = async (): Promise<void> => {
    try {
      setInstalledError(null)
      setScanning(true)
      const items = await window.api.skills.scan()
      setSkills(items)
    } catch (error) {
      setInstalledError(error instanceof Error ? error.message : "Failed to scan skills.")
    } finally {
      setScanning(false)
    }
  }

  const startCreate = (): void => {
    setEditorMode("create")
    setEditor(createEmptyEditor())
    setInstalledView("editor")
    setInstalledError(null)
  }

  const startInstall = (): void => {
    setInstallPath("")
    setInstalledView("install")
    setInstalledError(null)
  }

  const startEdit = async (skill: SkillItem): Promise<void> => {
    try {
      setInstalledError(null)
      const bundle = await window.api.skills.getBundle(skill.id)
      setEditorMode("edit")
      setEditor(createEditorFromBundle(bundle))
      setInstalledView("editor")
    } catch (error) {
      setInstalledError(error instanceof Error ? error.message : "Failed to load skill bundle.")
    }
  }

  const updateEditorName = (value: string): void => {
    setEditor((prev) => (prev ? syncEditorMainFile(prev, value, prev.description) : prev))
  }

  const updateEditorDescription = (value: string): void => {
    setEditor((prev) => (prev ? syncEditorMainFile(prev, prev.name, value) : prev))
  }

  const updateSelectedFileContent = (value: string): void => {
    setEditor((prev) => {
      if (!prev?.selectedPath) return prev
      return {
        ...prev,
        files: prev.files.map((file) =>
          file.path === prev.selectedPath ? { ...file, content: value } : file
        )
      }
    })
  }

  const addEditorFile = (path: string): void => {
    const normalized = path
      .replace(/\\/g, "/")
      .trim()
      .replace(/^\.\/+/, "")
    if (!normalized || !editor) {
      return
    }
    setEditor((prev) => {
      if (!prev) return prev
      if (prev.files.some((file) => file.path === normalized)) {
        return { ...prev, selectedPath: normalized }
      }
      return {
        ...prev,
        files: [
          ...prev.files,
          {
            path: normalized,
            content: getDefaultFileContent(normalized, prev.name, prev.description),
            editable: true,
            isText: true,
            persisted: false
          }
        ].sort((a, b) => a.path.localeCompare(b.path)),
        selectedPath: normalized
      }
    })
    setNewFilePath("")
  }

  const removeSelectedFile = (): void => {
    if (!editor?.selectedPath || editor.selectedPath === "SKILL.md") {
      return
    }
    setEditor((prev) => {
      if (!prev?.selectedPath) return prev
      const file = prev.files.find((item) => item.path === prev.selectedPath)
      const nextFiles = prev.files.filter((item) => item.path !== prev.selectedPath)
      return {
        ...prev,
        files: nextFiles,
        removedPaths:
          file?.persisted && !prev.removedPaths.includes(file.path)
            ? [...prev.removedPaths, file.path]
            : prev.removedPaths,
        selectedPath: nextFiles[0]?.path ?? null
      }
    })
  }

  const handleSaveEditor = async (): Promise<void> => {
    if (!editor) return
    try {
      setSavingEditor(true)
      setInstalledError(null)
      const syncedEditor = syncEditorMainFile(editor, editor.name, editor.description)
      const payloadFiles = syncedEditor.files
        .filter((file) => file.isText)
        .map((file) => ({ path: file.path, content: file.content ?? "" }))

      if (editorMode === "create") {
        await window.api.skills.create({
          name: syncedEditor.name,
          description: syncedEditor.description,
          files: payloadFiles
        })
      } else if (syncedEditor.id) {
        await window.api.skills.update({
          id: syncedEditor.id,
          upsert: payloadFiles,
          remove: syncedEditor.removedPaths
        })
      }

      await loadSkills()
      resetInstalledView()
    } catch (error) {
      setInstalledError(error instanceof Error ? error.message : "Failed to save skill.")
    } finally {
      setSavingEditor(false)
    }
  }

  const handlePathInstall = async (): Promise<void> => {
    try {
      setInstalledError(null)
      await window.api.skills.install({ path: installPath })
      await loadSkills()
      resetInstalledView()
    } catch (error) {
      setInstalledError(error instanceof Error ? error.message : "Failed to install skill.")
    }
  }

  const handleDelete = async (skill: SkillItem): Promise<void> => {
    if (!skill.capabilities.canDelete) return
    const confirmed = window.confirm(`${t("skills.delete")}: ${skill.name}?`)
    if (!confirmed) return
    await window.api.skills.delete(skill.id)
    await loadSkills()
  }

  const handleRemoveViaCli = async (skill: SkillItem): Promise<void> => {
    const confirmed = window.confirm(`${t("skills.remove_cli")}: ${skill.name}?`)
    if (!confirmed) return
    try {
      setPackageBusy(true)
      setPackageError(null)
      const result = await window.api.skills.cliRemove({ names: [skill.name] })
      setPackageResult(result)
      await loadSkills()
      setTab("packages")
    } catch (error) {
      setPackageError(error instanceof Error ? error.message : "Failed to remove skill.")
      setTab("packages")
    } finally {
      setPackageBusy(false)
    }
  }

  const handleToggleEnabled = async (skill: SkillItem, scope: CapabilityScope): Promise<void> => {
    await window.api.skills.setEnabledScope({
      name: skill.id,
      scope,
      enabled: !isSkillEnabledInScope(skill, scope)
    })
    await loadSkills()
  }

  const runPackageCommand = async (command: () => Promise<SkillsCliResult>): Promise<void> => {
    try {
      setPackageBusy(true)
      setPackageError(null)
      const result = await command()
      setPackageResult(result)
      await loadSkills()
    } catch (error) {
      setPackageError(error instanceof Error ? error.message : "Skills package command failed.")
    } finally {
      setPackageBusy(false)
    }
  }

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
        title={t("titlebar.skills")}
        aria-label={t("titlebar.skills")}
        onClick={handleTriggerClick}
      >
        <Puzzle className="size-4" />
      </Button>

      <DialogContent className="w-[1120px] h-[760px] max-w-[96vw] max-h-[92vh] p-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                {t("skills.title")}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={tab === "installed" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTab("installed")}
                >
                  {t("skills.tab_installed")}
                </Button>
                <Button
                  variant={tab === "packages" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTab("packages")}
                >
                  {t("skills.tab_packages")}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 pt-4">
            {tab === "installed" ? (
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Folder className="size-3.5" />
                    <span>{t("skills.sources_hint")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleScan()}
                      disabled={scanning}
                    >
                      <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} />
                      {scanning ? t("common.loading") : t("skills.scan")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={startInstall}>
                      {t("skills.install")}
                    </Button>
                    <Button size="sm" onClick={startCreate}>
                      <Plus className="size-3.5" />
                      {t("skills.create")}
                    </Button>
                  </div>
                </div>

                {installedError && (
                  <div className="text-xs text-status-critical">{installedError}</div>
                )}
                {installedView === "install" ? (
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        {t("skills.install_path")}
                      </label>
                      <Input
                        value={installPath}
                        onChange={(event) => setInstallPath(event.target.value)}
                        placeholder={t("skills.install_hint")}
                      />
                    </div>
                  </div>
                ) : installedView === "editor" && editor ? (
                  <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="flex min-h-0 flex-col rounded-lg border border-border">
                      <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {editorMode === "create" ? t("skills.create") : t("skills.edit")}
                      </div>
                      <div className="space-y-3 p-3">
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">
                            {t("skills.name")}
                          </label>
                          <Input
                            value={editor.name}
                            onChange={(event) => updateEditorName(event.target.value)}
                            placeholder={t("skills.name_hint")}
                            disabled={editorMode === "edit"}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">
                            {t("skills.description")}
                          </label>
                          <Input
                            value={editor.description}
                            onChange={(event) => updateEditorDescription(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">
                            {t("skills.file_path")}
                          </label>
                          <Input
                            value={newFilePath}
                            onChange={(event) => setNewFilePath(event.target.value)}
                            placeholder={t("skills.file_path_hint")}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-center"
                            onClick={() => addEditorFile(newFilePath)}
                          >
                            <FolderPlus className="size-3.5" />
                            {t("skills.add_file")}
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start"
                            onClick={() => addEditorFile("REFERENCE.md")}
                          >
                            {t("skills.quick_add_reference")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start"
                            onClick={() => addEditorFile("scripts/example.py")}
                          >
                            {t("skills.quick_add_script")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start"
                            onClick={removeSelectedFile}
                            disabled={!editor.selectedPath || editor.selectedPath === "SKILL.md"}
                          >
                            <Trash2 className="size-3.5" />
                            {t("skills.remove_file")}
                          </Button>
                        </div>
                      </div>
                      <div className="border-y border-border px-3 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {t("skills.files")}
                      </div>
                      <ScrollArea className="flex-1 min-h-0">
                        <div className="space-y-1 p-2">
                          {editor.files.map((file) => (
                            <button
                              key={file.path}
                              type="button"
                              onClick={() =>
                                setEditor((prev) =>
                                  prev ? { ...prev, selectedPath: file.path } : prev
                                )
                              }
                              className={cn(
                                "w-full rounded-md border px-3 py-2 text-left text-xs transition-colors",
                                editor.selectedPath === file.path
                                  ? "border-foreground/30 bg-foreground/5 text-foreground"
                                  : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                              )}
                            >
                              <div className="truncate font-medium">{file.path}</div>
                              <div className="mt-1 text-[10px] uppercase tracking-[0.14em]">
                                {file.isText ? t("skills.text_file") : t("skills.binary_file")}
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="flex min-h-0 flex-col rounded-lg border border-border">
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {selectedEditorFile?.path ?? t("skills.content")}
                          </div>
                          {selectedEditorFile && (
                            <div className="text-[11px] text-muted-foreground">
                              {selectedEditorFile.editable
                                ? t("skills.file_editable")
                                : selectedEditorFile.isText
                                  ? t("skills.file_readonly")
                                  : t("skills.binary_hint")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 p-4">
                        {selectedEditorFile ? (
                          selectedEditorFile.isText ? (
                            <textarea
                              value={selectedEditorFile.content ?? ""}
                              onChange={(event) => updateSelectedFileContent(event.target.value)}
                              disabled={!selectedEditorFile.editable}
                              className="h-full min-h-[420px] w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                              {t("skills.binary_hint")}
                            </div>
                          )
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                            {t("skills.empty")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : skills.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("skills.empty")}
                  </div>
                ) : (
                  <ScrollArea className="flex-1 min-h-0 pr-1">
                    <div className="space-y-2">
                      {skills.map((skill) => (
                        <div
                          key={skill.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{skill.name}</div>
                            <div className="text-xs text-muted-foreground">{skill.description}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {t("skills.source")}: {getSourceLabel(skill)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {skill.mainFilePath}
                            </div>
                            {!skill.enabledClassic && !skill.enabledButler && (
                              <div className="text-[10px] text-muted-foreground">
                                {t("skills.disabled_hint")}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {(["classic", "butler"] as const).map((scope) => {
                              const enabled = isSkillEnabledInScope(skill, scope)
                              return (
                                <button
                                  key={scope}
                                  type="button"
                                  onClick={() => void handleToggleEnabled(skill, scope)}
                                  className={cn(
                                    "text-[10px] uppercase tracking-[0.12em] transition-colors",
                                    enabled
                                      ? "text-foreground"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {t(`scope.${scope}`)}:{" "}
                                  {enabled ? t("tools.enabled") : t("tools.disabled")}
                                </button>
                              )
                            })}
                            {skill.capabilities.canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void startEdit(skill)}
                              >
                                <Pencil className="size-3.5" />
                                {t("skills.edit")}
                              </Button>
                            )}
                            {skill.capabilities.canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleDelete(skill)}
                              >
                                <Trash2 className="size-3.5" />
                                {t("skills.delete")}
                              </Button>
                            )}
                            {skill.capabilities.canCliManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleRemoveViaCli(skill)}
                              >
                                <Package className="size-3.5" />
                                {t("skills.remove_cli")}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <ScrollArea className="min-h-0 rounded-lg border border-border">
                  <div className="space-y-4 p-4">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        {t("skills.package_source")}
                      </label>
                      <Input
                        value={packageSource}
                        onChange={(event) => setPackageSource(event.target.value)}
                        placeholder={t("skills.package_source_hint")}
                      />
                      <label className="text-xs text-muted-foreground">
                        {t("skills.package_names")}
                      </label>
                      <textarea
                        value={packageSkillNames}
                        onChange={(event) => setPackageSkillNames(event.target.value)}
                        placeholder={t("skills.package_names_hint")}
                        className="min-h-[84px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          void runPackageCommand(() =>
                            window.api.skills.cliAdd({
                              source: packageSource,
                              skillNames: normalizePathListInput(packageSkillNames)
                            })
                          )
                        }
                        disabled={packageBusy}
                      >
                        <Package className="size-3.5" />
                        {t("skills.cli_add")}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        {t("skills.find_query")}
                      </label>
                      <Input
                        value={packageQuery}
                        onChange={(event) => setPackageQuery(event.target.value)}
                        placeholder={t("skills.find_hint")}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void runPackageCommand(() =>
                            window.api.skills.cliFind({ query: packageQuery })
                          )
                        }
                        disabled={packageBusy}
                      >
                        <Search className="size-3.5" />
                        {t("skills.cli_find")}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        {t("skills.remove_names")}
                      </label>
                      <textarea
                        value={packageRemoveNames}
                        onChange={(event) => setPackageRemoveNames(event.target.value)}
                        placeholder={t("skills.remove_names_hint")}
                        className="min-h-[84px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void runPackageCommand(() =>
                            window.api.skills.cliRemove({
                              names: normalizePathListInput(packageRemoveNames)
                            })
                          )
                        }
                        disabled={packageBusy}
                      >
                        <Trash2 className="size-3.5" />
                        {t("skills.cli_remove")}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        {t("skills.init_name")}
                      </label>
                      <Input
                        value={packageInitName}
                        onChange={(event) => setPackageInitName(event.target.value)}
                        placeholder={t("skills.name_hint")}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void runPackageCommand(() =>
                            window.api.skills.cliInit({ name: packageInitName })
                          )
                        }
                        disabled={packageBusy}
                      >
                        <FolderPlus className="size-3.5" />
                        {t("skills.cli_init")}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void runPackageCommand(() => window.api.skills.cliList())}
                        disabled={packageBusy}
                      >
                        {t("skills.cli_list")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void runPackageCommand(() => window.api.skills.cliCheck())}
                        disabled={packageBusy}
                      >
                        {t("skills.cli_check")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void runPackageCommand(() => window.api.skills.cliUpdate())}
                        disabled={packageBusy}
                      >
                        {t("skills.cli_update")}
                      </Button>
                    </div>

                    {packageError && (
                      <div className="text-xs text-status-critical">{packageError}</div>
                    )}
                  </div>
                </ScrollArea>

                <div className="flex min-h-0 flex-col rounded-lg border border-border">
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Terminal className="size-4" />
                      {t("skills.package_output")}
                    </div>
                    {packageResult && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {packageResult.summary}
                      </div>
                    )}
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-4 p-4 font-mono text-xs">
                      {packageResult ? (
                        <>
                          <div className="rounded-lg border border-border p-3">
                            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              {t("skills.package_command")}
                            </div>
                            <div className="break-all">{packageResult.command}</div>
                          </div>
                          <div className="rounded-lg border border-border p-3">
                            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              STDOUT
                            </div>
                            <pre className="whitespace-pre-wrap break-words">
                              {packageResult.stdout || t("skills.package_empty_output")}
                            </pre>
                          </div>
                          <div className="rounded-lg border border-border p-3">
                            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              STDERR
                            </div>
                            <pre className="whitespace-pre-wrap break-words">
                              {packageResult.stderr || t("skills.package_empty_output")}
                            </pre>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                          {t("skills.package_output_hint")}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>

          {(installedView === "install" || installedView === "editor") && tab === "installed" && (
            <DialogFooter className="px-6 pb-6 pt-2">
              <Button variant="ghost" onClick={resetInstalledView}>
                {t("skills.cancel")}
              </Button>
              {installedView === "install" ? (
                <Button onClick={() => void handlePathInstall()}>{t("skills.save")}</Button>
              ) : (
                <Button onClick={() => void handleSaveEditor()} disabled={savingEditor}>
                  {savingEditor ? t("common.loading") : t("skills.save")}
                </Button>
              )}
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
