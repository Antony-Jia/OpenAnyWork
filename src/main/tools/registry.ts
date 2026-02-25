import {
  createSkillFromConversationDefinition,
  createSkillFromConversationTool
} from "./create-skill-from-conversation"
import { internetSearchDefinition, internetSearchTool } from "./internet-search"
import { addCalendarEventDefinition, addCalendarEventTool } from "./add-calendar-event"
import { addCountdownTimerDefinition, addCountdownTimerTool } from "./add-countdown-timer"
import { calendarUpsertDefinition, calendarUpsertTool } from "./calendar-upsert"
import { countdownUpsertDefinition, countdownUpsertTool } from "./countdown-upsert"
import { queryCalendarEventsDefinition, queryCalendarEventsTool } from "./query-calendar-events"
import { queryCountdownTimersDefinition, queryCountdownTimersTool } from "./query-countdown-timers"
import { pullRssUpdatesDefinition, pullRssUpdatesTool } from "./pull-rss-updates"
import { queryRssItemsDefinition, queryRssItemsTool } from "./query-rss-items"
import { queryMailboxDefinition, queryMailboxTool } from "./query-mailbox"
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
  { definition: calendarUpsertDefinition, instance: calendarUpsertTool },
  { definition: countdownUpsertDefinition, instance: countdownUpsertTool },
  { definition: queryCalendarEventsDefinition, instance: queryCalendarEventsTool },
  { definition: queryCountdownTimersDefinition, instance: queryCountdownTimersTool },
  { definition: pullRssUpdatesDefinition, instance: pullRssUpdatesTool },
  { definition: queryRssItemsDefinition, instance: queryRssItemsTool },
  { definition: queryMailboxDefinition, instance: queryMailboxTool },
  { definition: sendEmailDefinition, instance: sendEmailTool },
  { definition: analyzeImageDefinition, instance: analyzeImageTool },
  { definition: parseWorkspaceDocumentDefinition, instance: parseWorkspaceDocumentTool }
]

export const toolDefinitions: ToolDefinition[] = toolRegistry.map((entry) => entry.definition)

export const toolInstances = toolRegistry.map((entry) => entry.instance)

export const toolInstanceMap = new Map(
  toolRegistry.map((entry) => [entry.definition.name, entry.instance])
)
