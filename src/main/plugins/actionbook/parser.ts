/* eslint-disable no-control-regex */
export interface ActionbookParsedLine {
  token?: string
  tokenFilePath?: string
  websocketUrl?: string
  extensionPath?: string
  extensionVersion?: string
  waitingForExtension?: boolean
}

const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><]/g
const OSC_REGEX = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g

export function sanitizeActionbookOutput(raw: string): string {
  return raw
    .replace(OSC_REGEX, "")
    .replace(ANSI_REGEX, "")
    .replace(/\r/g, "\n")
    .replace(/\u0007/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
}

export function splitActionbookLines(
  buffer: string,
  incomingChunk: string
): { lines: string[]; remainder: string } {
  const normalized = sanitizeActionbookOutput(`${buffer}${incomingChunk}`)
  const parts = normalized.split("\n")
  const remainder = parts.pop() ?? ""
  const lines = parts.map((line) => line.trim()).filter(Boolean)
  return { lines, remainder }
}

export function parseActionbookLine(line: string): ActionbookParsedLine {
  const parsed: ActionbookParsedLine = {}

  const tokenMatch = line.match(/Session token:\s*(abk_[a-zA-Z0-9]+)/i)
  if (tokenMatch) {
    parsed.token = tokenMatch[1]
  }

  const tokenFileMatch = line.match(/Token file:\s*(.+)$/i)
  if (tokenFileMatch) {
    parsed.tokenFilePath = tokenFileMatch[1].trim()
  }

  const wsMatch = line.match(/WebSocket server on\s+(ws:\/\/\S+)/i)
  if (wsMatch) {
    parsed.websocketUrl = wsMatch[1]
  }

  const extensionMatch = line.match(/Extension:\s+(.+?)\s+\(v([^)]+)\)/i)
  if (extensionMatch) {
    parsed.extensionPath = extensionMatch[1].trim()
    parsed.extensionVersion = extensionMatch[2].trim()
  }

  if (/Waiting for extension connection/i.test(line)) {
    parsed.waitingForExtension = true
  }

  return parsed
}

export function parseActionbookStatusLine(output: string): {
  bridgeRunning: boolean
  message: string
} {
  const text = sanitizeActionbookOutput(output).trim()
  if (!text) {
    return { bridgeRunning: false, message: "No output from status command." }
  }

  if (/Bridge server is running/i.test(text)) {
    return { bridgeRunning: true, message: text }
  }

  if (/Bridge server is not running/i.test(text)) {
    return { bridgeRunning: false, message: text }
  }

  return { bridgeRunning: false, message: text }
}

export function parseActionbookPingLine(output: string): { connected: boolean; message: string } {
  const text = sanitizeActionbookOutput(output).trim()
  if (!text) {
    return { connected: false, message: "No output from ping command." }
  }

  if (/Extension responded/i.test(text)) {
    return { connected: true, message: text }
  }

  if (/Ping failed/i.test(text)) {
    return { connected: false, message: text }
  }

  return { connected: false, message: text }
}
