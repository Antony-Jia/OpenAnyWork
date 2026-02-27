import { useState } from "react"
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ActionbookPluginCard } from "./actionbook/ActionbookPluginCard"
import { KnowledgebasePluginCard } from "./knowledgebase/KnowledgebasePluginCard"

export function PluginsTab(): React.JSX.Element {
  const [actionbookCollapsed, setActionbookCollapsed] = useState(false)
  const [knowledgebaseCollapsed, setKnowledgebaseCollapsed] = useState(false)

  const allCollapsed = actionbookCollapsed && knowledgebaseCollapsed

  const toggleAll = (): void => {
    const next = !allCollapsed
    setActionbookCollapsed(next)
    setKnowledgebaseCollapsed(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={toggleAll} className="gap-1.5">
          {allCollapsed ? (
            <ChevronsUpDown className="size-3.5" />
          ) : (
            <ChevronsDownUp className="size-3.5" />
          )}
          {allCollapsed ? "全部展开" : "全部折叠"}
        </Button>
      </div>
      <ActionbookPluginCard
        collapsed={actionbookCollapsed}
        onToggleCollapsed={() => setActionbookCollapsed((prev) => !prev)}
      />
      <KnowledgebasePluginCard
        collapsed={knowledgebaseCollapsed}
        onToggleCollapsed={() => setKnowledgebaseCollapsed((prev) => !prev)}
      />
    </div>
  )
}
