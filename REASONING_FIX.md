# 🐛 Reasoning Content 流式输出修复

## 问题描述

在使用 Ark/豆包等支持 `reasoning_content` 的模型时，虽然 `__raw_response` 中包含了思考过程内容，但前端无法接收到 thinking 内容。

### 日志表现

```json
{
  "rawContentText": "",
  "streamContent": "null",
  "hasReasoningContent": false,
  "isReasoningChunk": false
}
```

原始数据中 `__raw_response.choices[0].delta.reasoning_content` 有值（如 `"用户"`、`"问"` 等），但没有被提取出来。

---

## 根本原因

**Bug 位置**：`isRecord(rawResponse.choices) && Array.isArray(rawResponse.choices)`

这个条件**永远为 false**，因为：
- `isRecord` 函数定义为：`!!value && typeof value === "object" && !Array.isArray(value)`
- 它**排除了数组**，而 `rawResponse.choices` 正是一个数组
- 所以 `isRecord(rawResponse.choices)` 永远返回 `false`
- 整个条件永远为 `false`，导致 reasoning 提取代码从未执行

### 影响文件

1. `src/main/agent/stream-utils.ts` - 第 32 行
2. `src/main/agent/run.ts` - 第 246 行

---

## 修复方案

### 修复 1: `stream-utils.ts`

**修改前**：
```typescript
if (isRecord(rawResponse.choices) && Array.isArray(rawResponse.choices)) {
```

**修改后**：
```typescript
if (Array.isArray(rawResponse.choices)) {
```

### 修复 2: `run.ts`

**修改前**：
```typescript
if (isRecord(rawResponse.choices) && Array.isArray(rawResponse.choices)) {
```

**修改后**：
```typescript
if (Array.isArray(rawResponse.choices)) {
```

### 额外修复: `run.ts` 变量顺序错误

**修改前**：
```typescript
const rawReasoning = extractReasoningFromRawResponse(additionalKwargs)

// 调试日志：查看 extraction 结果
if (!finalReasoningContent && additionalKwargs.__raw_response) {  // ❌ finalReasoningContent 未定义
  ...
}

const finalReasoningContent = reasoningContent || rawReasoning.reasoningContent
```

**修改后**：
```typescript
const rawReasoning = extractReasoningFromRawResponse(additionalKwargs)
const finalReasoningContent = reasoningContent || rawReasoning.reasoningContent
const finalReasoningDetails = reasoningDetails || rawReasoning.reasoningDetails

// 调试日志：查看 extraction 结果
if (!finalReasoningContent && additionalKwargs.__raw_response) {  // ✅ 现在可以使用
  ...
}
```

---

## 修复后的效果

### 数据流

```
LLM API 返回
  ↓
__raw_response.choices[0].delta.reasoning_content = "用户"
  ↓
extractReasoningFromRawResponse()  ✅ 现在可以正确提取
  ↓
finalReasoningContent = "用户"
  ↓
messages mode 流式处理:
  - reasoningPhase = true
  - streamContent = "\n<thinking>用户"
  ↓
前端接收并显示 thinking 内容
```

### 日志表现（修复后）

```json
{
  "rawContentText": "",
  "streamContent": "\n<thinking>用户",
  "hasReasoningContent": true,
  "isReasoningChunk": true,
  "reasoningPhase": true,
  "accumulatedReasoningLength": 2
}
```

---

## 验证方法

1. **启动应用**：`npm run dev`
2. **发送消息**：使用 Ark/豆包模型发送任意消息
3. **查看日志**：检查 `agent-stream-debug.log`
4. **预期结果**：
   - `hasReasoningContent: true`
   - `streamContent` 包含 `<thinking>` 标签
   - `accumulatedReasoningLength` 逐渐增加

---

## 相关文件

- `src/main/agent/stream-utils.ts` - reasoning 提取函数
- `src/main/agent/run.ts` - 流式处理主逻辑
- `src/shared/reasoning.ts` - reasoning 解析和注入
- `src/renderer/src/components/chat/ThinkingBlock.tsx` - 前端 thinking 展示组件

---

## 注意事项

1. **仅影响 reasoning 模型**：此修复只影响使用支持 reasoning 的模型（如 Ark、豆包推理模型）
2. **向后兼容**：修复不影响普通模型的正常工作
3. **前端展示**：thinking 内容会以可折叠的 ThinkingBlock 组件展示

---

## 技术细节

### Ark 格式 vs OpenAI 格式

| 字段 | Ark/豆包 | OpenAI o1/o3 |
|------|---------|--------------|
| 非流式 | `choices[0].message.reasoning_content` | `choices[0].message.reasoning` |
| 流式 | `choices[0].delta.reasoning_content` | `choices[0].delta.reasoning` |
| 启用方式 | `modelKwargs.thinking.type: "enabled"` | `reasoning.effort: "high"` |

### 为什么之前没发现

- 之前可能只使用了 OpenAI 原生模型（o1/o3），它们使用 `reasoning` 字段
- 或者 `__raw_response` 未启用，没有原始响应数据
- 直到使用 `__includeRawResponse: true` 并切换到 Ark 模型才暴露此问题
