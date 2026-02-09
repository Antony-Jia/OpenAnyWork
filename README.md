# OpenWork Deep Agent Workbench

[![npm][npm-badge]][npm-url] [![License: MIT][license-badge]][license-url]

[npm-badge]: https://img.shields.io/npm/v/openwork.svg
[npm-url]: https://www.npmjs.com/package/openwork
[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license-url]: https://opensource.org/licenses/MIT

OpenWork（应用内标题 `OpenAnyWork`）是一个面向 Deep Agent 的桌面工作台：不只是聊天，而是让 Agent 在本地工作区里调用工具、执行任务、持续编排。

> [!CAUTION]
> OpenWork 会让 AI 读写本地文件并执行命令。请只在可信工作区运行，非隔离模式下务必审查执行行为。

![openwork screenshot](docs/PixPin_2026-02-09_23-22-28.png)
![openwork screenshot](docs/screenshot.png)
![openwork screenshot](docs/PixPin_2026-01-29_19-01-01.png)
![openwork screenshot](docs/PixPin_2026-01-29_19-02-10.png)
![openwork screenshot](docs/PixPin_2026-01-29_19-03-31.png)

## 快速开始

### 环境要求

- Node.js `>=18`
- npm
- Docker（可选，但建议开启隔离执行）

### 本地开发

```bash
git clone https://github.com/langchain-ai/openwork.git
cd openwork
npm install
npm run dev
```

### 构建

```bash
npm run build
```

## 交互模式

- `Classic`：传统线程视图（default / ralph / email / loop）。
- `Butler`：管家编排视图（主对话 + 任务看板 + 监听看板）。
- 顶部标题点击可在 `Classic` / `Butler` 间切换。
- 全局快捷键 `Ctrl+Alt+Space` 可打开 Quick Input，并直接把请求发送给 Butler。

## 管家 AI（Butler）

Butler 是语义编排器，不做关键词路由。每轮会在“直接回复 / 澄清问题 / 创建任务”间选择。

### 支持的任务模式

- `default`：通用任务。
- `ralph`：迭代型开发任务（验收条件 + 最大迭代次数）。
- `email`：邮件任务（受邮件模式 system prompt 约束）。
- `loop`：周期或事件触发任务。

### 核心行为

- 单轮可创建多任务，支持 `dependsOn` 依赖图和并发调度。
- 自动检测“过度拆分”并给用户 `A/B` 方案确认（单任务优先 vs 原始拆分）。
- 支持 handoff：
  - `context`：上游结果拼入下游提示词。
  - `filesystem`：写入 `.butler_handoff.json`。
  - `both`：同时启用。
- 任务生命周期（开始/完成）和系统事件（监听提醒）都会回流到 Butler 主会话。
- Butler 任务默认走 `capabilityScope = "butler"`，与 Classic 能力开关隔离。

### 监听能力（Butler Monitor）

Butler 工作区右侧有“监听任务”看板，支持：

- 日历事件提醒（开始前 2 小时触发）
- 倒计时到点提醒
- 邮件规则拉取（IMAP）

触发后会走一个轻量提醒模型回合，生成 1~3 句中文提醒，并推送为事件通知。

## Loop 对话模式

Loop 是线程级自动执行器，创建入口在左侧 `New Thread -> New Loop Thread`。

### 触发器

- `schedule`：cron 定时触发
- `api`：按 cron 轮询 API，并根据 `equals / contains / truthy` 条件触发
- `file`：监听目录中新文件（可按后缀过滤）

### 模板变量

`contentTemplate` 支持变量替换，例如：

- `{{time}}`
- `{{trigger.type}}`
- `{{api.json}}` / `{{api.pathValue}}` / `{{api.status}}`
- `{{file.path}}` / `{{file.preview}}` / `{{file.size}}`

### 执行特性

- 队列策略为 `strict`，带 `mergeWindowSec` 合并窗口，避免短时间重复触发。
- 每次运行会注入 `[Loop Trigger @时间]` 标记并调用 agent stream。
- Loop 线程运行时默认 `disableApprovals = true`。
- 应用重启后，所有 Loop 会被重置为暂停状态（不自动恢复运行）。

## 记忆系统（Memory）

### 自动记忆写入

- 在任务完成事件后自动抽取会话摘要（模式、简述、详情、工具过程、偏好标签等）。
- Butler 主会话（`butlerMain`）不写入对话记忆摘要。

### 日画像（Daily Profile）

- 启动时会根据“昨天”的任务摘要聚合生成日画像与对比文本。
- Butler 编排提示词会引用：
  - `[Daily Profile]`
  - `[Profile Delta]`

### 管理入口

- 标题栏 `Memory` 按钮可查看：
  - Conversation Memory（按线程分组）
  - Butler Global Memory（日画像）
- 支持一键清空全部记忆。
- 删除线程时可选“同时删除该线程记忆摘要”。

## Prompt 添加（提示词模板）

标题栏 `Prompts` 支持提示词模板管理：

- 新建 / 搜索 / 查看 / 编辑 / 删除
- 一键复制模板内容

当前行为边界：

- 提示词模板是“管理与复用素材库”，不会自动注入每次发送消息。
- 模板持久化在主数据库 `prompt_templates` 表中。

## Butler Prompt 组合器（开发者）

Butler 用户提示词由 section pipeline 组装，当前顺序：

1. `overview`
2. `memory`
3. `router`
4. `capabilities`

扩展方式：新增 section 文件并注册到 `DEFAULT_SECTION_PIPELINE`，无需改 runtime 主流程。

## 能力作用域（Classic / Butler）

Tools / Skills / MCP / Subagents 都支持双开关：

- `Classic`：普通线程可用
- `Butler`：管家派发线程可用

旧版全局开关仍兼容，但会同步写入两侧作用域。

## 本地数据目录

所有本地数据默认位于 `~/.openwork/`：

- `openwork.sqlite`：主数据库（线程、prompt 模板、MCP、工具、子智能体、设置等）
- `memory.sqlite`：记忆数据库（任务摘要、日画像、Butler 历史消息/任务）
- `langgraph.sqlite`：通用检查点数据库
- `threads/*.sqlite`：线程级检查点
- `threads/*.ralph.jsonl`：Ralph 日志
- `butler-workspaces/`：Butler 任务工作目录（默认，可在设置中修改）

## 相关文档

- 架构说明：[`ARCHITECTURE.md`](ARCHITECTURE.md)
- 邮件模式：[`EMAIL.md`](EMAIL.md)
- 语音接口：[`SPEECH_API.md`](SPEECH_API.md)
- 贡献指南：[`CONTRIBUTING.md`](CONTRIBUTING.md)

## 许可证

[MIT](LICENSE) © LangChain
