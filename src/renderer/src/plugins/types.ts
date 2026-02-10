export type PresetPluginId = "actionbook"

export interface PresetPluginItem {
  id: PresetPluginId
  name: string
  description: string
  enabled: boolean
}

export interface ActionbookCliCheck {
  ok: boolean
  message: string
  version?: string
}

export interface ActionbookSkillCheck {
  ok: boolean
  message: string
  path?: string
}

export interface ActionbookExtensionCheck {
  ok: boolean
  message: string
  path?: string
  version?: string
  bridgeRunning: boolean
  extensionConnected: boolean
  statusMessage?: string
  pingMessage?: string
}

export interface ActionbookPrereqStatus {
  checkedAt: string
  cli: ActionbookCliCheck
  skill: ActionbookSkillCheck
  extension: ActionbookExtensionCheck
}

export type ActionbookTokenSource = "log" | "file" | null
export type ActionbookLogSource = "stdout" | "stderr" | "system"

export interface ActionbookLogEntry {
  id: string
  at: string
  source: ActionbookLogSource
  line: string
}

export type ActionbookMilestoneType =
  | "bridge_started"
  | "bridge_waiting_extension"
  | "bridge_stopped"
  | "bridge_exited"
  | "token_found"
  | "token_file_found"
  | "status_ok"
  | "status_fail"
  | "ping_ok"
  | "ping_fail"
  | "error"

export interface ActionbookMilestone {
  id: string
  at: string
  type: ActionbookMilestoneType
  ok: boolean
  message: string
}

export interface ActionbookBridgeState {
  running: boolean
  managed: boolean
  port: number
  pid?: number
}

export interface ActionbookRuntimeState {
  enabled: boolean
  bridge: ActionbookBridgeState
  token: string | null
  tokenSource: ActionbookTokenSource
  checks: ActionbookPrereqStatus
  milestones: ActionbookMilestone[]
  logs: ActionbookLogEntry[]
  lastStatusMessage?: string | null
  lastPingMessage?: string | null
  lastError?: string | null
}

export type ActionbookEvent = {
  type: "state"
  state: ActionbookRuntimeState
}
