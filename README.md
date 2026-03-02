# OpenAnyWork Deep Agent Workbench

[![npm][npm-badge]][npm-url] [![License: MIT][license-badge]][license-url] [![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![中文](https://img.shields.io/badge/lang-中文-red)](README.zh-CN.md)

[npm-badge]: https://img.shields.io/npm/v/openwork.svg
[npm-url]: https://www.npmjs.com/package/openwork
[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license-url]: https://opensource.org/licenses/MIT

OpenAnyWork is a desktop workbench for Deep Agents: not just chat, but enabling agents to invoke tools, execute tasks, and orchestrate workflows within local workspaces.

> [!CAUTION]
> OpenAnyWork allows AI to read/write local files and execute commands. Please run only in trusted workspaces and review execution behavior carefully in non-isolated mode.

![openwork screenshot](docs/PixPin_2026-02-09_23-22-28.png)
![openwork screenshot](docs/screenshot.png)
![openwork screenshot](docs/PixPin_2026-01-29_19-01-01.png)
![openwork screenshot](docs/PixPin_2026-01-29_19-02-10.png)
![openwork screenshot](docs/PixPin_2026-01-29_19-03-31.png)

## Quick Start

### Requirements

- Node.js `>=18`
- npm
- Docker (optional, but recommended for isolated execution)

### Local Development

```bash
git clone https://github.com/langchain-ai/openwork.git
cd openwork
npm install
npm run dev
```

### Build

```bash
npm run build
```

## Feature Overview

- Dual workspace modes: `Classic` (thread workflow) and `Butler` (orchestration workflow).
- Standalone window capabilities: Quick Input (global shortcut `Ctrl+Alt+Space`) and task desktop popup.
- Thread types supported: `default / ralph / email / loop / expert / butler`.

## Classic Page Features

### Thread Sidebar

- Create threads in different modes (default/ralph/email/loop/expert).
- Rename and delete threads, with option to delete thread memory summaries.
- Filter threads by source (all / human / butler).

### Central Tab Area

- Fixed `Agent` session page + file tabs for parallel browsing.
- File viewing supports code, text, images, PDF, media, and binary files.

### Chat Area

- Streaming agent conversations with tool call display (includes tool call / result).
- HITL approval, interruption, and cancellation (constrained by thread capability configuration).
- Voice input (STT) and voice output (TTS) support.
- Image and document attachment support (documents are parsed for text extraction before injection).

### Right Panel

- Task Todo status panel.
- Workspace file tree (associated directory, auto-refresh, file opening).
- Subagent running status list.
- Docker mounted file view.
- Ralph progress view (Ralph mode).

## Butler Page Features

### Main Session Orchestration

- Butler makes semantic decisions among "direct reply / clarify / create task" each round.
- Butler supports dual paths "direct tool operation / create task": daily operations prioritize direct tools without launching tasks.
- Supports single-round multi-task creation, dependency relationships (`dependsOn`), and concurrent scheduling.
- Supports task handoff (`context / filesystem / both`).

### Butler Daily Tool Functions

- `calendar_upsert`: Unified add/update calendar events (`action=create|update`).
- `countdown_upsert`: Unified add/update countdown timers (`action=create|update`).
- `query_calendar_events`: Query calendar events by time window (supports semantic time to absolute time conversion).
- `query_countdown_timers`: Query countdown timers by status and time window.
- `pull_rss_updates` + `query_rss_items`: Actively pull RSS and query summaries/detailed content.
- `query_mailbox`: Actively read today's emails or recent N emails (default last 10).
- Butler mode hard-restricts system commands and filesystem tool calls (dialogue/business tools/task creation only).

### Task Board

- Display task status (queued/running/completed/failed/cancelled).
- Support opening task threads directly from the board.
- Support clearing Butler history and task records.

### Monitor Board (Butler Monitor)

- Calendar event reminders.
- Countdown reminders.
- Email rule pulling (IMAP).
- RSS subscription incremental pulling.
- Support manual immediate pulling (`pullNow`).

### Summary Notifications

- Event notification cards and digest cards flow back to Butler.
- Support task muting and digest cycle configuration.

## Title Bar Management Center (Page Entry)

- `Settings`: Language/theme, Provider, Ralph, Email, Speech, Butler configuration, etc.
- `Subagents`: Sub-agent configuration (model, tools, middleware, skills, scope switches).
- `Tools`: Tool keys and enable status (Classic/Butler dual scope).
- `Skills`: Scan, create, install, edit, enable/disable (Classic/Butler dual scope).
- `MCP`: Server configuration, start/stop, tool discovery, scope switches.
- `Prompts`: Template new/search/view/edit/delete/copy.
- `Plugins`: Preset plugin management (currently built-in Actionbook).
- `Container`: Docker configuration and session control.
- `Memory`: Conversation Memory and Butler Global Memory management.

## IPC Core Capabilities (Module Level)

Main process IPC modules cover:

- Agent
- Threads
- Workspace
- Loop
- Expert
- Butler
- Butler Monitor
- Prompts
- Memory
- Models & Provider
- Tools
- Skills
- Subagents
- MCP
- Docker
- Settings
- Speech
- Notifications
- Plugins

Main process broadcast events include (non-exhaustive list):

- `threads:changed`
- `thread:history-updated`
- `app:toast`
- `app:task-card`
- `butler:state-changed`
- `butler:tasks-changed`
- `butler-monitor:event`

## Notifications & Standalone Window Capabilities

- System tray persistence, main window hide and restore.
- Task desktop popup (supports opening thread, closing, muting tasks).
- Quick Input standalone window (`Ctrl+Alt+Space` to summon, direct to Butler).

## Capability Boundaries & Implementation Details

- Messages must have a workspace bound to the thread before sending.
- Loop defaults to paused after application restart, not automatically resuming.
- Prompt templates are a material library, not automatically injected into every round of messages.
- Docker management entry is currently Windows-only by implementation limitation.
- The `Sync to Disk` button in the right file area is currently placeholder behavior, not representing implemented bidirectional sync.

## Memory System

### Automatic Memory Writing

- Automatically extract session summary after task completion (mode, brief description, details, tool process, preference tags, etc.).
- Butler main session (`butlerMain`) does not write dialogue memory summaries.

### Daily Profile

- Aggregate and generate daily profile and comparison text based on "yesterday's" task summaries at startup.
- Butler orchestration prompt references `[Daily Profile]` and `[Profile Delta]`.

### Management Entry

- Title bar `Memory` to view Conversation Memory (grouped by thread) and Butler Global Memory.
- Support one-click clearing of all memory.

## Local Data Directory

All local data defaults to `~/.openwork/`:

- `openwork.sqlite`: Main database (threads, prompt templates, MCP, tools, subagents, settings, etc.)
- `memory.sqlite`: Memory database (task summaries, daily profiles, Butler history messages/tasks)
- `langgraph.sqlite`: General checkpoint database
- `threads/*.sqlite`: Thread-level checkpoints
- `threads/*.ralph.jsonl`: Ralph logs
- `butler-workspaces/`: Butler task working directory (default, can be modified in settings)

## Related Documentation

- Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Email Mode: [`EMAIL.md`](EMAIL.md)
- Speech API: [`SPEECH_API.md`](SPEECH_API.md)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## License

[MIT](LICENSE) © LangChain
