import {
  createSkillFromConversationDefinition,
  createSkillFromConversationTool
} from "./create-skill-from-conversation"
import { internetSearchDefinition, internetSearchTool } from "./internet-search"
import { addCalendarEventDefinition, addCalendarEventTool } from "./add-calendar-event"
import { addCountdownTimerDefinition, addCountdownTimerTool } from "./add-countdown-timer"
import { sendEmailDefinition, sendEmailTool } from "./send-email"
import { analyzeImageDefinition, analyzeImageTool } from "./analyze-image"
import {
  parseWorkspaceDocumentDefinition,
  parseWorkspaceDocumentTool
} from "./parse-workspace-document"
import type { ToolDefinition } from "../types"

export const toolRegistry: Array<{
  definition: ToolDefinition
  instance: unknown
}> = [
  { definition: createSkillFromConversationDefinition, instance: createSkillFromConversationTool },
  { definition: internetSearchDefinition, instance: internetSearchTool },
  { definition: addCalendarEventDefinition, instance: addCalendarEventTool },
  { definition: addCountdownTimerDefinition, instance: addCountdownTimerTool },
  { definition: sendEmailDefinition, instance: sendEmailTool },
  { definition: analyzeImageDefinition, instance: analyzeImageTool },
  { definition: parseWorkspaceDocumentDefinition, instance: parseWorkspaceDocumentTool }
]

export const toolDefinitions: ToolDefinition[] = toolRegistry.map((entry) => entry.definition)

export const toolInstances = toolRegistry.map((entry) => entry.instance)

export const toolInstanceMap = new Map(
  toolRegistry.map((entry) => [entry.definition.name, entry.instance])
)
