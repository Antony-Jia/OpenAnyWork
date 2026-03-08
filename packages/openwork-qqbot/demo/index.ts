import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  DefaultQQMediaPipeline,
  MockQQApiClient,
  MockQQGateway,
  QQBotService,
  type QQInboundEvent,
  type QQReplyTarget
} from "../src/index.js"
import { createMockButlerHandler } from "./mock-handler.js"

function describeTarget(target: QQReplyTarget): string {
  if (target.scene === "group") return `group:${target.groupId}`
  if (target.scene === "guild") return `guild:${target.channelId}`
  if (target.scene === "dm") return `dm:${target.userId}`
  return `c2c:${target.userId}`
}

async function loadEvents(fixtureDir: string): Promise<QQInboundEvent[]> {
  const filePath = path.join(fixtureDir, "events.json")
  const raw = await readFile(filePath, "utf8")
  const parsed = JSON.parse(raw) as QQInboundEvent[]
  return parsed.map((event) => ({
    ...event,
    attachments: event.attachments?.map((attachment) => ({
      ...attachment,
      localPath: attachment.localPath
        ? path.join(fixtureDir, attachment.localPath)
        : undefined
    }))
  }))
}

async function main(): Promise<void> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const packageRoot = path.resolve(currentDir, "..", "..")
  const fixtureDir = path.join(packageRoot, "demo", "fixtures")
  const gateway = new MockQQGateway()
  const apiClient = new MockQQApiClient()
  const config = {
    appId: "demo-app",
    clientSecret: "demo-secret",
    mediaCacheDir: path.join(packageRoot, "demo", ".cache")
  }

  const mediaPipeline = new DefaultQQMediaPipeline(config, {
    transcribeVoice: async ({ attachment, localPath }) => {
      if (attachment.fileName?.includes("voice-fail")) {
        throw new Error("mock STT unavailable for voice-fail.silk")
      }
      if (localPath) {
        return `mock transcript from ${path.basename(localPath)}`
      }
      return undefined
    }
  })

  const service = new QQBotService({
    config,
    gateway,
    apiClient,
    mediaPipeline,
    handler: createMockButlerHandler(fixtureDir),
    logger: {
      info: (message) => console.log(`[demo] ${message}`),
      warn: (message) => console.warn(`[demo] ${message}`),
      error: (message) => console.error(`[demo] ${message}`)
    }
  })

  const events = await loadEvents(fixtureDir)
  await service.start()

  for (const event of events) {
    console.log(`\n[inbound] ${event.messageId} ${event.scene} ${event.text || "(empty)"}`)
    await gateway.push(event)
  }

  await service.stop()

  console.log("\n[outbound summary]")
  apiClient.sent.forEach((entry, index) => {
    console.log(
      `${index + 1}. ${describeTarget(entry.target)} -> ${entry.part.type} :: ${entry.part.value.replace(/\s+/g, " ").trim()}`
    )
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
