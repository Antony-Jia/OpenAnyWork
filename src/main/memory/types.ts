import type { ThreadMode, ButlerTask } from "../types"

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
}

export interface ButlerMessageRow extends ButlerMessageInput {}

export interface ButlerTaskRow {
  id: string
  payload: ButlerTask
}
