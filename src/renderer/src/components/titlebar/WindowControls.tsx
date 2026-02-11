import { Minimize, Maximize, X } from "lucide-react"
import { useLanguage } from "@/lib/i18n"

export function WindowControls() {
  const handleMinimize = () => {
    window.electron.ipcRenderer.send("window-minimize")
  }

  const handleMaximize = () => {
    window.electron.ipcRenderer.send("window-maximize")
  }

  const handleClose = () => {
    window.electron.ipcRenderer.send("window-close")
  }

  const { t } = useLanguage()

  return (
    <div className="flex items-center space-x-0.5 no-drag">
      <button
        onClick={handleMinimize}
        className="p-2 hover:bg-foreground/10 rounded-lg transition-all duration-150 text-muted-foreground hover:text-foreground"
        title={t("window.minimize")}
      >
        <Minimize size={17} />
      </button>
      <button
        onClick={handleMaximize}
        className="p-2 hover:bg-foreground/10 rounded-lg transition-all duration-150 text-muted-foreground hover:text-foreground"
        title={t("window.maximize")}
      >
        <Maximize size={17} />
      </button>
      <button
        onClick={handleClose}
        className="p-2 hover:bg-destructive hover:text-white rounded-lg transition-all duration-150 text-muted-foreground"
        title={t("window.close")}
      >
        <X size={18} />
      </button>
    </div>
  )
}
