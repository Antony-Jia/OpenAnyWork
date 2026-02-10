import { useLanguage } from "@/lib/i18n"
import { ActionbookPluginCard } from "./actionbook/ActionbookPluginCard"

export function PluginsTab(): React.JSX.Element {
  const { t } = useLanguage()

  return (
    <div className="px-4 py-3 pb-6 border-b border-border/70 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("plugin.title")}
        </span>
      </div>
      <ActionbookPluginCard />
    </div>
  )
}
