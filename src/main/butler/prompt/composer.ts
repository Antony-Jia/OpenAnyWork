import type { ButlerPromptContext } from "../prompt"
import { buildCapabilitiesSection } from "./sections/capabilities"
import { buildMemorySection } from "./sections/memory"
import { buildOverviewSection } from "./sections/overview"
import { buildRetrySection } from "./sections/retry"
import { buildRouterSection } from "./sections/router"

export interface ButlerPromptSectionContext {
  prompt: ButlerPromptContext
  clarificationPrefix: string
}

export interface ButlerPromptSectionBuilder {
  id: "overview" | "memory" | "router" | "capabilities" | "retry" | (string & {})
  build: (context: ButlerPromptSectionContext) => string[]
}

const DEFAULT_SECTION_PIPELINE: ButlerPromptSectionBuilder[] = [
  buildOverviewSection(),
  buildRetrySection(),
  buildMemorySection(),
  buildRouterSection(),
  buildCapabilitiesSection()
]

function trimTrailingEmptyLines(lines: string[]): string[] {
  let end = lines.length
  while (end > 0 && lines[end - 1] === "") {
    end -= 1
  }
  return lines.slice(0, end)
}

export function composeButlerUserPrompt(
  prompt: ButlerPromptContext,
  options?: {
    clarificationPrefix?: string
    sections?: ButlerPromptSectionBuilder[]
  }
): string {
  const sectionBuilders = options?.sections ?? DEFAULT_SECTION_PIPELINE
  const context: ButlerPromptSectionContext = {
    prompt,
    clarificationPrefix: options?.clarificationPrefix ?? "CLARIFICATION_REQUIRED:"
  }

  const output: string[] = []
  for (const section of sectionBuilders) {
    const sectionLines = trimTrailingEmptyLines(section.build(context))
    if (sectionLines.length === 0) continue
    if (output.length > 0) {
      output.push("")
    }
    output.push(...sectionLines)
  }

  return output.join("\n")
}

export function getDefaultButlerPromptSections(): ButlerPromptSectionBuilder[] {
  return [...DEFAULT_SECTION_PIPELINE]
}
