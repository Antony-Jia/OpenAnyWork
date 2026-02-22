import * as fs from "node:fs/promises"
import * as path from "node:path"
import mammoth from "mammoth"
import pdfParse from "pdf-parse"

export type DocumentParserKind = "pdf" | "docx" | "text"

export interface ParseDocumentTextInput {
  filePath: string
  returnChars?: number
  returnAll?: boolean
}

export interface ParseDocumentTextResult {
  filePath: string
  fileName: string
  extension: string
  parser: DocumentParserKind
  fullTextLength: number
  returnedTextLength: number
  truncated: boolean
  parseNotice: string
  text: string
}

export const DEFAULT_DOCUMENT_RETURN_CHARS = 2000

export const BASIC_DOCUMENT_PARSE_NOTICE =
  "Basic parser only: text is extracted with common methods and may lose formatting."

const PDF_EXTENSION = ".pdf"
const DOCX_EXTENSION = ".docx"
const TEXT_FILE_BASENAMES = new Set(["dockerfile", "makefile"])
const TEXT_FILE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".mdx",
  ".log",
  ".csv",
  ".tsv",
  ".env",
  ".ini",
  ".cfg",
  ".conf",
  ".toml",
  ".yaml",
  ".yml",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".cc",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".psm1",
  ".vue",
  ".svelte",
  ".kt",
  ".swift",
  ".m",
  ".mm",
  ".r",
  ".proto",
  ".graphql",
  ".gitignore",
  ".editorconfig"
])

export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  PDF_EXTENSION,
  DOCX_EXTENSION,
  ...Array.from(TEXT_FILE_EXTENSIONS)
].sort()

export const SUPPORTED_DOCUMENT_FILTER_EXTENSIONS = SUPPORTED_DOCUMENT_EXTENSIONS.map((ext) =>
  ext.startsWith(".") ? ext.slice(1) : ext
)

function normalizeReturnChars(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DOCUMENT_RETURN_CHARS
  }
  const normalized = Math.floor(value)
  if (normalized <= 0) {
    return DEFAULT_DOCUMENT_RETURN_CHARS
  }
  return normalized
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").split("\u0000").join("")
}

function resolveParserKind(filePath: string): DocumentParserKind {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === PDF_EXTENSION) return "pdf"
  if (extension === DOCX_EXTENSION) return "docx"

  const baseName = path.basename(filePath).toLowerCase()
  if (TEXT_FILE_EXTENSIONS.has(extension) || TEXT_FILE_BASENAMES.has(baseName)) {
    return "text"
  }

  const supported = [...SUPPORTED_DOCUMENT_EXTENSIONS, ...Array.from(TEXT_FILE_BASENAMES)].join(
    ", "
  )
  throw new Error(`Unsupported file format. Supported formats: ${supported}`)
}

async function extractText(filePath: string, parser: DocumentParserKind): Promise<string> {
  if (parser === "pdf") {
    const buffer = await fs.readFile(filePath)
    const result = await pdfParse(buffer)
    return typeof result.text === "string" ? result.text : ""
  }

  if (parser === "docx") {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value || ""
  }

  return fs.readFile(filePath, "utf-8")
}

export function isSupportedDocumentPath(filePath: string): boolean {
  try {
    resolveParserKind(filePath)
    return true
  } catch {
    return false
  }
}

export async function parseDocumentText(
  input: ParseDocumentTextInput
): Promise<ParseDocumentTextResult> {
  const resolvedPath = path.resolve(input.filePath)
  const parser = resolveParserKind(resolvedPath)
  const rawText = await extractText(resolvedPath, parser)
  const fullText = normalizeText(rawText)
  const fullTextLength = fullText.length
  const returnChars = normalizeReturnChars(input.returnChars)
  const returnAll = input.returnAll === true
  const text = returnAll ? fullText : fullText.slice(0, returnChars)
  const returnedTextLength = text.length
  const truncated = !returnAll && fullTextLength > returnChars

  return {
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath),
    extension: path.extname(resolvedPath).toLowerCase(),
    parser,
    fullTextLength,
    returnedTextLength,
    truncated,
    parseNotice: BASIC_DOCUMENT_PARSE_NOTICE,
    text
  }
}
