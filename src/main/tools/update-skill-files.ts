import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { updateSkillFiles } from "../skills"
import type { ToolDefinition } from "../types"

const updateSkillFilesSchema = z.object({
  skillId: z.string().trim().min(1),
  upsert: z
    .array(
      z.object({
        path: z.string().trim().min(1),
        content: z.string()
      })
    )
    .optional(),
  remove: z.array(z.string().trim().min(1)).optional()
})

export const updateSkillFilesDefinition: ToolDefinition = {
  name: "update_skill_files",
  label: "Update Skill Files",
  description:
    "Update text files inside an existing skill bundle by adding, replacing, or removing files.",
  requiresKey: false
}

export const updateSkillFilesTool = tool(
  async ({ skillId, upsert, remove }: z.infer<typeof updateSkillFilesSchema>) => {
    const bundle = updateSkillFiles({
      id: skillId,
      upsert,
      remove
    })

    return {
      ok: true,
      skill: {
        id: bundle.id,
        name: bundle.name,
        rootPath: bundle.rootPath
      },
      updatedPaths: (upsert ?? []).map((file) => file.path),
      removedPaths: remove ?? [],
      fileCount: bundle.files.length
    }
  },
  {
    name: updateSkillFilesDefinition.name,
    description: updateSkillFilesDefinition.description,
    schema: updateSkillFilesSchema
  }
)
