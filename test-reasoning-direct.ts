import { ChatOpenAI } from "@langchain/openai"
import * as fs from "node:fs"
import * as path from "node:path"

// 硬编码配置 - 根据你的实际 provider 修改
// 选择一个配置，把其他的注释掉

// 方案 1: 字节 Ark（你当前在用的）
// const baseURL = "https://ark.cn-beijing.volces.com/api/coding/v3"
// const apiKey = "87598e6f-e904-4857-ad9a-4b67d7b90c19" // 替换为你的实际 API key
// const model = "ark-code-latest"

// 日志文件
const logFile = path.join(process.cwd(), "test-reasoning-debug.log")

// 清空日志文件
fs.writeFileSync(logFile, "")

// 日志写入函数
function log(message: string) {
  fs.appendFileSync(logFile, message + "\n")
  console.log(message)
}

// 方案 2: OpenAI 原生（如果有 o1/o3 模型）
// const baseURL = "https://api.openai.com/v1"
// const apiKey = "YOUR_OPENAI_API_KEY"
// const model = "o1-mini"
// const reasoning = {
//   effort: "medium" as const,
//   summary: "auto" as const
// }

// 方案 3: Ollama（本地测试）
const baseURL = "http://localhost:11434/v1"
const apiKey = "ollama"
const model = "qwen3.5:9b"
const modelKwargs = {
  think: true
}

async function testReasoningDirect() {
  log("=== 开始测试 Reasoning 输出 ===")
  log("Provider: " + baseURL)
  log("Model: " + model)
  log("")

  try {
    const chat = new ChatOpenAI({
      model,
      apiKey,
      configuration: {
        baseURL
      },
      // 尝试用 modelKwargs 传递 thinking
      modelKwargs: {
        thinking: { type: "enabled" }
      },
      // 启用原始响应以查看 Ark 实际返回的内容
      __includeRawResponse: true
    })

    const simpleQuestion = "1+1等于几？"
    log("问题: " + simpleQuestion)
    log("")

    // 测试非流式请求
    log("--- 测试非流式请求 ---")
    const response = await chat.invoke(simpleQuestion)

    log("完整响应结构:")
    log(JSON.stringify(response, null, 2))
    log("")

    log("--- 关键字段提取 ---")
    log("content: " + response.content)
    log("additional_kwargs: " + JSON.stringify(response.additional_kwargs, null, 2))
    log("response_metadata: " + JSON.stringify(response.response_metadata, null, 2))
    log("usage_metadata: " + JSON.stringify(response.usage_metadata, null, 2))
    log("")

    // 检查 reasoning 相关字段
    log("--- Reasoning 字段检查 ---")
    log(
      "additional_kwargs.reasoning_content: " +
        (response.additional_kwargs?.reasoning_content as string | undefined)
    )
    log("additional_kwargs.reasoning: " + JSON.stringify(response.additional_kwargs?.reasoning))
    log("response_metadata.output: " + JSON.stringify(response.response_metadata?.output))
    log(
      "usage_metadata.output_token_details: " +
        JSON.stringify(response.usage_metadata?.output_token_details)
    )

    const outputTokenDetails = response.usage_metadata?.output_token_details as
      | Record<string, unknown>
      | undefined
    log(
      "usage_metadata.output_token_details?.reasoning: " +
        JSON.stringify(outputTokenDetails?.reasoning)
    )
    log("")

    // 测试流式请求
    log("--- 测试流式请求 ---")
    const stream = await chat.stream(simpleQuestion)

    let fullContent = ""
    let chunkIndex = 0

    for await (const chunk of stream) {
      chunkIndex++
      const chunkContent = chunk.content as string
      if (chunkContent) {
        fullContent += chunkContent
      }

      // 打印每个 chunk 的详细信息
      log(`\n--- Chunk ${chunkIndex} ---`)
      log("content: " + chunkContent)
      log("additional_kwargs: " + JSON.stringify(chunk.additional_kwargs, null, 2))
      log("response_metadata: " + JSON.stringify(chunk.response_metadata, null, 2))
      log("usage_metadata: " + JSON.stringify(chunk.usage_metadata, null, 2))

      // 检查 reasoning 字段
      log("has reasoning_content: " + !!chunk.additional_kwargs?.reasoning_content)
      log("has reasoning: " + !!chunk.additional_kwargs?.reasoning)
      log("has output: " + !!chunk.response_metadata?.output)
    }

    log("\n--- 流式完整内容 ---")
    log(fullContent)
  } catch (error) {
    log("测试失败: " + error)
    if (error instanceof Error) {
      log("错误信息: " + error.message)
      log("错误堆栈: " + error.stack)
    }
  }
}

testReasoningDirect()
