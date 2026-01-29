import React from "react"
import { SettingsMenu } from "./SettingsMenu"
import { SubagentManager } from "./SubagentManager"
import { SkillsManager } from "./SkillsManager"
import { ToolsManager } from "./ToolsManager"
import { ContainerManager } from "./ContainerManager"
import { McpManager } from "./McpManager"
import { WindowControls } from "./WindowControls"
import { useLanguage } from "@/lib/i18n"

interface TitleBarProps {
  threadId: string | null
}

export function TitleBar({ threadId }: TitleBarProps): React.JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="app-titlebar flex h-[40px] w-full shrink-0 items-center justify-between px-3 app-drag-region select-none z-50">
      {/* Left: Title & Settings */}
      <div className="flex items-center gap-3 app-no-drag">
        {/* Logo / Title */}
        <div className="flex items-center justify-center pl-1">
          <div className="text-[13px] font-bold text-foreground tracking-[0.05em] select-none">
            {t("app.title")}
          </div>
        </div>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <SettingsMenu threadId={threadId} />
        <SubagentManager />
        <SkillsManager />
        <ToolsManager />
        <McpManager />
        <ContainerManager threadId={threadId} />
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-2 app-no-drag">
        <WindowControls />
      </div>
    </div>
  )
}
