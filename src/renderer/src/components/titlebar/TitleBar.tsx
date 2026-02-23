import React from "react"
import { SettingsMenu } from "./SettingsMenu"
import { SubagentManager } from "./SubagentManager"
import { ToolsManager } from "./ToolsManager"
import { SkillsManager } from "./SkillsManager"
import { McpManager } from "./McpManager"
import { PromptManager } from "./PromptManager"
import { PluginManager } from "./PluginManager"
import { ContainerManager } from "./ContainerManager"
import { MemoryManager } from "./MemoryManager"
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
    <div className="app-titlebar app-titlebar-cyber flex h-14 w-full shrink-0 items-center justify-between px-5 app-drag-region select-none z-50">
      {/* Left: Title & Settings */}
      <div className="flex items-center gap-4 app-no-drag">
        {/* Logo / Title */}
        <div className="flex items-center justify-center pl-1">
          <button
            type="button"
            onClick={toggleMode}
            className={cn(
              "text-[16px] font-extrabold tracking-[0.08em] uppercase select-none transition-all duration-300",
              appMode === "butler"
                ? "text-accent neon-text"
                : "text-foreground/80 hover:text-accent hover:neon-text"
            )}
          >
            {t("app.title")}
          </button>
        </div>

        <div className="h-6 w-[1px] gradient-divider-vertical mx-2.5" />

        <SettingsMenu threadId={threadId} />
        <SubagentManager />
        <ToolsManager />
        <SkillsManager />
        <McpManager />
        <PromptManager />
        <PluginManager />
        <ContainerManager threadId={threadId} />
        <MemoryManager />
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-2 app-no-drag">
        <WindowControls />
      </div>
    </div>
  )
}
