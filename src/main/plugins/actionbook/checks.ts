import { spawn, type ChildProcessByStdio } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Readable } from "node:stream"
import { getOpenworkDir } from "../../storage"
import type {
  ActionbookCliCheck,
  ActionbookCommandResult,
  ActionbookExtensionCheck,
  ActionbookPrereqStatus,
  ActionbookSkillCheck
} from "../core/contracts"
import { sanitizeActionbookOutput } from "./parser"

export function getActionbookExecutable(): string {
  return "actionbook"
}

export async function runActionbookCommand(
  args: string[],
  timeoutMs = 10_000
): Promise<ActionbookCommandResult> {
  return new Promise((resolve) => {
    const cmd = getActionbookExecutable()
    let proc: ChildProcessByStdio<null, Readable, Readable>
    try {
      proc = spawn(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: process.env,
        shell: process.platform === "win32"
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to execute actionbook."
      resolve({
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: "",
        output: "",
        message
      })
      return
    }

    let stdout = ""
    let stderr = ""
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
        proc.kill("SIGTERM")
      }
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
    join(homedir(), ".codex", "skills", "actionbook", "SKILL.md"),
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

export async function checkActionbookExtension(): Promise<ActionbookExtensionCheck> {
  const pathResult = await runActionbookCommand(["extension", "path"])
  if (!pathResult.ok) {
    return {
      ok: false,
      message:
        pathResult.message ||
        "Actionbook extension not detected. Run `actionbook setup` if you need Extension mode."
    }
  }

  const extensionPath = resolveActionbookExtensionPath(pathResult.stdout || pathResult.output)
  if (!extensionPath) {
    return {
      ok: false,
      message: "Actionbook extension path output is empty."
    }
  }

  const manifestPath = join(extensionPath, "manifest.json")
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      message: "Extension folder found, but manifest.json is missing.",
      path: extensionPath
    }
  }

  return {
    ok: true,
    message: "Actionbook extension detected. Use it only when you need your existing Chrome session.",
    path: extensionPath,
    version: resolveActionbookExtensionVersion(manifestPath)
  }
}

export async function checkActionbookPrerequisites(): Promise<ActionbookPrereqStatus> {
  const cli = await checkActionbookCli()
  const skill = checkActionbookSkill()
  const extension = cli.ok
    ? await checkActionbookExtension()
    : {
        ok: false,
        message: "Actionbook CLI missing. Extension checks skipped."
      }

  return {
    checkedAt: new Date().toISOString(),
    cli,
    skill,
    extension
  }
}
