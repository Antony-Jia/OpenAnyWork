import { IpcMain } from "electron"
import {
  createSkill,
  deleteSkill,
  getSkillContent,
  installSkillFromPath,
  listAppSkills,
  saveSkillContent
} from "../skills"

export function registerSkillHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("skills:list", async () => {
    return listAppSkills()
  })

  ipcMain.handle(
    "skills:create",
    async (_event, input: { name: string; description: string; content?: string }) => {
      return createSkill(input)
    }
  )

  ipcMain.handle("skills:install", async (_event, input: { path: string }) => {
    return installSkillFromPath(input.path)
  })

  ipcMain.handle("skills:delete", async (_event, name: string) => {
    deleteSkill(name)
  })

  ipcMain.handle("skills:getContent", async (_event, name: string) => {
    return getSkillContent(name)
  })

  ipcMain.handle(
    "skills:saveContent",
    async (_event, input: { name: string; content: string }) => {
      return saveSkillContent(input.name, input.content)
    }
  )
}
