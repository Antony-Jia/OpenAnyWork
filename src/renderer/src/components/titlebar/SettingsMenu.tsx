import { useState } from "react"
import { Settings2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ModelPickerPanel } from "@/components/chat/ModelSwitcher"
import { cn } from "@/lib/utils"

interface SettingsMenuProps {
  threadId: string | null
}

export function SettingsMenu({ threadId }: SettingsMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { language, setLanguage, theme, setTheme, t } = useLanguage()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "h-7 w-7 rounded-md border border-transparent",
            open
              ? "bg-background/70 text-foreground border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
          title={t("settings.title")}
          aria-label="Settings"
        >
          <Settings2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[460px] p-0 overflow-hidden border-border/80 bg-background/80 backdrop-blur"
        align="start"
        sideOffset={10}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/70 bg-background/70">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("settings.title")}
          </span>
          {threadId && (
            <span className="text-[10px] font-mono text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded-sm">
              {threadId.slice(0, 6)}
            </span>
          )}
        </div>

        {/* Language Selection */}
        <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("settings.language")}</span>
          <div className="flex gap-2">
            <Button
              variant={language === 'en' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setLanguage('en')}
              className="h-6 text-xs"
            >
              {t("settings.language.english")}
            </Button>
            <Button
              variant={language === 'zh' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setLanguage('zh')}
              className="h-6 text-xs"
            >
              {t("settings.language.chinese")}
            </Button>
          </div>
        </div>

        {/* Theme Selection */}
        <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("settings.theme")}</span>
          <div className="flex gap-2">
            <Button
              variant={language === 'zh' ? 'ghost' : (theme === 'dark' ? 'secondary' : 'ghost')}
              size="sm"
              onClick={() => setTheme('dark')}
              className={cn("h-6 text-xs", theme === 'dark' && "bg-secondary text-secondary-foreground")}
            >
              {t("settings.theme.dark")}
            </Button>
            <Button
              variant={language === 'zh' ? 'ghost' : (theme === 'light' ? 'secondary' : 'ghost')}
              size="sm"
              onClick={() => setTheme('light')}
              className={cn("h-6 text-xs", theme === 'light' && "bg-secondary text-secondary-foreground")}
            >
              {t("settings.theme.light")}
            </Button>
          </div>
        </div>

        {threadId ? (
          <ModelPickerPanel
            threadId={threadId}
            onModelSelected={() => setOpen(false)}
          />
        ) : (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            {language === 'zh' ? "创建对话以配置模型。" : "Create a thread to configure models."}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
