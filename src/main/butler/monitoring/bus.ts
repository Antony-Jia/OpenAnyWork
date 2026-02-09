import { EventEmitter } from "events"
import type { ButlerMonitorBusEvent } from "../../types"

const EVENT_NAME = "butler-monitor:event"

export class ButlerMonitorBus {
  private readonly emitter = new EventEmitter()

  emit(event: ButlerMonitorBusEvent): void {
    this.emitter.emit(EVENT_NAME, event)
  }

  onEvent(listener: (event: ButlerMonitorBusEvent) => void): () => void {
    this.emitter.on(EVENT_NAME, listener)
    return () => this.emitter.off(EVENT_NAME, listener)
  }
}
