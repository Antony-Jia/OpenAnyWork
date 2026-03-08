import path from "node:path"
import type { QQBotServiceHandler } from "../src/index.js"

export function createMockButlerHandler(fixtureDir: string): QQBotServiceHandler {
  const replyImage = path.join(fixtureDir, "media", "reply-image.png")
  const replyFile = path.join(fixtureDir, "media", "reply-brief.txt")
  const replyVoice = path.join(fixtureDir, "media", "reply-voice.silk")
  const replyVideo = path.join(fixtureDir, "media", "reply-video.mp4")

  return async ({ envelope }) => {
    if (envelope.voiceNotes.length > 0) {
      return `收到语音了，当前仅拿到转写状态：${envelope.voiceNotes.join("; ")}\n<qqvoice>${replyVoice}</qqvoice>`
    }

    if (envelope.attachmentPaths.some((item) => /\.png$/i.test(item))) {
      return `图片已收到，我回一张示意图。\n<qqimg>${replyImage}</qqimg>`
    }

    if (envelope.attachmentPaths.some((item) => /\.txt$/i.test(item))) {
      return `文件已收到，我回一份确认。\n<qqfile>${replyFile}</qqfile>`
    }

    return `文本已收到，补一个演示视频回执。\n<qqvideo>${replyVideo}</qqvideo>`
  }
}
