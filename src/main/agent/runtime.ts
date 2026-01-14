/* eslint-disable @typescript-eslint/no-unused-vars */
import { createDeepAgent, FilesystemBackend } from 'deepagents'
import { app } from 'electron'
import { join } from 'path'
import { getDefaultModel, getApiKey } from '../ipc/models'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import { SqlJsSaver } from '../checkpointer/sqljs-saver'

import type * as _lcTypes from 'langchain'
import type * as _lcMessages from '@langchain/core/messages'
import type * as _lcLanggraph from '@langchain/langgraph'
import type * as _lcZodTypes from '@langchain/core/utils/types'

import { BASE_SYSTEM_PROMPT } from './system-prompt'

/**
 * Generate the full system prompt for the agent.
 *
 * @param workspacePath - The workspace path the agent is operating in
 * @returns The complete system prompt
 */
function getSystemPrompt(workspacePath: string): string {
  const workingDirSection = `### Current Working Directory

The filesystem backend is currently operating in: \`${workspacePath}\`

### File System and Paths

**IMPORTANT - Path Handling:**
- All file paths must be absolute paths (e.g., \`${workspacePath}/file.txt\`)
- Use the working directory to construct absolute paths
- Example: To create a file in your working directory, use \`${workspacePath}/research_project/file.md\`
- Never use relative paths - always construct full absolute paths

`

  return workingDirSection + BASE_SYSTEM_PROMPT
}

// Singleton checkpointer instance
let checkpointer: SqlJsSaver | null = null

export async function getCheckpointer(): Promise<SqlJsSaver> {
  if (!checkpointer) {
    const dbPath = join(app.getPath('userData'), 'langgraph.sqlite')
    checkpointer = new SqlJsSaver(dbPath)
    await checkpointer.initialize()
  }
  return checkpointer
}

// Get the appropriate model instance based on configuration
function getModelInstance(modelId?: string): ChatAnthropic | ChatOpenAI | string {
  const model = modelId || getDefaultModel()
  console.log('[Runtime] Using model:', model)

  // Determine provider from model ID
  if (model.startsWith('claude')) {
    const apiKey = getApiKey('anthropic')
    console.log('[Runtime] Anthropic API key present:', !!apiKey)
    if (!apiKey) {
      throw new Error('Anthropic API key not configured')
    }
    return new ChatAnthropic({
      model,
      anthropicApiKey: apiKey
    })
  } else if (
    model.startsWith('gpt') ||
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('o4')
  ) {
    const apiKey = getApiKey('openai')
    console.log('[Runtime] OpenAI API key present:', !!apiKey)
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }
    return new ChatOpenAI({
      model,
      openAIApiKey: apiKey
    })
  } else if (model.startsWith('gemini')) {
    // For Gemini, we'd need @langchain/google-genai
    throw new Error('Gemini support coming soon')
  }

  // Default to model string (let deepagents handle it)
  return model
}

export interface CreateAgentRuntimeOptions {
  /** Model ID to use (defaults to configured default model) */
  modelId?: string
  /** Workspace path - REQUIRED for agent to operate on files */
  workspacePath: string
}

// Create agent runtime with configured model and checkpointer
export type AgentRuntime = ReturnType<typeof createDeepAgent>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createAgentRuntime(options: CreateAgentRuntimeOptions) {
  const { modelId, workspacePath } = options

  if (!workspacePath) {
    throw new Error('Workspace path is required. Please select a workspace folder before running the agent.')
  }

  console.log('[Runtime] Creating agent runtime...')
  console.log('[Runtime] Workspace path:', workspacePath)

  const model = getModelInstance(modelId)
  console.log('[Runtime] Model instance created:', typeof model)

  const checkpointer = await getCheckpointer()
  console.log('[Runtime] Checkpointer ready')

  const backend = new FilesystemBackend({
    rootDir: workspacePath,
    virtualMode: true // Use virtual paths starting with /
  })

  const systemPrompt = getSystemPrompt(workspacePath)

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend,
    systemPrompt
  })

  console.log('[Runtime] Deep agent created with FilesystemBackend at:', workspacePath)
  return agent
}

export type DeepAgent = ReturnType<typeof createDeepAgent>

// Clean up resources
export async function closeRuntime(): Promise<void> {
  if (checkpointer) {
    await checkpointer.close()
    checkpointer = null
  }
}
