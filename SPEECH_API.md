# STT / TTS 接口与功能要求

本文档描述本项目中语音功能对 **STT（Speech-To-Text）** 与 **TTS（Text-To-Speech）** 服务的接口与行为要求。

## 总体要求
1. 接口以 REST 方式提供，**不需要 streaming**。
2. **允许远程地址**，不限制 `localhost`。
3. 支持在应用设置中配置 **自定义请求头**（用于鉴权等）。
4. 返回结果应 **一次性成功**，前端收到后直接回显/播放。
5. 所有请求均由 Electron 主进程发起，不涉及浏览器 CORS 限制。

---

## STT 接口（语音转文字）

### 请求
`POST {STT_URL}`

**Headers**
- `Content-Type: application/json`
- 额外 headers 由设置项提供（如 `Authorization=Bearer ...`）

**Body（JSON）**
```json
{
  "audioBase64": "BASE64_ENCODED_AUDIO",
  "mimeType": "audio/webm",
  "language": "zh-CN"
}
```

字段说明：
- `audioBase64`（必填）：音频二进制数据的 Base64 编码（不带 data URL 前缀）。
- `mimeType`（必填）：音频 MIME 类型，例如：
  - `audio/webm;codecs=opus`
  - `audio/webm`
  - `audio/ogg;codecs=opus`
  - `audio/ogg`
- `language`（可选）：语言标识（例如 `zh-CN`、`en-US`）。

### 响应
**成功（200）**
```json
{
  "text": "识别出的文本内容"
}
```

### 错误处理
- 非 2xx 状态应返回可读文本错误消息（用于展示）。
- 服务端可在 body 中返回错误信息，客户端将原样显示。

---

## TTS 接口（文字转语音）

### 请求
`POST {TTS_URL}`

**Headers**
- `Content-Type: application/json`
- 额外 headers 由设置项提供（如 `Authorization=Bearer ...`）

**Body（JSON）**
```json
{
  "text": "需要朗读的文本",
  "voice": "optional-voice-id"
}
```

字段说明：
- `text`（必填）：需要合成语音的文本。
- `voice`（可选）：音色/发音人标识。

### 响应
**成功（200）**
- **直接返回二进制音频**（`audio/*`）。
- 必须提供正确的 `Content-Type` 响应头，例如：
  - `audio/mpeg`
  - `audio/wav`
  - `audio/ogg`
  - `audio/webm`

客户端会读取响应头中的 `Content-Type` 作为音频 MIME 类型。

### 错误处理
- 非 2xx 状态应返回可读文本错误消息（用于展示）。

---

## 建议与兼容性
1. **音频输入**：建议 STT 支持 `audio/webm` 与 `audio/ogg`，与浏览器 `MediaRecorder` 默认输出匹配。
2. **音频输出**：建议 TTS 输出 `audio/mpeg` 或 `audio/wav`，以提升播放器兼容性。
3. **大小限制**：建议单次请求支持至少 30 秒语音或相当大小（具体可在服务端限制并返回错误说明）。

---

## 配置项（应用设置）
本功能通过应用设置提供以下配置：
- STT:
  - `url`
  - `headers`（Key=Value，多行）
  - `language`（可选）
- TTS:
  - `url`
  - `headers`（Key=Value，多行）
  - `voice`（可选）

以上配置均由 Electron 主进程读取并用于发起 REST 请求。
