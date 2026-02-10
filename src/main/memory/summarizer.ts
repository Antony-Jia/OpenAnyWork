import type { TaskCompletionPayload } from "../tasks/lifecycle"
import type { MemoryTaskSummaryInput } from "./types"

export interface TaskSummarySource {
  payload: TaskCompletionPayload
  userMessages: string[]
  assistantMessages: string[]
  toolNames: string[]
}

function firstMatch(
  text: string,
  mapping: Array<{ label: string; patterns: RegExp[] }>
): string | undefined {
  for (const item of mapping) {
    if (item.patterns.some((pattern) => pattern.test(text))) {
      return item.label
    }
  }
  return undefined
}

function compact(text: string, maxLength: number): string {
  const value = text.trim().replace(/\s+/g, " ")
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

export function summarizeTaskMemory(source: TaskSummarySource): MemoryTaskSummaryInput {
  const { payload, userMessages, assistantMessages, toolNames } = source
  const allText = `${userMessages.join(" ")} ${assistantMessages.join(" ")}`.toLowerCase()

  const taskDirection =
    firstMatch(allText, [
      {
        label: "研发编码",
        patterns: [/代码|bug|debug|test|typescript|javascript|python|api|数据库|sql/]
      },
      { label: "调研分析", patterns: [/调研|research|对比|分析|benchmark|评估|报告/] },
      { label: "邮件任务", patterns: [/邮件|email|smtp|imap|回复/] }
    ]) ??
    (payload.mode === "email" ? "邮件任务" : payload.mode === "loop" ? "自动化任务" : "通用任务")

  const usageHabits =
    firstMatch(allText, [
      { label: "偏好多轮迭代", patterns: [/继续|迭代|优化|refactor|改进/] },
      { label: "偏好快速结论", patterns: [/总结|结论|简短|直接给出/] },
      { label: "偏好可执行落地", patterns: [/实现|落地|部署|运行|执行/] }
    ]) ?? (payload.metadata.disableApprovals ? "倾向无审批连续执行" : "标准交互")

  const hobbies = firstMatch(allText, [
    { label: "偏好技术与工具", patterns: [/ai|工具|工程|开发|开源/] },
    { label: "偏好内容写作", patterns: [/写作|文案|润色|翻译/] },
    { label: "偏好数据洞察", patterns: [/数据|图表|指标|统计|dashboard/] }
  ])

  const reportPreference =
    firstMatch(allText, [
      { label: "表格", patterns: [/表格|table|csv/] },
      { label: "数据", patterns: [/数据|统计|指标|数字|json/] },
      { label: "页面", patterns: [/页面|ui|界面|dashboard|html/] }
    ]) ?? "文本"

  const researchProcess =
    firstMatch(toolNames.join(" ").toLowerCase(), [
      { label: "工具驱动调研", patterns: [/search|grep|read_file|glob|mcp/] },
      { label: "自动化循环", patterns: [/loop|cron|watch/] },
      { label: "交互式执行", patterns: [/execute|send_email/] }
    ]) ?? "常规对话分析"

  const lastAssistant = assistantMessages[assistantMessages.length - 1] || payload.result || ""
  const firstUser = userMessages[0] || ""
  const summaryBrief = compact(lastAssistant || firstUser || "任务已完成。", 220)

  const summaryDetail = [
    `模式: ${payload.mode}`,
    payload.title ? `标题: ${payload.title}` : null,
    firstUser ? `用户起始需求: ${compact(firstUser, 280)}` : null,
    lastAssistant ? `最终结果: ${compact(lastAssistant, 600)}` : null,
    toolNames.length > 0 ? `过程工具: ${toolNames.join(", ")}` : null,
    payload.error ? `异常: ${payload.error}` : null
  ]
    .filter(Boolean)
    .join("\n")

  return {
    threadId: payload.threadId,
    mode: payload.mode,
    title: payload.title,
    summaryBrief,
    summaryDetail,
    taskDirection,
    usageHabits,
    hobbies,
    researchProcess,
    reportPreference,
    createdAt: payload.finishedAt
  }
}
