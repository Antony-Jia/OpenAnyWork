import { spawn, type ChildProcessByStdio } from "node:child_process"
import type { Readable } from "node:stream"
import { getActionbookExecutable } from "./checks"
import { splitActionbookLines } from "./parser"

export interface ActionbookBridgeLine {
  source: "stdout" | "stderr"
  line: string
}

interface ActionbookBridgeManagerOptions {
  port: number
  onLine: (line: ActionbookBridgeLine) => void
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void
  onError: (message: string) => void
}

type SpawnedBridgeProcess = ChildProcessByStdio<null, Readable, Readable>

export class ActionbookBridgeManager {
  private readonly port: number
  private readonly onLine: (line: ActionbookBridgeLine) => void
  private readonly onExit: (code: number | null, signal: NodeJS.Signals | null) => void
  private readonly onError: (message: string) => void
  private process: SpawnedBridgeProcess | null = null
  private stdoutRemainder = ""
  private stderrRemainder = ""

  constructor(options: ActionbookBridgeManagerOptions) {
    this.port = options.port
    this.onLine = options.onLine
    this.onExit = options.onExit
    this.onError = options.onError
  }

  isRunning(): boolean {
    return !!this.process
  }

  getPid(): number | undefined {
    return this.process?.pid
  }

  start(): { started: boolean; message: string; pid?: number } {
    if (this.process) {
      return {
        started: false,
        message: "Actionbook bridge is already running.",
        pid: this.process.pid
      }
    }

    const executable = getActionbookExecutable()
    const args = ["extension", "serve", "--port", String(this.port)]
    let proc: SpawnedBridgeProcess
    try {
      proc = spawn(executable, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: process.env,
        shell: process.platform === "win32"
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Actionbook bridge failed to start."
      this.onError(message)
      return {
        started: false,
        message
      }
    }
    this.process = proc

    this.stdoutRemainder = ""
    this.stderrRemainder = ""

    proc.stdout.on("data", (chunk: Buffer) => {
      const parsed = splitActionbookLines(this.stdoutRemainder, chunk.toString())
      this.stdoutRemainder = parsed.remainder
      for (const line of parsed.lines) {
        this.onLine({ source: "stdout", line })
      }
    })

    proc.stderr.on("data", (chunk: Buffer) => {
      const parsed = splitActionbookLines(this.stderrRemainder, chunk.toString())
      this.stderrRemainder = parsed.remainder
      for (const line of parsed.lines) {
        this.onLine({ source: "stderr", line })
      }
    })

    proc.on("error", (error) => {
      const message = error instanceof Error ? error.message : "Actionbook bridge failed to start."
      this.onError(message)
    })

    proc.on("close", (code, signal) => {
      const stdoutTail = this.stdoutRemainder.trim()
      if (stdoutTail) {
        this.onLine({ source: "stdout", line: stdoutTail })
      }
      const stderrTail = this.stderrRemainder.trim()
      if (stderrTail) {
        this.onLine({ source: "stderr", line: stderrTail })
      }

      this.stdoutRemainder = ""
      this.stderrRemainder = ""
      this.process = null
      this.onExit(code, signal)
    })

    return {
      started: true,
      message: "Actionbook bridge process started.",
      pid: proc.pid
    }
  }

  async stop(): Promise<{ stopped: boolean; message: string }> {
    if (!this.process) {
      return {
        stopped: false,
        message: "No managed Actionbook bridge process is running."
      }
    }

    const proc = this.process
    return new Promise((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (resolved) return
        resolved = true
        if (process.platform === "win32" && proc.pid) {
          spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true
          })
        } else {
          proc.kill("SIGKILL")
        }
        resolve({
          stopped: true,
          message: "Managed Actionbook bridge process force-stopped."
        })
      }, 4_000)

      proc.once("close", () => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        resolve({
          stopped: true,
          message: "Managed Actionbook bridge process stopped."
        })
      })
      if (process.platform === "win32") {
        if (proc.pid) {
          const killer = spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true
          })
          killer.on("error", () => {
            proc.kill("SIGKILL")
          })
        } else {
          proc.kill("SIGKILL")
        }
      } else {
        proc.kill("SIGTERM")
      }
    })
  }
}
