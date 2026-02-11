import { useState } from "react"
import { Plug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { PluginsTab } from "@/plugins"

export function PluginManager(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "h-8 w-8 rounded-lg border border-transparent",
          open
            ? "bg-background/70 text-foreground border-border/80"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        )}
        title={t("titlebar.plugins")}
        aria-label={t("titlebar.plugins")}
        onClick={() => setOpen(true)}
      >
        <Plug className="size-4" />
      </Button>

      <DialogContent className="w-[960px] h-[720px] max-w-[90vw] max-h-[85vh] p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-7 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-[15px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("plugin.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <PluginsTab />
        </div>
      </DialogContent>
    </Dialog>
  )
}
