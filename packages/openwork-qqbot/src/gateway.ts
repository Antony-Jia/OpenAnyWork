import type { QQGateway, QQInboundEvent } from "./types.js"

export class MockQQGateway implements QQGateway {
  private listener?: (event: QQInboundEvent) => Promise<void>

  setListener(listener: (event: QQInboundEvent) => Promise<void>): void {
    this.listener = listener
  }

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async push(event: QQInboundEvent): Promise<void> {
    await this.listener?.(event)
  }
}
