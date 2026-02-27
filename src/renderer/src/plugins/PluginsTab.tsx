import { ActionbookPluginCard } from "./actionbook/ActionbookPluginCard"
import { KnowledgebasePluginCard } from "./knowledgebase/KnowledgebasePluginCard"

export function PluginsTab(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <ActionbookPluginCard />
      <KnowledgebasePluginCard />
    </div>
  )
}
