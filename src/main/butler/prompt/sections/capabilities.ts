import type { ButlerPromptSectionBuilder } from "../composer"

export function buildCapabilitiesSection(): ButlerPromptSectionBuilder {
  return {
    id: "capabilities",
    build: ({ prompt }) => [
      "[Capability Summary]",
      prompt.capabilitySummary?.trim() || "none",
      "",
      prompt.capabilityCatalog?.trim() || "[Butler Capability Catalog]\nnone"
    ]
  }
}
