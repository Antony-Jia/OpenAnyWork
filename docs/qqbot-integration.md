# Openwork QQBot 集成说明

## 目标

本次集成把原 `D:\Code\qqbot\qqbot` 的 QQ 能力收敛到 Openwork 主进程内部，由 `src/main/integrations/providers/qq/protocol/` 提供 QQ 协议与媒体处理能力，再由 `src/main/integrations/providers/qq/bridge/` 把 QQ 消息桥接到 Openwork Butler。

当前方案的核心约束：

- QQ 只绑定 Butler，不接 classic agent IPC
- 所有 QQ 用户共享一个 Butler 主线程
- 桥接层做全局串行消费
- 当 Butler 出现待确认方案时，只允许当前发起 QQ 用户继续回复
- 首期不做任务完成后的二次主动推送

## 目录映射

### QQ 协议层

- `src/main/integrations/providers/qq/protocol/types.ts`
- `src/main/integrations/providers/qq/protocol/service.ts`
- `src/main/integrations/providers/qq/protocol/gateway.ts`
- `src/main/integrations/providers/qq/protocol/api.ts`
- `src/main/integrations/providers/qq/protocol/media-pipeline.ts`
- `src/main/integrations/providers/qq/protocol/reply-renderer.ts`

### Openwork 桥接层

- `src/main/integrations/providers/qq/bridge/config.ts`
- `src/main/integrations/providers/qq/bridge/butler-adapter.ts`
- `src/main/integrations/providers/qq/bridge/service.ts`

### Butler 扩展

- `src/main/butler/manager.ts`
- `src/main/types.ts`

## 运行机制

1. 主进程启动时执行 `startQQBotBridgeService()`
2. 桥接层从 `~/.openwork/.env` 和 `~/.openwork/qqbot.config.json` 读取配置
3. 若缺少 `appId/clientSecret`，服务记录 disabled 日志并跳过启动
4. QQ 入站消息经组件包标准化后生成 `QQButlerEnvelope`
5. 桥接层调用 `butlerManager.sendExternal(...)`
6. Butler 返回：
   - `assistantText`
   - `taskSummary`
   - `pendingChoice`
   - `state`
7. 桥接层合并 `assistantText + taskSummary` 作为首期 QQ 回复

## 配置

凭据先走文件和环境变量，不经过 UI。

### 环境变量

参考：

- `packages/openwork-qqbot/.env.example`

可用变量：

- `OPENWORK_QQBOT_APP_ID`
- `OPENWORK_QQBOT_CLIENT_SECRET`
- `OPENWORK_QQBOT_SANDBOX`
- `OPENWORK_QQBOT_MARKDOWN_SUPPORT`
- `OPENWORK_QQBOT_IMAGE_SERVER_BASE_URL`
- `OPENWORK_QQBOT_STT_*`
- `OPENWORK_QQBOT_TTS_*`

### JSON 模板

参考：

- `packages/openwork-qqbot/config/qqbot.config.example.json`

运行时实际读取路径：

- `~/.openwork/qqbot.config.json`

## Demo

组件包自带 mock demo：

```bash
cd packages/openwork-qqbot
npm run demo
```

Demo 会模拟：

- 纯文本消息
- 图片附件入站
- 文件标签出站
- 语音附件的转写回退

## 当前限制

- 共享 Butler 主线程意味着 QQ 用户之间不是完全隔离的
- 目前通过桥接层的“待确认方案归属”规则避免误答，但不是多租户会话模型
- 语音转写优先走 `voice_wav_url`/WAV，未复刻原插件全部音频转换链
- 频道/Guild 发送多媒体时仍会降级为文本/链接
- 未接入 Openwork 设置页

## 后续建议

1. 将 QQ 凭据和启停开关纳入 Settings UI
2. 为 QQ 用户建立独立 Butler 线程映射
3. 补任务完成后二次主动通知
4. 视需要再补回原插件更完整的音频转换和图片服务链
