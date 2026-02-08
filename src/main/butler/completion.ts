import { readdirSync, statSync } from "fs"
import { join } from "path"
import type { ButlerTask } from "../types"

export interface ButlerTaskCompletionCard {
  id: string
  threadId: string
  title: string
  resultBrief: string
  resultDetail: string
  completedAt: string
}

function scanFolder(workspacePath: string): string {
  try {
    const names = readdirSync(workspacePath).slice(0, 20)
    const files = names.filter((name) => {
      try {
        return statSync(join(workspacePath, name)).isFile()
      } catch {
        return false
      }
    })
    const dirs = names.filter((name) => {
      try {
        return statSync(join(workspacePath, name)).isDirectory()
      } catch {
        return false
      }
    })
    return `目录扫描: 文件 ${files.length} 个，目录 ${dirs.length} 个。样例: ${names.slice(0, 6).join(", ")}`
  } catch {
    return "目录扫描失败或目录不可访问。"
  }
}

function compact(text: string, max = 220): string {
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}

export function buildTaskCompletionCard(params: {
  task: ButlerTask
  result?: string
  error?: string
}): ButlerTaskCompletionCard {
  const { task, result, error } = params
  const brief = compact(error ? `任务失败: ${error}` : result || "任务已完成。")
  const detail = [
    `任务: ${task.title}`,
    `模式: ${task.mode}`,
    `状态: ${error ? "failed" : "completed"}`,
    result ? `结果: ${compact(result, 500)}` : null,
    error ? `错误: ${compact(error, 500)}` : null,
    scanFolder(task.workspacePath)
  ]
    .filter(Boolean)
    .join("\n")

  return {
    id: task.id,
    threadId: task.threadId,
    title: task.title,
    resultBrief: brief,
    resultDetail: detail,
    completedAt: new Date().toISOString()
  }
}
