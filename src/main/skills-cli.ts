import { spawn } from "node:child_process"
import { homedir } from "node:os"
import type { SkillsCliResult } from "./types"
import { getAgentUserSkillsRoot, scanAndImportAgentUserSkills } from "./skills"

function getNpxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx"
}

function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\u001b\[[0-9;]*m/g, "")
}

async function runSkillsCli(
  args: string[],
  cwd: string,
  summary: string
): Promise<SkillsCliResult> {
  const command = `${getNpxCommand()} ${args.join(" ")}`

  const result = await new Promise<SkillsCliResult>((resolve, reject) => {
    const proc = spawn(getNpxCommand(), args, {
      cwd,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })
    proc.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    proc.on("error", (error) => reject(error))
    proc.on("close", (code) => {
      const normalizedStdout = stripAnsi(stdout).trim()
      const normalizedStderr = stripAnsi(stderr).trim()
      if (code !== 0) {
        reject(
          new Error(normalizedStderr || normalizedStdout || `skills CLI failed with code ${code}`)
        )
        return
      }
      resolve({
        ok: true,
        command,
        stdout: normalizedStdout,
        stderr: normalizedStderr,
        summary
      })
    })
  })

  scanAndImportAgentUserSkills()
  return result
}

export async function cliAddSkill(input: {
  source: string
  skillNames?: string[]
}): Promise<SkillsCliResult> {
  const source = input.source.trim()
  if (!source) {
    throw new Error("Skill source is required.")
  }
  const args = ["skills", "add", source, "-a", "codex", "--copy", "-y"]
  for (const skillName of input.skillNames ?? []) {
    const normalized = skillName.trim()
    if (!normalized) continue
    args.push("--skill", normalized)
  }
  return runSkillsCli(args, homedir(), `Installed skill source into ${getAgentUserSkillsRoot()}.`)
}

export async function cliListSkills(): Promise<SkillsCliResult> {
  return runSkillsCli(
    ["skills", "list", "-a", "codex"],
    homedir(),
    `Listed skills from ${getAgentUserSkillsRoot()}.`
  )
}

export async function cliFindSkills(query: string): Promise<SkillsCliResult> {
  const normalized = query.trim()
  if (!normalized) {
    throw new Error("Find query is required.")
  }
  return runSkillsCli(
    ["skills", "find", normalized],
    homedir(),
    `Searched skills for "${normalized}".`
  )
}

export async function cliRemoveSkills(names: string[]): Promise<SkillsCliResult> {
  const normalized = names.map((name) => name.trim()).filter(Boolean)
  if (normalized.length === 0) {
    throw new Error("At least one skill name is required.")
  }
  return runSkillsCli(
    ["skills", "remove", ...normalized, "-a", "codex", "-y"],
    homedir(),
    `Removed ${normalized.length} skill(s) from ${getAgentUserSkillsRoot()}.`
  )
}

export async function cliCheckSkills(): Promise<SkillsCliResult> {
  return runSkillsCli(
    ["skills", "check"],
    homedir(),
    `Checked ${getAgentUserSkillsRoot()} for skill updates.`
  )
}

export async function cliUpdateSkills(): Promise<SkillsCliResult> {
  return runSkillsCli(
    ["skills", "update"],
    homedir(),
    `Updated installed skills under ${getAgentUserSkillsRoot()}.`
  )
}

export async function cliInitSkill(name: string): Promise<SkillsCliResult> {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error("Skill name is required.")
  }
  return runSkillsCli(
    ["skills", "init", normalized],
    getAgentUserSkillsRoot(),
    `Initialized ${normalized} in ${getAgentUserSkillsRoot()}.`
  )
}
