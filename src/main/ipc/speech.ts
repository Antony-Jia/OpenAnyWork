import { IpcMain } from "electron"
import { getSettings } from "../settings"
import type {
  SpeechSttRequest,
  SpeechSttResponse,
  SpeechTtsRequest,
  SpeechTtsResponse
} from "../types"

function normalizeHeaders(headers?: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers ?? {})) {
    const trimmedKey = key.trim()
    if (!trimmedKey) continue
    result[trimmedKey] = String(value ?? "").trim()
  }
  return result
}

function ensureJsonContentType(headers: Record<string, string>): Record<string, string> {
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
  if (!hasContentType) {
    headers["Content-Type"] = "application/json"
  }
  return headers
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return text.slice(0, 2000)
  } catch {
    return ""
  }
}

export function registerSpeechHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("speech:stt", async (_event, input: SpeechSttRequest) => {
    const settings = getSettings()
    const url = settings.speech?.stt?.url?.trim()
    if (!url) {
      throw new Error("STT URL is not configured.")
    }

    const headers = ensureJsonContentType(normalizeHeaders(settings.speech?.stt?.headers))
    const payload: SpeechSttRequest = {
      audioBase64: input.audioBase64,
      mimeType: input.mimeType
    }
    const language = settings.speech?.stt?.language?.trim()
    if (language) {
      payload.language = language
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const details = await readErrorBody(response)
      throw new Error(`STT request failed (${response.status}): ${details || response.statusText}`)
    }

    const data = (await response.json()) as SpeechSttResponse
    if (!data?.text) {
      throw new Error("STT response missing text.")
    }
    return data
  })

  ipcMain.handle("speech:tts", async (_event, input: SpeechTtsRequest) => {
    const settings = getSettings()
    const url = settings.speech?.tts?.url?.trim()
    if (!url) {
      throw new Error("TTS URL is not configured.")
    }

    const headers = ensureJsonContentType(normalizeHeaders(settings.speech?.tts?.headers))
    const payload: SpeechTtsRequest = {
      text: input.text
    }
    const voice = settings.speech?.tts?.voice?.trim()
    if (voice) {
      payload.voice = voice
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const details = await readErrorBody(response)
      throw new Error(`TTS request failed (${response.status}): ${details || response.statusText}`)
    }

    const contentType = response.headers.get("content-type") || ""
    if (!contentType.toLowerCase().includes("audio")) {
      throw new Error(
        `TTS response has unexpected content-type: "${contentType}". Expected audio data. Check that the TTS URL is correct.`
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength === 0) {
      throw new Error("TTS response body is empty")
    }
    const mimeType = contentType.split(";")[0].trim() || "audio/wav"
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64")
    const result: SpeechTtsResponse = { audioBase64, mimeType }
    return result
  })
}
