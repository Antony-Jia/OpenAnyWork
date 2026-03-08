import os from "node:os"
import path from "node:path"

export function expandTilde(input: string): string {
  if (input === "~") {
    return os.homedir()
  }
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(os.homedir(), input.slice(2))
  }
  return input
}
