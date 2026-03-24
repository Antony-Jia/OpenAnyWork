/* eslint-disable no-control-regex */
const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><]/g
const OSC_REGEX = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g

export function sanitizeActionbookOutput(raw: string): string {
  return raw
    .replace(OSC_REGEX, "")
    .replace(ANSI_REGEX, "")
    .replace(/\r/g, "\n")
    .replace(/\u0007/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
}
