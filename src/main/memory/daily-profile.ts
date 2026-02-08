import type { DailyProfileInput, MemoryTaskSummaryRow } from "./types"

function toLocalDay(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getTodayLocalDay(now = new Date()): string {
  return toLocalDay(now)
}

export function getYesterdayLocalDay(now = new Date()): string {
  const copy = new Date(now)
  copy.setDate(copy.getDate() - 1)
  return toLocalDay(copy)
}

function topLabel(
  summaries: MemoryTaskSummaryRow[],
  key: keyof Pick<
    MemoryTaskSummaryRow,
    "taskDirection" | "usageHabits" | "hobbies" | "researchProcess" | "reportPreference"
  >,
  fallback: string
): string {
  const stats = new Map<string, number>()
  for (const item of summaries) {
    const value = item[key]
    if (!value) continue
    stats.set(value, (stats.get(value) ?? 0) + 1)
  }
  let result = fallback
  let best = -1
  for (const [label, count] of stats.entries()) {
    if (count > best) {
      best = count
      result = label
    }
  }
  return result
}

export function buildDailyProfileInput(params: {
  day: string
  summaries: MemoryTaskSummaryRow[]
  previousProfileDay?: string
  previousProfileText?: string
}): DailyProfileInput {
  const { day, summaries, previousProfileDay, previousProfileText } = params
  const direction = topLabel(summaries, "taskDirection", "任务方向未显著集中")
  const habit = topLabel(summaries, "usageHabits", "使用习惯仍在形成")
  const hobby = topLabel(summaries, "hobbies", "兴趣偏好未显著显现")
  const process = topLabel(summaries, "researchProcess", "调研流程以常规对话为主")
  const reportPreference = topLabel(summaries, "reportPreference", "文本")

  const profileText = [
    `日期 ${day} 用户侧写：`,
    `任务方向: ${direction}`,
    `使用习惯: ${habit}`,
    `爱好偏向: ${hobby}`,
    `调研过程: ${process}`,
    `报告偏好: ${reportPreference}`,
    `有效任务数: ${summaries.length}`
  ].join("\n")

  let comparisonText = "无历史画像，无法比较变化。"
  if (previousProfileText && previousProfileDay) {
    const changed =
      previousProfileText.includes(direction) &&
      previousProfileText.includes(habit) &&
      previousProfileText.includes(reportPreference)
        ? "整体偏好与上次保持稳定。"
        : "与上次相比出现了任务方向或输出偏好的变化。"
    comparisonText = [`对比 ${previousProfileDay}:`, changed].join("\n")
  }

  return {
    day,
    profileText,
    comparisonText,
    previousProfileDay
  }
}
