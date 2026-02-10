import { EventEmitter } from "node:events"
import { getSettings, updateSettings } from "../../settings"
import { ActionbookPluginService } from "../actionbook/service"
import type {
  ActionbookEvent,
  ActionbookRuntimeState,
  PluginEnableUpdateParams,
  PresetPluginId,
  PresetPluginItem
} from "./contracts"
import { buildPresetPluginItems } from "./registry"

const ACTIONBOOK_EVENT_NAME = "plugins:actionbook:event"

function resolvePluginEnabledMap(): Record<PresetPluginId, boolean> {
  const settings = getSettings()
  return {
    actionbook: !!settings.plugins?.actionbook?.enabled
  }
}

function writePluginEnabledState(input: Record<PresetPluginId, boolean>): void {
  updateSettings({
    plugins: {
      actionbook: {
        enabled: !!input.actionbook
      }
    }
  })
}

export class PluginHost {
  private readonly emitter = new EventEmitter()
  private readonly actionbook: ActionbookPluginService
  private hydrated = false

  constructor() {
    this.actionbook = new ActionbookPluginService({
      enabled: false,
      emit: (event) => {
        this.emitter.emit(ACTIONBOOK_EVENT_NAME, event)
      }
    })
  }

  async hydrateFromSettings(): Promise<void> {
    if (this.hydrated) return
    const enabledMap = resolvePluginEnabledMap()
    await this.actionbook.setEnabled(enabledMap.actionbook)
    await this.actionbook.refreshChecks()
    this.hydrated = true
  }

  listPlugins(): PresetPluginItem[] {
    return buildPresetPluginItems(resolvePluginEnabledMap())
  }

  async setEnabled(input: PluginEnableUpdateParams): Promise<PresetPluginItem> {
    await this.hydrateFromSettings()
    const enabledMap = resolvePluginEnabledMap()
    enabledMap[input.id] = input.enabled
    writePluginEnabledState(enabledMap)

    if (input.id === "actionbook") {
      await this.actionbook.setEnabled(input.enabled)
      if (input.enabled) {
        await this.actionbook.refreshChecks()
      }
    }

    const plugin = this.listPlugins().find((item) => item.id === input.id)
    if (!plugin) {
      throw new Error(`Unknown plugin id: ${input.id}`)
    }
    return plugin
  }

  async getActionbookState(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.getState()
  }

  async refreshActionbookChecks(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.refreshChecks()
  }

  async startActionbookBridge(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.startBridge()
  }

  async stopActionbookBridge(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.stopBridge()
  }

  async runActionbookStatus(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.runStatusCheck()
  }

  async runActionbookPing(): Promise<ActionbookRuntimeState> {
    await this.hydrateFromSettings()
    return this.actionbook.runPingCheck()
  }

  onActionbookEvent(listener: (event: ActionbookEvent) => void): () => void {
    this.emitter.on(ACTIONBOOK_EVENT_NAME, listener)
    return () => this.emitter.off(ACTIONBOOK_EVENT_NAME, listener)
  }

  async shutdown(): Promise<void> {
    await this.actionbook.shutdown()
  }

  shutdownNow(): void {
    this.actionbook.shutdownNow()
  }
}

export const pluginHost = new PluginHost()
