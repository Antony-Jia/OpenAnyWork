import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { getOpenworkDir } from "../../storage"
import type {
  ActionbookCliCheck,
  ActionbookCommandResult,
  ActionbookExtensionCheck,
  ActionbookPrereqStatus,
  ActionbookSkillCheck
} from "../core/contracts"
import {
  parseActionbookPingLine,
  parseActionbookStatusLine,
  sanitizeActionbookOutput
} from "./parser"

export function getActionbookExecutable(): string {
  return process.platform === "win32" ? "actionbook.cmd" : "actionbook"
}

export async function runActionbookCommand(
  args: string[],
  timeoutMs = 10_000
): Promise<ActionbookCommandResult> {
  return new Promise((resolve) => {
    const cmd = getActionbookExecutable()
    const proc = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: process.env
    })

    let stdout = ""
    let stderr = ""
    let resolved = false

    const timeout = setTimeout(() => {
      if (resolved) return
      resolved = true
      proc.kill("SIGTERM")
      const output = sanitizeActionbookOutput(`${stdout}\n${stderr}`).trim()
      resolve({
        ok: false,
        exitCode: null,
        stdout: sanitizeActionbookOutput(stdout),
        stderr: sanitizeActionbookOutput(stderr),
        output,
        message: output || "Actionbook command timed out."
      })
    }, timeoutMs)

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on("error", (error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      const message = error instanceof Error ? error.message : "Failed to execute actionbook."
      resolve({
        ok: false,
        exitCode: 1,
        stdout: sanitizeActionbookOutput(stdout),
        stderr: sanitizeActionbookOutput(stderr),
        output: sanitizeActionbookOutput(`${stdout}\n${stderr}`).trim(),
        message
      })
    })

    proc.on("close", (exitCode) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      const cleanStdout = sanitizeActionbookOutput(stdout)
      const cleanStderr = sanitizeActionbookOutput(stderr)
      const output = sanitizeActionbookOutput(`${stdout}\n${stderr}`).trim()
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout: cleanStdout,
        stderr: cleanStderr,
        output,
        message: output || (exitCode === 0 ? "OK" : "Command failed.")
      })
    })
  })
}

export async function checkActionbookCli(): Promise<ActionbookCliCheck> {
  const result = await runActionbookCommand(["--version"])
  if (!result.ok) {
    return {
      ok: false,
      message: result.message || "Actionbook CLI not found."
    }
  }

  const versionMatch = result.output.match(/actionbook\s+([0-9A-Za-z.-]+)/i)
  const version = versionMatch?.[1]
  return {
    ok: true,
    message: version ? `Actionbook CLI detected (${version}).` : "Actionbook CLI detected.",
    version
  }
}

function getActionbookSkillCandidates(): string[] {
  return [
    join(homedir(), ".agents", "skills", "actionbook", "SKILL.md"),
    join(getOpenworkDir(), "skills", "actionbook", "SKILL.md")
  ]
}

export function checkActionbookSkill(): ActionbookSkillCheck {
  const skillPath = getActionbookSkillCandidates().find((candidate) => existsSync(candidate))
  if (!skillPath) {
    return {
      ok: false,
      message: "Actionbook skill is missing. Install with: npx skills add actionbook/actionbook"
    }
  }

  return {
    ok: true,
    message: "Actionbook skill detected.",
    path: skillPath
  }
}

function resolveActionbookExtensionVersion(manifestPath: string): string | undefined {
  try {
    const content = readFileSync(manifestPath, "utf-8")
    const parsed = JSON.parse(content) as { version?: string }
    return typeof parsed.version === "string" ? parsed.version : undefined
  } catch {
    return undefined
  }
}

function resolveActionbookExtensionPath(rawOutput: string): string | null {
  const line = sanitizeActionbookOutput(rawOutput)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1)
  if (!line) return null
  return line
}

export async function checkActionbookExtension(port: number): Promise<ActionbookExtensionCheck> {
  const pathResult = await runActionbookCommand(["extension", "path"])
  if (!pathResult.ok) {
    return {
      ok: false,
      message: pathResult.message || "Failed to detect Actionbook extension path.",
      bridgeRunning: false,
      extensionConnected: false
    }
  }

  const extensionPath = resolveActionbookExtensionPath(pathResult.stdout || pathResult.output)
  if (!extensionPath) {
    return {
      ok: false,
      message: "Actionbook extension path output is empty.",
      bridgeRunning: false,
      extensionConnected: false
    }
  }

  const manifestPath = join(extensionPath, "manifest.json")
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      message: "Extension folder found, but manifest.json is missing.",
      path: extensionPath,
      bridgeRunning: false,
      extensionConnected: false
    }
  }

  const statusResult = await runActionbookCommand(["extension", "status", "--port", String(port)])
  const statusInfo = parseActionbookStatusLine(statusResult.output)

  const pingResult = await runActionbookCommand(["extension", "ping", "--port", String(port)])
  const pingInfo = parseActionbookPingLine(pingResult.output)

  return {
    ok: true,
    message: "Actionbook extension files detected.",
    path: extensionPath,
    version: resolveActionbookExtensionVersion(manifestPath),
    bridgeRunning: statusInfo.bridgeRunning,
    extensionConnected: pingInfo.connected,
    statusMessage: statusInfo.message,
    pingMessage: pingInfo.message
  }
}

export function getActionbookTokenFileCandidates(): string[] {
  const localAppData = process.env["LOCALAPPDATA"]
  const xdgDataHome = process.env["XDG_DATA_HOME"]
  const candidates: string[] = []

  if (localAppData) {
    candidates.push(join(localAppData, "actionbook", "bridge-token"))
  }
  if (xdgDataHome) {
    candidates.push(join(xdgDataHome, "actionbook", "bridge-token"))
  }
  candidates.push(join(homedir(), ".local", "share", "actionbook", "bridge-token"))
  candidates.push(join(homedir(), "Library", "Application Support", "actionbook", "bridge-token"))

  return candidates
}

export function readActionbookTokenFromFile(): {
  token: string
  path: string
} | null {
  for (const tokenPath of getActionbookTokenFileCandidates()) {
    if (!existsSync(tokenPath)) continue
    try {
      const token = readFileSync(tokenPath, "utf-8").trim()
      if (token) {
        return { token, path: tokenPath }
      }
    } catch {
      // ignore and continue
    }
  }
  return null
}

export async function checkActionbookPrerequisites(port: number): Promise<ActionbookPrereqStatus> {
  const cli = await checkActionbookCli()
  const skill = checkActionbookSkill()
  const extension = cli.ok
    ? await checkActionbookExtension(port)
    : {
        ok: false,
        message: "Actionbook CLI missing. Extension checks skipped.",
        bridgeRunning: false,
        extensionConnected: false
      }

  return {
    checkedAt: new Date().toISOString(),
    cli,
    skill,
    extension
  }
}
