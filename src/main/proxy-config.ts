/**
 * Proxy configuration management
 *
 * Handles proxy settings for:
 * 1. LLM API calls (OpenAI, Anthropic, Google, etc.)
 * 2. HTTP/HTTPS fetch requests
 * 3. Shell subprocess environment variables
 */

import type { Agent as HttpAgent } from "node:http"
import type { Agent as HttpsAgent } from "node:https"
import { getDb } from "./db"
import type { ProxyConfig } from "./types"

const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  mode: "system"
}

const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "http_proxy",
  "HTTPS_PROXY",
  "https_proxy",
  "NO_PROXY",
  "no_proxy"
] as const

let originalFetch: typeof globalThis.fetch | undefined
let activeFetchDispatcher: { close?: () => Promise<void> | void } | undefined

type ProxyableRequestInit = RequestInit & {
  dispatcher?: unknown
}

/**
 * Get current proxy configuration from database
 */
export function getProxyConfig(): ProxyConfig {
  const database = getDb()
  const stmt = database.prepare("SELECT data FROM proxy_config WHERE id = 1")
  const row = stmt.get() as { data?: string } | undefined

  if (!row?.data) {
    return { ...DEFAULT_PROXY_CONFIG }
  }

  try {
    const config = JSON.parse(row.data) as ProxyConfig
    return { ...DEFAULT_PROXY_CONFIG, ...config }
  } catch (error) {
    console.error("[Proxy] Failed to parse proxy config:", error)
    return { ...DEFAULT_PROXY_CONFIG }
  }
}

/**
 * Save proxy configuration to database
 */
export function setProxyConfig(config: ProxyConfig): void {
  const database = getDb()
  database.run(
    "INSERT OR REPLACE INTO proxy_config (id, data) VALUES (1, ?)",
    [JSON.stringify(config, null, 2)]
  )
  console.log("[Proxy] Proxy configuration saved:", config.mode)
}

/**
 * Initialize proxy configuration table in database
 */
export function initializeProxyConfigTable(): void {
  const database = getDb()
  database.exec(`
    CREATE TABLE IF NOT EXISTS proxy_config (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    )
  `)
  console.log("[Proxy] Proxy config table initialized")
}

/**
 * Build proxy environment variables based on current configuration
 * Returns an object that can be merged into process.env or spawn env
 */
export function getProxyEnvVars(): Record<string, string> {
  const config = getProxyConfig()
  const envVars: Record<string, string> = {}

  if (config.mode === "disabled") {
    return envVars
  }

  if (config.mode === "manual") {
    const { httpProxy, httpsProxy } = resolveProxyUrls(config)

    if (httpProxy) {
      envVars.HTTP_PROXY = httpProxy
      envVars.http_proxy = httpProxy
    }
    if (httpsProxy) {
      envVars.HTTPS_PROXY = httpsProxy
      envVars.https_proxy = httpsProxy
    }
    if (config.noProxy) {
      envVars.NO_PROXY = config.noProxy
      envVars.no_proxy = config.noProxy
    }
  } else if (config.mode === "system") {
    // System mode: inherit from process.env
    const systemHttpProxy = process.env.HTTP_PROXY || process.env.http_proxy
    const systemHttpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
    const systemNoProxy = process.env.NO_PROXY || process.env.no_proxy

    if (systemHttpProxy) {
      envVars.HTTP_PROXY = systemHttpProxy
      envVars.http_proxy = systemHttpProxy
    }
    if (systemHttpsProxy) {
      envVars.HTTPS_PROXY = systemHttpsProxy
      envVars.https_proxy = systemHttpsProxy
    }
    if (systemNoProxy) {
      envVars.NO_PROXY = systemNoProxy
      envVars.no_proxy = systemNoProxy
    }
  }

  return envVars
}

/**
 * Remove proxy environment variables from a process environment object.
 */
export function stripProxyEnvVars(
  env: Record<string, string | undefined>
): Record<string, string> {
  const sanitizedEnv = { ...env }

  for (const key of PROXY_ENV_KEYS) {
    delete sanitizedEnv[key]
  }

  return sanitizedEnv as Record<string, string>
}

/**
 * Get HTTP/HTTPS agents for SDK clients that support node agents.
 */
export function getProxyAgents(): {
  httpAgent?: HttpAgent
  httpsAgent?: HttpsAgent
} {
  const { httpProxy, httpsProxy } = resolveProxyUrls(getProxyConfig())

  if (!httpProxy && !httpsProxy) {
    return {}
  }

  try {
    const { HttpProxyAgent, HttpsProxyAgent } = require("hpagent") as typeof import("hpagent")
    return {
      ...(httpProxy ? { httpAgent: new HttpProxyAgent({ proxy: httpProxy }) } : {}),
      ...(httpsProxy ? { httpsAgent: new HttpsProxyAgent({ proxy: httpsProxy }) } : {})
    }
  } catch (error) {
    console.warn("[Proxy] Failed to create proxy agents:", error)
    return {}
  }
}

/**
 * Apply proxy settings to global fetch (Node.js globalThis.fetch)
 * This patches fetch to use an undici ProxyAgent for all HTTP/HTTPS requests.
 */
export function applyProxyToFetch(): void {
  if (!originalFetch) {
    originalFetch = globalThis.fetch.bind(globalThis)
  }

  globalThis.fetch = originalFetch
  closeActiveFetchDispatcher()

  const config = getProxyConfig()
  const { httpsProxy, httpProxy } = resolveProxyUrls(config)
  const proxyUrl = httpsProxy || httpProxy

  if (!proxyUrl) {
    console.log("[Proxy] Fetch proxy disabled or not configured")
    return
  }

  try {
    const { ProxyAgent } = require("undici") as typeof import("undici")
    const dispatcher = new ProxyAgent(proxyUrl)
    activeFetchDispatcher = dispatcher

    globalThis.fetch = async function (input, init: ProxyableRequestInit = {}) {
      const url = resolveRequestUrl(input)

      if (!url || shouldBypassProxy(url.hostname, config) || init.dispatcher) {
        return originalFetch!(input, init as RequestInit)
      }

      return originalFetch!(input, {
        ...init,
        dispatcher
      } as RequestInit)
    }

    console.log("[Proxy] Fetch proxy applied:", proxyUrl)
  } catch (error) {
    console.warn("[Proxy] Failed to apply proxy to fetch:", error)
  }
}

/**
 * Check if a hostname should bypass the proxy
 */
function shouldBypassProxy(hostname: string, config: ProxyConfig): boolean {
  // Always bypass localhost
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true
  }

  // Check noProxy list
  const noProxyList = config.mode === "manual"
    ? (config.noProxy || "")
    : (process.env.NO_PROXY || process.env.no_proxy || "")

  if (!noProxyList) return false

  const domains = noProxyList.split(",").map((d) => d.trim()).filter(Boolean)

  for (const domain of domains) {
    const normalizedDomain = domain.startsWith("*.") ? domain.slice(1) : domain

    if (normalizedDomain.startsWith(".")) {
      const bareDomain = normalizedDomain.slice(1)
      if (hostname === bareDomain || hostname.endsWith(normalizedDomain)) {
        return true
      }
    } else if (hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)) {
      return true
    }
  }

  return false
}

function resolveProxyUrls(config: ProxyConfig): {
  httpProxy?: string
  httpsProxy?: string
} {
  if (config.mode === "disabled") {
    return {}
  }

  if (config.mode === "manual") {
    return {
      httpProxy: config.httpProxy || config.httpsProxy,
      httpsProxy: config.httpsProxy || config.httpProxy
    }
  }

  return {
    httpProxy:
      process.env.HTTP_PROXY ||
      process.env.http_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.https_proxy,
    httpsProxy:
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy
  }
}

function resolveRequestUrl(input: RequestInfo | URL): URL | undefined {
  try {
    if (input instanceof URL) {
      return input
    }

    if (typeof input === "string") {
      return new URL(input)
    }

    if (input && typeof input === "object" && "url" in input && typeof input.url === "string") {
      return new URL(input.url)
    }
  } catch {
    return undefined
  }

  return undefined
}

function closeActiveFetchDispatcher(): void {
  if (!activeFetchDispatcher?.close) {
    activeFetchDispatcher = undefined
    return
  }

  Promise.resolve(activeFetchDispatcher.close()).catch((error) => {
    console.warn("[Proxy] Failed to close previous fetch proxy dispatcher:", error)
  })
  activeFetchDispatcher = undefined
}
