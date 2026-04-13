# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm install          # Install dependencies (uses pnpm 10.28.0 internally)
npm run dev          # Start Electron dev server with hot reload

# Build & Distribution
npm run build        # TypeScript check + asset compilation
npm run dist         # Build Windows installer (NSIS + portable)

# Validation
npm run typecheck    # Full TypeScript validation (node + web tsconfig)
npm run lint         # ESLint + plugin boundary enforcement
npm run format       # Prettier formatting
npm run check:plugin-boundaries  # Validate plugin isolation rules
```

There are no automated tests — validation is done via `typecheck` + `lint` + manual testing.

## Architecture

This is an **Electron + React** desktop AI agent workbench. The three Electron processes each have a distinct role:

- **`src/main/`** — Node.js main process: all business logic, LLM calls, DB, file system, IPC handlers
- **`src/preload/`** — Security bridge: exposes `window.api` (typed IPC surface) to the renderer
- **`src/renderer/src/`** — React 19 frontend: Zustand state, UI components, zero direct Node.js access

### Main Process Subsystems

**Classic Agent** (`src/main/agent/`)
- `runtime.ts` — builds a LangGraph agent with tools + system prompt
- `run.ts` — streams agent execution, writes LangGraph checkpoints per-thread
- `prompts/` — mode-specific system prompts: `default`, `ralph`, `email`, `loop`, `expert`

**Butler Orchestrator** (`src/main/butler/`)
- `manager.ts` — session state; receives user messages, drives orchestrator turns
- `runtime.ts` — router decides: direct reply / clarify / create tasks
- `task-dispatcher.ts` — creates threads and executes tasks in parallel
- `prompt/composer.ts` — assembles the orchestrator prompt from composable section pipeline (`sections/`)

**IPC Handlers** (`src/main/ipc/`)
21 handler modules (agent, threads, butler, tools, skills, mcp, memory, settings, etc.), all registered in `src/main/index.ts`.

**Data Layer**
- SQLite via `sql.js` at `~/.openwork/openwork.sqlite` — threads, runs, settings, tool/skill/MCP configs
- Per-thread SQLite checkpoints at `~/.openwork/threads/<id>.sqlite` (LangGraph state)
- Butler workspace dirs at `~/.openwork/butler-workspaces/`

**Task Lifecycle Buses** (`src/main/notifications/`)
Internal event buses bridge agent/loop/email/butler task completions → UI updates and desktop notifications.

### Dual-Scope Capability System

Tools, skills, MCP servers, and subagents each have independent `enabled_classic` / `enabled_butler` flags. The scope is determined at invocation time:
- Manual chat thread → `classic` scope
- Butler-dispatched task → `butler` scope
- Loop/email threads → inherit from `createdBy` metadata

Use `setEnabledScope(name, scope, enabled)` IPC calls for fine-grained control; `setEnabled` syncs both scopes for backward compatibility.

### Plugin System

Plugins live in `src/main/plugins/` and must not be imported from non-plugin code (enforced by `check:plugin-boundaries`). Current plugins: **Actionbook** (browser automation) and **Knowledgebase** (document retrieval).

### Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | App startup, window management, all IPC registration |
| `src/main/agent/runtime.ts` | Agent graph construction (tools, model, prompt) |
| `src/main/butler/manager.ts` | Butler session orchestration |
| `src/main/butler/prompt/composer.ts` | Composable orchestrator prompt builder |
| `src/preload/index.ts` | Full typed IPC surface (`window.api`) |
| `src/renderer/src/App.tsx` | Root React component (layout, mode switching) |
| `src/renderer/src/lib/store.ts` | Zustand global state |
| `src/main/types.ts` | Shared TypeScript types (~800 lines) |
| `src/main/db/index.ts` | SQLite schema, migrations, and init |

## Extension Patterns

- **New thread mode** — add a prompt file in `src/main/agent/prompts/modes/`, register it in `prompts/index.ts`
- **New butler prompt section** — create in `src/main/butler/prompt/sections/`, add to the pipeline in `composer.ts`
- **New IPC module** — create handler file in `src/main/ipc/`, register in `src/main/index.ts`, expose via `src/preload/index.ts`
- **New plugin** — create in `src/main/plugins/` implementing `plugins/core/contracts.ts`, never import from outside plugin dir

## TypeScript

Two separate `tsconfig` targets:
- `tsconfig.node.json` — main process (CJS, Node.js types)
- `tsconfig.web.json` — renderer (ESM, DOM types)

`npm run typecheck` runs both. The renderer has no access to Node.js APIs — communicate only via `window.api`.
