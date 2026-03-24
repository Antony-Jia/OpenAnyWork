import type { ActionbookEvent, ActionbookPrereqStatus, ActionbookRuntimeState } from "../core/contracts"
import { checkActionbookPrerequisites } from "./checks"

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
      message: "Not checked."
    }
  }
}

export class ActionbookPluginService {
  private readonly emit: (event: ActionbookEvent) => void
  private state: ActionbookRuntimeState

  constructor(params: { enabled: boolean; emit: (event: ActionbookEvent) => void }) {
    this.emit = params.emit
    this.state = {
      enabled: params.enabled,
      checks: createDefaultChecks(),
      lastError: null
    }
  }

  getState(): ActionbookRuntimeState {
    return JSON.parse(JSON.stringify(this.state)) as ActionbookRuntimeState
  }

  async setEnabled(enabled: boolean): Promise<ActionbookRuntimeState> {
    this.state.enabled = enabled
    this.emitState()
    return this.getState()
  }

  async refreshChecks(): Promise<ActionbookRuntimeState> {
    try {
      this.state.checks = await checkActionbookPrerequisites()
      this.state.lastError = null
    } catch (error) {
      this.state.lastError =
        error instanceof Error ? error.message : "Failed to refresh Actionbook checks."
    }
    this.emitState()
    return this.getState()
  }

  async shutdown(): Promise<void> {}

  shutdownNow(): void {}

  private emitState(): void {
    this.emit({
      type: "state",
      state: this.getState()
    })
  }
}
