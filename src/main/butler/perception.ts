import type { ButlerPerceptionInput, TaskCompletionNotice } from "../types"

export interface ButlerPerceptionGateway {
  ingest(input: ButlerPerceptionInput): Promise<TaskCompletionNotice>
}
