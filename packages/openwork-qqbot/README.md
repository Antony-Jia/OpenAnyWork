# openwork-qqbot

`openwork-qqbot` 是从 `D:\Code\qqbot\qqbot` 抽出的可复用 QQ 组件包，目标是把 QQ 协议接入、附件落盘、消息封装、标签渲染和基础发送链从 OpenClaw/Openwork 运行时里隔离出来。

## 提供的能力

- `QQBotService`
- `QQBotGateway`
- `DefaultQQApiClient`
- `MemoryQQSessionStore`
- `MemoryQQDedupeStore`
- `DefaultQQMediaPipeline`
- `DefaultQQReplyRenderer`
- `QQButlerEnvelope` / `QQNormalizedMessage` / `QQOutboundPart`

## 入口

```ts
import {
  QQBotService,
  type QQBotConfig
} from "./src/index.js"
```

## 典型用法

```ts
const service = new QQBotService({
  config,
  handler: async ({ envelope }) => {
    return {
      replyText: `收到消息：\n\n${envelope.text}`
    }
  }
})

await service.start()
```

## Envelope 结构

`DefaultQQMediaPipeline` 会把入站消息转成带固定头部的纯文本 envelope，包含：

- `senderOpenId`
- `senderName`
- `messageId`
- `messageType`
- `timestamp`
- `replyTarget`
- 原始文本
- 附件本地路径
- 语音转写结果或转写失败说明

这样上层集成只需要把 `envelope.text` 交给 Agent/Butler。

## 多媒体出站

`DefaultQQReplyRenderer` 保留了原插件的标签风格：

- `<qqimg>PATH_OR_URL</qqimg>`
- `<qqvoice>PATH_OR_URL</qqvoice>`
- `<qqvideo>PATH_OR_URL</qqvideo>`
- `<qqfile>PATH_OR_URL</qqfile>`

文本和多媒体会按原文顺序拆分成 `QQOutboundPart[]`。

## Demo

```bash
cd packages/openwork-qqbot
npm run demo
```

Demo 会：

- 构造文本、图片、文件、语音 fixture
- 使用 mock API client 打印发送结果
- 展示附件 envelope 和 `<qqimg>/<qqfile>` 标签渲染效果

不需要真实 `appId` / `clientSecret`。
