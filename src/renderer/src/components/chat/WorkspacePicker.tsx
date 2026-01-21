import { selectWorkspaceFolder } from "@/lib/workspace-utils"
import { Check, ChevronDown, Folder } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCurrentThread } from "@/lib/thread-context"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n"

interface WorkspacePickerProps {
  threadId: string
}

export function WorkspacePicker({ threadId }: WorkspacePickerProps): React.JSX.Element {
  const { t } = useLanguage()
  const { workspacePath, setWorkspacePath, setWorkspaceFiles } = useCurrentThread(threadId)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load workspace path and files for current thread
  useEffect(() => {
    async function loadWorkspace(): Promise<void> {
      if (threadId) {
        const path = await window.api.workspace.get(threadId)
        setWorkspacePath(path)

        // If a folder is linked, load files from disk
        if (path) {
          const result = await window.api.workspace.loadFromDisk(threadId)
          if (result.success && result.files) {
            setWorkspaceFiles(result.files)
          }
        }
      }
    }
    loadWorkspace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  async function handleSelectFolder(): Promise<void> {
    await selectWorkspaceFolder(threadId, setWorkspacePath, setWorkspaceFiles, setLoading, setOpen)
  }

  const folderName = workspacePath?.split("/").pop()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs gap-1.5",
            workspacePath ? "text-foreground" : "text-amber-500"
          )}
          disabled={!threadId}
        >
          <Folder className="size-3.5" />
          <span className="max-w-[120px] truncate">
            {workspacePath ? folderName : t("chat.select_workspace_button")}
          </span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
            {t("chat.workspace_picker_title")}
          </div>

          {workspacePath ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-md bg-background-secondary border border-border bg-muted/40">
                <Check className="size-3.5 text-status-nominal shrink-0" />
                <span className="text-xs font-mono truncate flex-1" title={workspacePath}>
                  {folderName}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                {t("chat.workspace_picker_active_desc")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleSelectFolder}
                disabled={loading}
              >
                {t("chat.change_folder")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t("chat.workspace_picker_desc")}
              </p>
              <Button
                variant="default"
                size="sm"
                className="w-full h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSelectFolder}
                disabled={loading}
              >
                <Folder className="size-3.5 mr-1.5" />
                {t("chat.select_folder")}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
