import type { ButlerPromptSectionBuilder } from "../composer"

export function buildRetrySection(): ButlerPromptSectionBuilder {
  return {
    id: "retry",
    build: ({ prompt }) => {
      if (prompt.planningFocus !== "retry_reassign" || !prompt.retryContext) {
        return []
      }

      const retry = prompt.retryContext
      return [
        "[Retry Reassign Context]",
        `failed_task_title: ${retry.failedTaskTitle}`,
        `failed_task_mode: ${retry.failedTaskMode}`,
        `forced_mode: ${prompt.forcedMode ?? retry.failedTaskMode}`,
        "",
        "[Failed Task Prompt]",
        retry.failedTaskPrompt,
        "",
        "[Failure Error]",
        retry.failureError,
        "",
        "[Original User Request For Retry]",
        retry.originUserMessage,
        "",
        "[Retry Hard Constraints]",
        "- 只能创建 1 个任务。",
        "- mode 必须与 failed_task_mode 完全一致。",
        "- 用户任务主体必须保持为原始请求，不得改写、弱化、替换。",
        "- 新 initialPrompt 只能追加错误根因与修复动作，不得重写任务主体。"
      ]
    }
  }
}
