import React from "react"
import { SettingsMenu } from "./SettingsMenu"
import { PromptManager } from "./PromptManager"
import { MemoryManager } from "./MemoryManager"
import { SubagentManager } from "./SubagentManager"
import { SkillsManager } from "./SkillsManager"
import { ToolsManager } from "./ToolsManager"
import { ContainerManager } from "./ContainerManager"
import { McpManager } from "./McpManager"
import { PluginManager } from "./PluginManager"
import { WindowControls } from "./WindowControls"
import { useLanguage } from "@/lib/i18n"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

interface TitleBarProps {
  threadId: string | null
}

export function TitleBar({ threadId }: TitleBarProps): React.JSX.Element {
  const { t } = useLanguage()
  const { appMode, setAppMode } = useAppStore()

  const toggleMode = (): void => {
    setAppMode(appMode === "classic" ? "butler" : "classic")
  }

  return (
    <div className="app-titlebar flex h-[40px] w-full shrink-0 items-center justify-between px-3 app-drag-region select-none z-50">
      {/* Left: Title & Settings */}
      <div className="flex items-center gap-3 app-no-drag">
        {/* Logo / Title */}
        <div className="flex items-center justify-center pl-1">
          <button
            type="button"
            onClick={toggleMode}
            className={cn(
              "text-[13px] font-bold tracking-[0.05em] select-none transition-colors",
              appMode === "butler" ? "text-blue-500" : "text-foreground"
            )}
          >
            {t("app.title")}
          </button>
        </div>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <SettingsMenu threadId={threadId} />
        <PromptManager />
        <MemoryManager />
        <SubagentManager />
        <SkillsManager />
        <ToolsManager />
        <McpManager />
        <PluginManager />
        <ContainerManager threadId={threadId} />
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-2 app-no-drag">
        <WindowControls />
      </div>
    </div>
  )
}
