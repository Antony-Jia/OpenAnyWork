import { useState } from "react"
import { Settings2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ModelPickerPanel } from "@/components/chat/ModelSwitcher"
import { cn } from "@/lib/utils"

interface SettingsMenuProps {
  threadId: string | null
}

export function SettingsMenu({ threadId }: SettingsMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const disabled = !threadId

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
          title="Settings"
          aria-label="Settings"
          disabled={disabled}
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
            Settings
          </span>
          {threadId && (
            <span className="text-[10px] text-muted-foreground">
              Thread {threadId.slice(0, 6)}
            </span>
          )}
        </div>
        {threadId ? (
          <ModelPickerPanel
            threadId={threadId}
            onModelSelected={() => setOpen(false)}
          />
        ) : (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            Create a thread to configure models.
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
