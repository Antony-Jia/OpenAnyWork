import { existsSync, readFileSync } from "node:fs"
import {
  ACTIONBOOK_BRIDGE_PORT,
  type ActionbookEvent,
  type ActionbookLogEntry,
  type ActionbookLogSource,
  type ActionbookMilestone,
  type ActionbookMilestoneType,
  type ActionbookPrereqStatus,
  type ActionbookRuntimeState
} from "../core/contracts"
import {
  checkActionbookCli,
  checkActionbookPrerequisites,
  readActionbookTokenFromFile,
  runActionbookCommand
} from "./checks"
import { ActionbookBridgeManager } from "./bridge-manager"
import {
  parseActionbookLine,
  parseActionbookPingLine,
  parseActionbookStatusLine,
  sanitizeActionbookOutput
} from "./parser"

const MAX_LOG_ENTRIES = 300
const MAX_MILESTONES = 120

function createDefaultChecks(): ActionbookPrereqStatus {
  return {
    checkedAt: new Date(0).toISOString(),
    cli: {
      ok: false,
      message: "Not checked."
    },
    skill: {
      ok: false,
      message: "Not checked."
    },
    extension: {
      ok: false,
      message: "Not checked.",
      bridgeRunning: false,
      extensionConnected: false
    }
  }
}

export class ActionbookPluginService {
  private readonly port: number
  private readonly emit: (event: ActionbookEvent) => void
  private readonly bridgeManager: ActionbookBridgeManager
  private sequence = 0
  private state: ActionbookRuntimeState

  constructor(params: { enabled: boolean; emit: (event: ActionbookEvent) => void; port?: number }) {
    this.port = params.port ?? ACTIONBOOK_BRIDGE_PORT
    this.emit = params.emit
    this.state = {
      enabled: params.enabled,
      bridge: {
        running: false,
        managed: false,
        port: this.port
      },
      token: null,
      tokenSource: null,
      checks: createDefaultChecks(),
      milestones: [],
      logs: [],
      lastStatusMessage: null,
      lastPingMessage: null,
      lastError: null
    }

    this.bridgeManager = new ActionbookBridgeManager({
      port: this.port,
      onLine: ({ source, line }) => {
        this.handleBridgeLine(source, line)
      },
      onExit: (code, signal) => {
        this.pushMilestone(
          "bridge_exited",
          code === 0,
          `Bridge exited (code=${code ?? "null"}, signal=${signal ?? "null"}).`
        )
        this.state.bridge = {
          ...this.state.bridge,
          running: false,
          managed: false,
          pid: undefined
        }
        this.emitState()
        void this.refreshChecks()
      },
      onError: (message) => {
        this.recordError(message)
      }
    })
  }

  getState(): ActionbookRuntimeState {
    return JSON.parse(JSON.stringify(this.state)) as ActionbookRuntimeState
  }

  async setEnabled(enabled: boolean): Promise<ActionbookRuntimeState> {
    this.state.enabled = enabled
    if (!enabled && this.bridgeManager.isRunning()) {
      await this.stopBridge()
    }
    this.emitState()
    return this.getState()
  }

  async refreshChecks(): Promise<ActionbookRuntimeState> {
    const checks = await checkActionbookPrerequisites(this.port)
    this.state.checks = checks
    if (checks.extension.statusMessage) {
      this.state.lastStatusMessage = checks.extension.statusMessage
    }
    if (checks.extension.pingMessage) {
      this.state.lastPingMessage = checks.extension.pingMessage
    }

    this.syncBridgeStateFromChecks(checks)
    this.applyTokenFromFileFallback()
    this.emitState()
    return this.getState()
  }

  async startBridge(): Promise<ActionbookRuntimeState> {
    if (!this.state.enabled) {
      this.recordError("Actionbook plugin is disabled.")
      return this.getState()
    }

    if (this.bridgeManager.isRunning()) {
      this.pushMilestone("bridge_started", true, "Managed bridge is already running.")
      this.emitState()
      return this.getState()
    }

    await this.refreshChecks()

    if (this.state.checks.extension.bridgeRunning) {
      this.pushMilestone(
        "bridge_started",
        false,
        "External bridge is already running. Managed start skipped."
      )
      this.syncBridgeStateFromChecks(this.state.checks)
      this.emitState()
      return this.getState()
    }

    const cli = await checkActionbookCli()
    if (!cli.ok) {
      this.recordError(cli.message)
      return this.getState()
    }

    const result = this.bridgeManager.start()
    this.pushSystemLog(result.message)
    this.pushMilestone("bridge_started", result.started, result.message)
    this.state.bridge = result.started
      ? {
          ...this.state.bridge,
          running: true,
          managed: true,
          pid: result.pid
        }
      : {
          ...this.state.bridge,
          running: false,
          managed: false,
          pid: undefined
        }
    this.state.lastError = result.started ? null : result.message
    if (result.started) {
      this.applyTokenFromFileFallback()
    }
    this.emitState()
    return this.getState()
  }

  async stopBridge(): Promise<ActionbookRuntimeState> {
    const result = await this.bridgeManager.stop()
    this.pushSystemLog(result.message)
    this.pushMilestone("bridge_stopped", result.stopped, result.message)
    await this.refreshChecks()
    return this.getState()
  }

  async runStatusCheck(): Promise<ActionbookRuntimeState> {
    const result = await runActionbookCommand(["extension", "status", "--port", String(this.port)])
    const parsed = parseActionbookStatusLine(result.output)
    this.state.lastStatusMessage = parsed.message
    this.pushMilestone(
      parsed.bridgeRunning ? "status_ok" : "status_fail",
      parsed.bridgeRunning,
      parsed.message
    )
    await this.refreshChecks()
    return this.getState()
  }

  async runPingCheck(): Promise<ActionbookRuntimeState> {
    const result = await runActionbookCommand(["extension", "ping", "--port", String(this.port)])
    const parsed = parseActionbookPingLine(result.output)
    this.state.lastPingMessage = parsed.message
    this.pushMilestone(parsed.connected ? "ping_ok" : "ping_fail", parsed.connected, parsed.message)
    await this.refreshChecks()
    return this.getState()
  }

  async shutdown(): Promise<void> {
    if (this.bridgeManager.isRunning()) {
      await this.bridgeManager.stop()
    }
  }

  private handleBridgeLine(source: ActionbookLogSource, rawLine: string): void {
    const line = sanitizeActionbookOutput(rawLine).trim()
    if (!line) return

    this.pushLog(source, line)
    const parsed = parseActionbookLine(line)

    if (parsed.websocketUrl) {
      this.state.bridge = {
        ...this.state.bridge,
        running: true,
        managed: true,
        pid: this.bridgeManager.getPid()
      }
      this.pushMilestone("bridge_started", true, `Bridge listening: ${parsed.websocketUrl}`)
    }

    if (parsed.waitingForExtension) {
      this.pushMilestone(
        "bridge_waiting_extension",
        true,
        "Bridge is waiting for extension connection."
      )
    }

    if (parsed.extensionPath) {
      this.state.checks.extension.path = parsed.extensionPath
    }
    if (parsed.extensionVersion) {
      this.state.checks.extension.version = parsed.extensionVersion
    }

    if (parsed.token) {
      this.setToken(parsed.token, "log")
      this.pushMilestone("token_found", true, "Session token captured from bridge logs.")
    } else if (parsed.tokenFilePath) {
      const tokenFromPath = this.readTokenAtPath(parsed.tokenFilePath)
      if (tokenFromPath) {
        this.setToken(tokenFromPath, "file")
        this.pushMilestone("token_file_found", true, "Session token loaded from token file path.")
      }
    }

    this.state.lastError = null
    this.emitState()
  }

  private syncBridgeStateFromChecks(checks: ActionbookPrereqStatus): void {
    if (this.bridgeManager.isRunning()) {
      this.state.bridge = {
        ...this.state.bridge,
        running: true,
        managed: true,
        pid: this.bridgeManager.getPid()
      }
      return
    }

    if (checks.extension.bridgeRunning) {
      this.state.bridge = {
        ...this.state.bridge,
        running: true,
        managed: false,
        pid: undefined
      }
      return
    }

    this.state.bridge = {
      ...this.state.bridge,
      running: false,
      managed: false,
      pid: undefined
    }
  }

  private applyTokenFromFileFallback(): void {
    if (this.state.token && this.state.tokenSource === "log") return

    const fileToken = readActionbookTokenFromFile()
    if (!fileToken) return
    this.setToken(fileToken.token, "file")
    this.pushMilestone("token_file_found", true, `Session token loaded from ${fileToken.path}`)
  }

  private setToken(token: string, source: "log" | "file"): void {
    if (this.state.token === token && this.state.tokenSource === source) {
      return
    }
    this.state.token = token
    this.state.tokenSource = source
  }

  private readTokenAtPath(tokenPath: string): string | null {
    if (!existsSync(tokenPath)) return null
    try {
      const token = readFileSync(tokenPath, "utf-8").trim()
      return token || null
    } catch {
      return null
    }
  }

  private pushLog(source: ActionbookLogSource, line: string): void {
    const entry: ActionbookLogEntry = {
      id: this.nextId("log"),
      at: new Date().toISOString(),
      source,
      line
    }
    this.state.logs = [...this.state.logs, entry].slice(-MAX_LOG_ENTRIES)
  }

  private pushSystemLog(line: string): void {
    this.pushLog("system", line)
  }

  private pushMilestone(type: ActionbookMilestoneType, ok: boolean, message: string): void {
    const last = this.state.milestones[this.state.milestones.length - 1]
    if (last && last.type === type && last.message === message) return

    const milestone: ActionbookMilestone = {
      id: this.nextId("milestone"),
      at: new Date().toISOString(),
      type,
      ok,
      message
    }
    this.state.milestones = [...this.state.milestones, milestone].slice(-MAX_MILESTONES)
  }

  private recordError(message: string): void {
    this.state.lastError = message
    this.pushSystemLog(message)
    this.pushMilestone("error", false, message)
    this.emitState()
  }

  private emitState(): void {
    this.emit({
      type: "state",
      state: this.getState()
    })
  }

  private nextId(prefix: string): string {
    this.sequence += 1
    return `${prefix}-${Date.now()}-${this.sequence}`
  }
}
