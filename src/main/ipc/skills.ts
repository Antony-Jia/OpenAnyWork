import { IpcMain } from "electron"
import {
  createSkill,
  deleteSkill,
  getSkillBundle,
  getSkillContent,
  installSkillFromPath,
  listAppSkills,
  scanAndImportAgentUserSkills,
  saveSkillContent,
  updateSkillFiles,
  updateSkillEnabled
} from "../skills"
import {
  cliAddSkill,
  cliCheckSkills,
  cliFindSkills,
  cliInitSkill,
  cliListSkills,
  cliRemoveSkills,
  cliUpdateSkills
} from "../skills-cli"
import { logEntry, logExit, withSpan } from "../logging"
import type { CapabilityScope } from "../types"

export function registerSkillHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("skills:list", async () => {
    return withSpan("IPC", "skills:list", undefined, async () => listAppSkills())
  })

  ipcMain.handle("skills:scan", async () => {
    return withSpan("IPC", "skills:scan", undefined, async () => scanAndImportAgentUserSkills())
  })

  ipcMain.handle(
    "skills:create",
    async (
      _event,
      input: {
        name: string
        description: string
        content?: string
        files?: Array<{ path: string; content: string }>
      }
    ) => {
      return withSpan(
        "IPC",
        "skills:create",
        {
          name: input.name,
          contentLength: input.content?.length ?? 0,
          files: input.files?.length ?? 0
        },
        async () => createSkill(input)
      )
    }
  )

  ipcMain.handle("skills:install", async (_event, input: { path: string }) => {
    return withSpan("IPC", "skills:install", { path: input.path }, async () =>
      installSkillFromPath(input.path)
    )
  })

  ipcMain.handle("skills:delete", async (_event, name: string) => {
    logEntry("IPC", "skills:delete", { name })
    deleteSkill(name)
    logExit("IPC", "skills:delete", { name })
  })

  ipcMain.handle("skills:setEnabled", async (_event, input: { name: string; enabled: boolean }) => {
    return withSpan("IPC", "skills:setEnabled", { name: input.name }, async () =>
      updateSkillEnabled(input.name, input.enabled)
    )
  })

  ipcMain.handle(
    "skills:setEnabledScope",
    async (_event, input: { name: string; enabled: boolean; scope: CapabilityScope }) => {
      return withSpan(
        "IPC",
        "skills:setEnabledScope",
        { name: input.name, scope: input.scope },
        async () => updateSkillEnabled(input.name, input.enabled, input.scope)
      )
    }
  )

  ipcMain.handle("skills:getContent", async (_event, name: string) => {
    return withSpan("IPC", "skills:getContent", { name }, async () => getSkillContent(name))
  })

  ipcMain.handle("skills:getBundle", async (_event, id: string) => {
    return withSpan("IPC", "skills:getBundle", { id }, async () => getSkillBundle(id))
  })

  ipcMain.handle("skills:saveContent", async (_event, input: { name: string; content: string }) => {
    return withSpan(
      "IPC",
      "skills:saveContent",
      { name: input.name, contentLength: input.content.length },
      async () => saveSkillContent(input.name, input.content)
    )
  })

  ipcMain.handle(
    "skills:update",
    async (
      _event,
      input: {
        id: string
        upsert?: Array<{ path: string; content: string }>
        remove?: string[]
      }
    ) => {
      return withSpan(
        "IPC",
        "skills:update",
        { id: input.id, upsert: input.upsert?.length ?? 0, remove: input.remove?.length ?? 0 },
        async () => updateSkillFiles(input)
      )
    }
  )

  ipcMain.handle(
    "skills:cliAdd",
    async (_event, input: { source: string; skillNames?: string[] }) => {
      return withSpan("IPC", "skills:cliAdd", { source: input.source }, async () =>
        cliAddSkill(input)
      )
    }
  )

  ipcMain.handle("skills:cliList", async () => {
    return withSpan("IPC", "skills:cliList", undefined, async () => cliListSkills())
  })

  ipcMain.handle("skills:cliFind", async (_event, input: { query: string }) => {
    return withSpan("IPC", "skills:cliFind", { query: input.query }, async () =>
      cliFindSkills(input.query)
    )
  })

  ipcMain.handle("skills:cliRemove", async (_event, input: { names: string[] }) => {
    return withSpan("IPC", "skills:cliRemove", { count: input.names.length }, async () =>
      cliRemoveSkills(input.names)
    )
  })

  ipcMain.handle("skills:cliCheck", async () => {
    return withSpan("IPC", "skills:cliCheck", undefined, async () => cliCheckSkills())
  })

  ipcMain.handle("skills:cliUpdate", async () => {
    return withSpan("IPC", "skills:cliUpdate", undefined, async () => cliUpdateSkills())
  })

  ipcMain.handle("skills:cliInit", async (_event, input: { name: string }) => {
    return withSpan("IPC", "skills:cliInit", { name: input.name }, async () =>
      cliInitSkill(input.name)
    )
  })
}
