import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { getEnvFilePath, getOpenworkDir } from "../../storage"
import { getSettings } from "../../settings"
import type { QQBotConfig } from "../../../../packages/openwork-qqbot/src/index.js"

interface QQBotFileConfig {
  enabled?: boolean
  appId?: string
  clientSecret?: string
  sandbox?: boolean
  markdownSupport?: boolean
  imageServerBaseUrl?: string
  mediaCacheDir?: string
  stt?: QQBotConfig["stt"]
  tts?: QQBotConfig["tts"]
}

export interface ResolvedQQBotBridgeConfig {
  enabled: boolean
  reason?: string
  config?: QQBotConfig
  configFilePath: string
}

function parseEnvFile(): Record<string, string> {
  const filePath = getEnvFilePath()
  if (!existsSync(filePath)) return {}
  const result: Record<string, string> = {}
  for (const line of readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const index = trimmed.indexOf("=")
    if (index <= 0) continue
    result[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim()
  }
  return result
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true
  const normalized = value.trim().toLowerCase()
  return (
    !normalized ||
    normalized === "your_app_id" ||
    normalized === "your_client_secret" ||
    normalized === "to-be-filled"
  )
}

function readFileConfig(configFilePath: string): QQBotFileConfig {
  if (!existsSync(configFilePath)) return {}
  try {
    return JSON.parse(readFileSync(configFilePath, "utf-8")) as QQBotFileConfig
  } catch {
    return {}
  }
}

export function loadQQBotBridgeConfig(): ResolvedQQBotBridgeConfig {
  const configFilePath = join(getOpenworkDir(), "qqbot.config.json")
  const env = { ...parseEnvFile(), ...process.env }
  const fileConfig = readFileConfig(configFilePath)
  const settings = getSettings()
  const settingsQQ = settings.qq

  const enabled = fileConfig.enabled !== false
  const appId = env.OPENWORK_QQBOT_APP_ID || settingsQQ.appId || fileConfig.appId || ""
  const clientSecret =
    env.OPENWORK_QQBOT_CLIENT_SECRET ||
    settingsQQ.clientSecret ||
    fileConfig.clientSecret ||
    ""

  if (!enabled) {
    return {
      enabled: false,
      reason: "disabled in qqbot config",
      configFilePath
    }
  }

  if (isPlaceholder(appId) || isPlaceholder(clientSecret)) {
    return {
      enabled: false,
      reason: "missing qqbot credentials",
      configFilePath
    }
  }

  return {
    enabled: true,
    configFilePath,
    config: {
      appId,
      clientSecret,
      sandbox: parseBoolean(env.OPENWORK_QQBOT_SANDBOX, fileConfig.sandbox ?? true),
      markdownSupport: parseBoolean(
        env.OPENWORK_QQBOT_MARKDOWN_SUPPORT,
        fileConfig.markdownSupport ?? false
      ),
      imageServerBaseUrl:
        env.OPENWORK_QQBOT_IMAGE_SERVER_BASE_URL || fileConfig.imageServerBaseUrl,
      mediaCacheDir:
        fileConfig.mediaCacheDir || join(getOpenworkDir(), "qqbot-media"),
      stt:
        env.OPENWORK_QQBOT_STT_BASE_URL || fileConfig.stt?.baseUrl
          ? {
              baseUrl: env.OPENWORK_QQBOT_STT_BASE_URL || fileConfig.stt?.baseUrl || "",
              apiKey: env.OPENWORK_QQBOT_STT_API_KEY || fileConfig.stt?.apiKey || "",
              model: env.OPENWORK_QQBOT_STT_MODEL || fileConfig.stt?.model || ""
            }
          : undefined,
      tts:
        env.OPENWORK_QQBOT_TTS_BASE_URL || fileConfig.tts?.baseUrl
          ? {
              baseUrl: env.OPENWORK_QQBOT_TTS_BASE_URL || fileConfig.tts?.baseUrl || "",
              apiKey: env.OPENWORK_QQBOT_TTS_API_KEY || fileConfig.tts?.apiKey || "",
              model: env.OPENWORK_QQBOT_TTS_MODEL || fileConfig.tts?.model || "",
              voice: env.OPENWORK_QQBOT_TTS_VOICE || fileConfig.tts?.voice || ""
            }
          : undefined
    }
  }
}
