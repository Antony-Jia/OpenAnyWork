import { BrowserWindow, dialog, type IpcMain } from "electron"
import type {
  KnowledgebaseDeleteCollectionRequest,
  KnowledgebaseDeleteDocumentRequest,
  KnowledgebaseCreateCollectionRequest,
  KnowledgebaseConfigUpdate,
  KnowledgebaseUploadRequest,
  PluginEnableUpdateParams
} from "./core/contracts"
import { pluginHost } from "./core/host"
import { withSpan } from "../logging"

const ACTIONBOOK_EVENT_CHANNEL = "plugins:actionbook:event"
const KNOWLEDGEBASE_EVENT_CHANNEL = "plugins:knowledgebase:event"

export function registerPluginsIpc(ipcMain: IpcMain): () => void {
  void pluginHost.hydrateFromSettings()

  ipcMain.handle("plugins:list", async () => {
    return withSpan("IPC", "plugins:list", undefined, async () => pluginHost.listPlugins())
  })

  ipcMain.handle("plugins:setEnabled", async (_event, input: PluginEnableUpdateParams) => {
    return withSpan(
      "IPC",
      "plugins:setEnabled",
      { id: input.id, enabled: input.enabled },
      async () => pluginHost.setEnabled(input)
    )
  })

  ipcMain.handle("plugins:actionbook:getState", async () => {
    return withSpan("IPC", "plugins:actionbook:getState", undefined, async () =>
      pluginHost.getActionbookState()
    )
  })

  ipcMain.handle("plugins:actionbook:refreshChecks", async () => {
    return withSpan("IPC", "plugins:actionbook:refreshChecks", undefined, async () =>
      pluginHost.refreshActionbookChecks()
    )
  })

  ipcMain.handle("plugins:actionbook:start", async () => {
    return withSpan("IPC", "plugins:actionbook:start", undefined, async () =>
      pluginHost.startActionbookBridge()
    )
  })

  ipcMain.handle("plugins:actionbook:stop", async () => {
    return withSpan("IPC", "plugins:actionbook:stop", undefined, async () =>
      pluginHost.stopActionbookBridge()
    )
  })

  ipcMain.handle("plugins:actionbook:status", async () => {
    return withSpan("IPC", "plugins:actionbook:status", undefined, async () =>
      pluginHost.runActionbookStatus()
    )
  })

  ipcMain.handle("plugins:actionbook:ping", async () => {
    return withSpan("IPC", "plugins:actionbook:ping", undefined, async () =>
      pluginHost.runActionbookPing()
    )
  })

  ipcMain.handle("plugins:knowledgebase:getState", async () => {
    return withSpan("IPC", "plugins:knowledgebase:getState", undefined, async () =>
      pluginHost.getKnowledgebaseState()
    )
  })

  ipcMain.handle(
    "plugins:knowledgebase:updateConfig",
    async (_event, input: KnowledgebaseConfigUpdate) => {
      return withSpan("IPC", "plugins:knowledgebase:updateConfig", { ...(input ?? {}) }, async () =>
        pluginHost.updateKnowledgebaseConfig(input ?? {})
      )
    }
  )

  ipcMain.handle("plugins:knowledgebase:pickExe", async () => {
    return withSpan("IPC", "plugins:knowledgebase:pickExe", undefined, async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        title: "Select Knowledge Base Daemon Executable",
        filters:
          process.platform === "win32"
            ? [
                {
                  name: "Executable",
                  extensions: ["exe"]
                }
              ]
            : undefined
      })
      if (result.canceled || result.filePaths.length === 0) return null
      const selectedPath = result.filePaths[0]
      await pluginHost.updateKnowledgebaseConfig({ daemonExePath: selectedPath })
      return selectedPath
    })
  })

  ipcMain.handle("plugins:knowledgebase:pickDataDir", async () => {
    return withSpan("IPC", "plugins:knowledgebase:pickDataDir", undefined, async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
        title: "Select Knowledge Base Data Directory"
      })
      if (result.canceled || result.filePaths.length === 0) return null
      const selectedPath = result.filePaths[0]
      await pluginHost.updateKnowledgebaseConfig({ dataDir: selectedPath })
      return selectedPath
    })
  })

  ipcMain.handle("plugins:knowledgebase:pickUploadFiles", async () => {
    return withSpan("IPC", "plugins:knowledgebase:pickUploadFiles", undefined, async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
        title: "Select Documents to Upload",
        filters: [
          {
            name: "Documents",
            extensions: ["txt", "pdf", "docx"]
          }
        ]
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths
    })
  })

  ipcMain.handle("plugins:knowledgebase:uploadDocuments", async (_event, input: KnowledgebaseUploadRequest) => {
    return withSpan(
      "IPC",
      "plugins:knowledgebase:uploadDocuments",
      { collectionId: input?.collectionId, fileCount: input?.filePaths?.length ?? 0, poll: input?.poll },
      async () => pluginHost.uploadKnowledgebaseDocuments(input)
    )
  })

  ipcMain.handle("plugins:knowledgebase:start", async () => {
    return withSpan("IPC", "plugins:knowledgebase:start", undefined, async () =>
      pluginHost.startKnowledgebaseDaemon()
    )
  })

  ipcMain.handle("plugins:knowledgebase:stop", async () => {
    return withSpan("IPC", "plugins:knowledgebase:stop", undefined, async () =>
      pluginHost.stopKnowledgebaseDaemon()
    )
  })

  ipcMain.handle("plugins:knowledgebase:refresh", async () => {
    return withSpan("IPC", "plugins:knowledgebase:refresh", undefined, async () =>
      pluginHost.refreshKnowledgebaseStatus()
    )
  })

  ipcMain.handle("plugins:knowledgebase:storageStatus", async () => {
    return withSpan("IPC", "plugins:knowledgebase:storageStatus", undefined, async () =>
      pluginHost.getKnowledgebaseStorageStatus()
    )
  })

  ipcMain.handle("plugins:knowledgebase:listCollections", async () => {
    return withSpan("IPC", "plugins:knowledgebase:listCollections", undefined, async () =>
      pluginHost.listKnowledgebaseCollections()
    )
  })

  ipcMain.handle(
    "plugins:knowledgebase:createCollection",
    async (_event, input: KnowledgebaseCreateCollectionRequest) => {
      return withSpan(
        "IPC",
        "plugins:knowledgebase:createCollection",
        { name: input?.name },
        async () => pluginHost.createKnowledgebaseCollection(input)
      )
    }
  )

  ipcMain.handle(
    "plugins:knowledgebase:deleteDocument",
    async (_event, input: KnowledgebaseDeleteDocumentRequest) => {
      return withSpan(
        "IPC",
        "plugins:knowledgebase:deleteDocument",
        { documentId: input?.documentId, poll: input?.poll },
        async () => pluginHost.deleteKnowledgebaseDocument(input)
      )
    }
  )

  ipcMain.handle(
    "plugins:knowledgebase:deleteCollection",
    async (_event, input: KnowledgebaseDeleteCollectionRequest) => {
      return withSpan(
        "IPC",
        "plugins:knowledgebase:deleteCollection",
        {
          collectionId: input?.collectionId,
          poll: input?.poll,
          cascadeDocuments: input?.cascadeDocuments
        },
        async () => pluginHost.deleteKnowledgebaseCollection(input)
      )
    }
  )

  ipcMain.handle(
    "plugins:knowledgebase:listDocuments",
    async (_event, input: { collectionId: string; limit?: number; offset?: number }) => {
      return withSpan("IPC", "plugins:knowledgebase:listDocuments", input, async () =>
        pluginHost.listKnowledgebaseDocuments(input.collectionId, input.limit, input.offset)
      )
    }
  )

  ipcMain.handle(
    "plugins:knowledgebase:listChunks",
    async (_event, input: { documentId: string; limit?: number; offset?: number }) => {
      return withSpan("IPC", "plugins:knowledgebase:listChunks", input, async () =>
        pluginHost.listKnowledgebaseChunks(input.documentId, input.limit, input.offset)
      )
    }
  )

  ipcMain.handle("plugins:knowledgebase:openDataDir", async () => {
    return withSpan("IPC", "plugins:knowledgebase:openDataDir", undefined, async () => {
      await pluginHost.openKnowledgebaseDataDir()
      return true
    })
  })

  const unsubscribe = pluginHost.onActionbookEvent((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(ACTIONBOOK_EVENT_CHANNEL, event)
    }
  })

  const unsubscribeKnowledgebase = pluginHost.onKnowledgebaseEvent((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(KNOWLEDGEBASE_EVENT_CHANNEL, event)
    }
  })

  return () => {
    unsubscribe()
    unsubscribeKnowledgebase()
  }
}
