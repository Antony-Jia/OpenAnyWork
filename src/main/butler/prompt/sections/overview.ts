import type { ButlerDispatchPolicy } from "../../prompt"
import type { ButlerPromptSectionBuilder } from "../composer"

function formatDispatchPolicy(policy?: ButlerDispatchPolicy): string[] {
  if (policy === "single_task_first") {
    return [
      "single_task_first",
      "默认将单一业务目标编排为 1 个任务；把步骤写入同一任务的 initialPrompt/loopConfig.contentTemplate。",
      "仅当存在两个及以上语义独立、可独立交付、失败互不影响的目标时，才允许拆分。"
    ]
  }

  return [
    "standard",
    "可创建多个任务，但只有在目标语义独立时才拆分；避免把同一目标的执行步骤拆成 DAG。"
  ]
}

export function buildOverviewSection(): ButlerPromptSectionBuilder {
  return {
    id: "overview",
    build: ({ prompt }) => [
      "[User Request]",
      prompt.userMessage.trim(),
      "",
      "[Locked Task Body Rule]",
      "用户任务主体必须以 [User Request] 原文为准，禁止改写、替换或弱化。",
      "initialPrompt 只能补充执行说明与用户习惯，不得改变主体目标与约束。",
      "",
      "[Planning Focus]",
      prompt.planningFocus || "normal",
      "",
      "[Dispatch Policy]",
      ...formatDispatchPolicy(prompt.dispatchPolicy)
    ]
  }
}
