import { useCallback, useEffect, useState } from "react"
import type { ActionbookEvent, ActionbookRuntimeState, PresetPluginItem } from "@/plugins/types"

interface UseActionbookPluginResult {
  plugin: PresetPluginItem | null
  runtime: ActionbookRuntimeState | null
  loading: boolean
  busy: Record<string, boolean>
  error: string | null
  reload: () => Promise<void>
  toggleEnabled: (enabled: boolean) => Promise<void>
  refreshChecks: () => Promise<void>
  startBridge: () => Promise<void>
  stopBridge: () => Promise<void>
  runStatus: () => Promise<void>
  runPing: () => Promise<void>
}

function toErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return fallback
}

export function useActionbookPlugin(): UseActionbookPluginResult {
  const [plugin, setPlugin] = useState<PresetPluginItem | null>(null)
  const [runtime, setRuntime] = useState<ActionbookRuntimeState | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const setBusyFlag = useCallback((key: string, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const plugins = (await window.api.plugins.list()) as PresetPluginItem[]
      const actionbook = plugins.find((item) => item.id === "actionbook") ?? null
      setPlugin(actionbook)

      const nextRuntime = (await window.api.plugins.actionbookGetState()) as ActionbookRuntimeState
      setRuntime(nextRuntime)
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load Actionbook plugin state."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const unsubscribe = window.api.plugins.onActionbookEvent((event: ActionbookEvent) => {
      if (event.type === "state") {
        setRuntime(event.state)
      }
    })
    return () => {
      if (typeof unsubscribe === "function") unsubscribe()
    }
  }, [reload])

  const toggleEnabled = useCallback(
    async (enabled: boolean) => {
      setBusyFlag("toggle", true)
      setError(null)
      try {
        const item = (await window.api.plugins.setEnabled({
          id: "actionbook",
          enabled
        })) as PresetPluginItem
        setPlugin(item)
        const nextRuntime =
          (await window.api.plugins.actionbookGetState()) as ActionbookRuntimeState
        setRuntime(nextRuntime)
      } catch (err) {
        setError(toErrorMessage(err, "Failed to update plugin state."))
      } finally {
        setBusyFlag("toggle", false)
      }
    },
    [setBusyFlag]
  )

  const runAction = useCallback(
    async (key: string, action: () => Promise<ActionbookRuntimeState>) => {
      setBusyFlag(key, true)
      setError(null)
      try {
        const next = await action()
        setRuntime(next)
      } catch (err) {
        setError(toErrorMessage(err, "Plugin action failed."))
      } finally {
        setBusyFlag(key, false)
      }
    },
    [setBusyFlag]
  )

  const refreshChecks = useCallback(async () => {
    await runAction(
      "refresh",
      async () => window.api.plugins.actionbookRefreshChecks() as Promise<ActionbookRuntimeState>
    )
  }, [runAction])

  const startBridge = useCallback(async () => {
    await runAction(
      "start",
      async () => window.api.plugins.actionbookStart() as Promise<ActionbookRuntimeState>
    )
  }, [runAction])

  const stopBridge = useCallback(async () => {
    await runAction(
      "stop",
      async () => window.api.plugins.actionbookStop() as Promise<ActionbookRuntimeState>
    )
  }, [runAction])

  const runStatus = useCallback(async () => {
    await runAction(
      "status",
      async () => window.api.plugins.actionbookStatus() as Promise<ActionbookRuntimeState>
    )
  }, [runAction])

  const runPing = useCallback(async () => {
    await runAction(
      "ping",
      async () => window.api.plugins.actionbookPing() as Promise<ActionbookRuntimeState>
    )
  }, [runAction])

  return {
    plugin,
    runtime,
    loading,
    busy,
    error,
    reload,
    toggleEnabled,
    refreshChecks,
    startBridge,
    stopBridge,
    runStatus,
    runPing
  }
}
