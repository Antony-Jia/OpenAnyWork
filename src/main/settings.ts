import type { AppSettings } from "./types"
import { getDb, markDbDirty } from "./db"
import { getOpenworkDir } from "./storage"
import { join } from "path"

const defaultSettings: AppSettings = {
  ralphIterations: 5,
  email: {
    enabled: false,
    from: "",
    to: [],
    smtp: {
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: ""
    },
    imap: {
      host: "",
      port: 993,
      secure: true,
      user: "",
      pass: ""
    },
    taskTag: "<OpenworkTask>",
    pollIntervalSec: 60
  },
  speech: {
    stt: {
      url: "",
      headers: {},
      language: ""
    },
    tts: {
      url: "",
      headers: {},
      voice: ""
    }
  },
  vision: {
    preprocessInterceptEnabled: true,
    toolCallingEnabled: true
  },
  defaultWorkspacePath: "",
  butler: {
    rootPath: join(getOpenworkDir(), "butler-workspaces"),
    maxConcurrent: 2,
    recentRounds: 5,
    monitorScanIntervalSec: 30,
    monitorPullIntervalSec: 60,
    serviceDigestIntervalMin: 1,
    mutedTaskIdentities: []
  },
  plugins: {
    actionbook: {
      enabled: false
    },
    knowledgebase: {
      enabled: false,
      daemonExePath: null,
      dataDir: null,
      llmProvider: "ollama",
      embeddingProvider: "ollama",
      ollama: {
        baseUrl: "http://127.0.0.1:11434",
        llmModel: "qwen2.5:7b-instruct",
        embedModel: "nomic-embed-text"
      },
      openCompat: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        llmModel: "gpt-4o-mini",
        embedModel: "text-embedding-3-small"
      },
      retrieveTopK: 10,
      chunkSize: 800,
      chunkOverlap: 120
    }
  },
  dockerConfig: {
    enabled: false,
    image: "python:3.13-alpine",
    mounts: [
      {
        hostPath: "",
        containerPath: "/workspace",
        readOnly: false
      }
    ],
    resources: {},
    ports: []
  }
}

function readSettings(): AppSettings {
  const database = getDb()
  const stmt = database.prepare("SELECT data FROM app_settings WHERE id = 1")
  const hasRow = stmt.step()
  if (!hasRow) {
    stmt.free()
    return defaultSettings
  }
  const row = stmt.getAsObject() as { data?: string }
  stmt.free()

  try {
    const parsed = JSON.parse(row.data ?? "{}") as AppSettings
    return {
      ...defaultSettings,
      ...parsed,
      butler: {
        ...defaultSettings.butler,
        ...(parsed?.butler ?? {})
      },
      email: {
        ...defaultSettings.email,
        ...(parsed?.email ?? {}),
        smtp: {
          ...defaultSettings.email.smtp,
          ...(parsed?.email?.smtp ?? {})
        },
        imap: {
          ...defaultSettings.email.imap,
          ...(parsed?.email?.imap ?? {})
        }
      },
      speech: {
        ...defaultSettings.speech,
        ...(parsed?.speech ?? {}),
        stt: {
          ...defaultSettings.speech.stt,
          ...(parsed?.speech?.stt ?? {})
        },
        tts: {
          ...defaultSettings.speech.tts,
          ...(parsed?.speech?.tts ?? {})
        }
      },
      vision: {
        ...defaultSettings.vision,
        ...(parsed?.vision ?? {})
      },
      plugins: {
        ...defaultSettings.plugins,
        ...(parsed?.plugins ?? {}),
        actionbook: {
          ...defaultSettings.plugins.actionbook,
          ...(parsed?.plugins?.actionbook ?? {})
        },
        knowledgebase: {
          ...defaultSettings.plugins.knowledgebase,
          ...(parsed?.plugins?.knowledgebase ?? {}),
          ollama: {
            ...defaultSettings.plugins.knowledgebase.ollama,
            ...(parsed?.plugins?.knowledgebase?.ollama ?? {})
          },
          openCompat: {
            ...defaultSettings.plugins.knowledgebase.openCompat,
            ...(parsed?.plugins?.knowledgebase?.openCompat ?? {})
          }
        }
      }
    }
  } catch {
    return defaultSettings
  }
}

function writeSettings(settings: AppSettings): void {
  const database = getDb()
  const data = JSON.stringify(settings, null, 2)
  database.run("INSERT OR REPLACE INTO app_settings (id, data) VALUES (1, ?)", [data])
  markDbDirty()
}

export function getSettings(): AppSettings {
  return readSettings()
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = readSettings()
  const next: AppSettings = {
    ...current,
    ...updates,
    butler: {
      ...current.butler,
      ...(updates.butler ?? {})
    },
    email: {
      ...current.email,
      ...(updates.email ?? {}),
      smtp: {
        ...current.email.smtp,
        ...(updates.email?.smtp ?? {})
      },
      imap: {
        ...current.email.imap,
        ...(updates.email?.imap ?? {})
      }
    },
    speech: {
      ...current.speech,
      ...(updates.speech ?? {}),
      stt: {
        ...current.speech.stt,
        ...(updates.speech?.stt ?? {})
      },
      tts: {
        ...current.speech.tts,
        ...(updates.speech?.tts ?? {})
      }
    },
    vision: {
      ...current.vision,
      ...(updates.vision ?? {})
    },
    plugins: {
      ...current.plugins,
      ...(updates.plugins ?? {}),
      actionbook: {
        ...current.plugins.actionbook,
        ...(updates.plugins?.actionbook ?? {})
      },
      knowledgebase: {
        ...current.plugins.knowledgebase,
        ...(updates.plugins?.knowledgebase ?? {}),
        ollama: {
          ...current.plugins.knowledgebase.ollama,
          ...(updates.plugins?.knowledgebase?.ollama ?? {})
        },
        openCompat: {
          ...current.plugins.knowledgebase.openCompat,
          ...(updates.plugins?.knowledgebase?.openCompat ?? {})
        }
      }
    },
    defaultWorkspacePath:
      updates.defaultWorkspacePath === undefined
        ? current.defaultWorkspacePath
        : updates.defaultWorkspacePath,
    dockerConfig: updates.dockerConfig ?? current.dockerConfig
  }

  writeSettings(next)
  return next
}
