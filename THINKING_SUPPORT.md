可以统一。
你现在最适合的做法，不是把每家 SDK 的写法硬塞进业务代码里，而是**在你自己的代码里定义一层“推理配置标准接口”**，再映射到不同 Provider 的实际参数。

关键点有两个：

LangChain JS 的 `ChatOpenAI` 支持：

* 自定义 `baseURL`
* 自定义请求头
* 通过 `modelKwargs` 传递未被显式建模的额外参数。([LangChain Docs][1])

而火山方舟在 OpenAI 兼容接口里，对深度思考的官方写法是放到 `extra_body` 里的：

```python
extra_body={
  "thinking": {"type": "enabled"}
}
```

也就是你截图那种形式。([Volcengine][2])

同时，LangChain JS 社区自己也有人提过：**Python 里有 `extra_body`，JS/TS 侧缺少一个完全对等的直接入口**。这个 issue 明确写的是“当前 JavaScript/TypeScript implementation lacks a direct equivalent”。([GitHub][3])

所以工程上最稳的统一方式是：

# 统一你的业务配置

先别在业务里直接写：

* `thinking.type = "enabled"`
* `reasoning_effort = "high"`
* `enable_thinking = true`

而是统一成你自己的标准：

```ts
type ThinkMode = "enabled" | "disabled" | "auto";

interface UnifiedModelOptions {
  model: string;
  provider: "openai" | "ark" | "anthropic" | "other-openai-compatible";
  apiKey: string;
  baseURL?: string;

  thinking?: {
    mode?: ThinkMode;
    budgetTokens?: number;
  };

  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}
```

这样你的上层 Agent、Workflow、Router 永远只认这一个结构。

---

# 再做一层 provider 映射

例如：

```ts
import { ChatOpenAI } from "@langchain/openai";

type ThinkMode = "enabled" | "disabled" | "auto";

interface UnifiedModelOptions {
  model: string;
  provider: "openai" | "ark" | "other-openai-compatible";
  apiKey: string;
  baseURL?: string;
  thinking?: {
    mode?: ThinkMode;
    budgetTokens?: number;
  };
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

function buildChatModel(opts: UnifiedModelOptions) {
  const {
    model,
    apiKey,
    baseURL,
    temperature = 0,
    maxTokens,
    thinking,
  } = opts;

  const modelKwargs: Record<string, unknown> = {};

  // Ark / 豆包：映射到 extra body 风格字段
  if (opts.provider === "ark" && thinking?.mode) {
    modelKwargs.thinking = {
      type: thinking.mode,
      ...(thinking.budgetTokens
        ? { budget_tokens: thinking.budgetTokens }
        : {}),
    };
  }

  // 以后如果别的 openai-compatible 厂商有不同字段，也继续往这里加
  if (opts.provider === "other-openai-compatible" && thinking?.mode) {
    modelKwargs.thinking = {
      type: thinking.mode,
    };
  }

  return new ChatOpenAI({
    model,
    temperature,
    apiKey,
    maxTokens,
    configuration: {
      baseURL,
    },
    modelKwargs,
  });
}
```

这个思路的本质是：

* **你的业务层只关心 thinking.mode**
* **Provider 适配层决定怎么变成底层参数**

---

# 为什么这样最合适

因为你现在面对的是三套“长得像一回事，但名字不完全一样”的体系：

1. **OpenAI 官方 SDK / Responses API 风格**
2. **OpenAI-compatible 厂商扩展字段**
3. **LangChain 的封装参数体系**

它们不是完全同构的。

LangChain JS 官方文档能确认 `ChatOpenAI` 是兼容 OpenAI Chat Completions provider 的，也支持自定义 `baseURL` 和 `configuration`。([LangChain Docs][1])
但方舟这种 `thinking` 字段，本质上还是**厂商自定义扩展请求体字段**，不是 OpenAI 通用标准。([Volcengine][4])

所以你不应该指望“所有模型都统一叫一个官方字段名”，而应该自己做标准化。

---

# 推荐你统一成“两层配置”

我建议你把配置拆成两层：

## 第一层：通用层

```ts
interface ReasoningPolicy {
  mode: "enabled" | "disabled" | "auto";
  effort?: "low" | "medium" | "high";
  budgetTokens?: number;
}
```

## 第二层：Provider 映射层

```ts
function toProviderParams(
  provider: string,
  reasoning?: ReasoningPolicy
): Record<string, unknown> {
  if (!reasoning) return {};

  switch (provider) {
    case "ark":
      return {
        thinking: {
          type: reasoning.mode,
          ...(reasoning.budgetTokens
            ? { budget_tokens: reasoning.budgetTokens }
            : {}),
        },
      };

    case "openai":
      // 这里只是示意：是否映射 effort 要按你实际目标模型来定
      return {
        ...(reasoning.effort ? { reasoning_effort: reasoning.effort } : {}),
      };

    default:
      return {};
  }
}
```

这样以后你切：

* 豆包
* Qwen OpenAI-compatible
* DeepSeek OpenAI-compatible
* GPT 系列

都不会把业务代码污染得到处都是 `if provider === ...`。

---

# 针对你现在的 LangChain 写法，最实用版本

如果你就是想先把当前项目跑起来，我建议直接封一层 factory：

```ts
import { ChatOpenAI } from "@langchain/openai";

export function createLLM({
  model,
  apiKey,
  baseURL,
  thinkingMode = "auto",
}: {
  model: string;
  apiKey: string;
  baseURL: string;
  thinkingMode?: "enabled" | "disabled" | "auto";
}) {
  return new ChatOpenAI({
    model,
    apiKey,
    temperature: 0,
    configuration: {
      baseURL,
    },
    modelKwargs: {
      thinking: {
        type: thinkingMode,
      },
    },
  });
}
```

使用时：

```ts
const llm = createLLM({
  model: "doubao-seed-2-0-lite-260215",
  apiKey: process.env.ARK_API_KEY!,
  baseURL: "https://ark.cn-beijing.volces.com/api/v3",
  thinkingMode: "enabled",
});
```

---
