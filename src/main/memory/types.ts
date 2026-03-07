import type {
  ButlerRoundKind,
  ButlerRoundSourceType,
  ButlerTask,
  MemoryEntityType,
  MemoryRangePreset,
  MemorySourceType,
  ThreadMode
} from "../types"

export interface MemoryTaskSummaryInput {
  threadId: string
  mode: ThreadMode
  title?: string
  summaryBrief: string
  summaryDetail: string
  taskDirection?: string
  usageHabits?: string
  hobbies?: string
  researchProcess?: string
  reportPreference?: string
  createdAt?: string
}

export interface MemoryTaskSummaryRow {
  id: string
  threadId: string
  mode: ThreadMode
  title?: string
  summaryBrief: string
  summaryDetail: string
  taskDirection?: string
  usageHabits?: string
  hobbies?: string
  researchProcess?: string
  reportPreference?: string
  createdAt: string
}

export interface DailyProfileInput {
  day: string
  profileText: string
  comparisonText: string
  previousProfileDay?: string
  createdAt?: string
}

export interface DailyProfileRow {
  day: string
  profileText: string
  comparisonText: string
  previousProfileDay?: string
  createdAt: string
}

export interface ButlerMessageInput {
  id: string
  role: "user" | "assistant"
  content: string
  ts: string
  kind?: ButlerRoundKind
  sourceType?: ButlerRoundSourceType
  relatedThreadId?: string
  relatedTaskId?: string
  noticeType?: "task" | "event" | "digest"
  metadata?: Record<string, unknown>
}

export interface ButlerMessageRow extends ButlerMessageInput {}

export interface ButlerTaskRow {
  id: string
  payload: ButlerTask
}

export interface WorkingMemorySnapshotInput {
  id?: string
  updatedAt?: string
  budgetChars: number
  recentOverview: string
  last24hMessages: string
  habits: string
  preferences: string
  facts: string
  openLoops: string
  toolingLearnings: string
  recentTaskOutcomes: string
  text: string
}

export interface WorkingMemorySnapshotRow extends WorkingMemorySnapshotInput {
  id: string
  updatedAt: string
}

export interface MemoryEventInput {
  sourceType: MemorySourceType
  sourceId: string
  occurredAt?: string
  category: string
  title: string
  summary: string
  detail?: string
  threadId?: string
  taskId?: string
  keywords?: string[]
  metadata?: Record<string, unknown>
}

export interface MemoryEventRow {
  id: string
  sourceType: MemorySourceType
  sourceId: string
  occurredAt: string
  day: string
  category: string
  title: string
  summary: string
  detail: string
  threadId?: string
  taskId?: string
  keywords: string[]
  metadata?: Record<string, unknown>
}

export interface MemoryEntityUpsertInput {
  type: MemoryEntityType
  name: string
  value: string
  confidence: number
  seenAt?: string
  sourceRef: string
  metadata?: Record<string, unknown>
}

export interface MemoryEntityRow {
  id: string
  type: MemoryEntityType
  name: string
  value: string
  confidence: number
  firstSeenAt: string
  lastSeenAt: string
  evidenceCount: number
  sourceRefs: string[]
  metadata?: Record<string, unknown>
}

export interface MemoryRangeSummaryInput {
  rangeKey: string
  from: string
  to: string
  preset?: MemoryRangePreset
  categories: string[]
  summaryText: string
  highlights: string[]
  eventCount: number
  generatedAt?: string
}

export interface MemoryRangeSummaryRow extends MemoryRangeSummaryInput {
  id: string
  generatedAt: string
}
