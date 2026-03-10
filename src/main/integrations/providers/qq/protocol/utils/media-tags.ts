import { expandTilde } from "./platform.js"

const VALID_TAGS = ["qqimg", "qqvoice", "qqvideo", "qqfile"] as const

const TAG_ALIASES: Record<string, (typeof VALID_TAGS)[number]> = {
  qq_img: "qqimg",
  qqimage: "qqimg",
  qq_image: "qqimg",
  qqpic: "qqimg",
  qq_picture: "qqimg",
  img: "qqimg",
  image: "qqimg",
  pic: "qqimg",
  picture: "qqimg",
  qq_voice: "qqvoice",
  qqaudio: "qqvoice",
  qq_audio: "qqvoice",
  voice: "qqvoice",
  audio: "qqvoice",
  qq_video: "qqvideo",
  video: "qqvideo",
  qq_file: "qqfile",
  qqdoc: "qqfile",
  file: "qqfile",
  doc: "qqfile",
  document: "qqfile"
}

const ALL_TAG_NAMES = [...VALID_TAGS, ...Object.keys(TAG_ALIASES)].sort((a, b) => b.length - a.length)
const TAG_NAME_PATTERN = ALL_TAG_NAMES.join("|")

const MULTILINE_TAG_CLEANUP = new RegExp(
  `([<＜]\\s*(?:${TAG_NAME_PATTERN})\\s*[>＞])([\\s\\S]*?)([<＜]\\s*/?\\s*(?:${TAG_NAME_PATTERN})\\s*[>＞])`,
  "gi"
)

const FUZZY_MEDIA_TAG_REGEX = new RegExp(
  "`?[<＜]\\s*(" +
    TAG_NAME_PATTERN +
    ")\\s*[>＞][\"']?\\s*([^<＜＞\"'`]+?)\\s*[\"']?[<＜]\\s*/?\\s*(?:" +
    TAG_NAME_PATTERN +
    ")\\s*[>＞]`?",
  "gi"
)

function resolveTagName(raw: string): (typeof VALID_TAGS)[number] {
  const lower = raw.toLowerCase()
  if ((VALID_TAGS as readonly string[]).includes(lower)) {
    return lower as (typeof VALID_TAGS)[number]
  }
  return TAG_ALIASES[lower] ?? "qqimg"
}

export function normalizeMediaTags(text: string): string {
  const flattened = text.replace(MULTILINE_TAG_CLEANUP, (_match, open: string, body: string, close: string) => {
    const flatBody = body.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ")
    return `${open}${flatBody}${close}`
  })

  return flattened.replace(FUZZY_MEDIA_TAG_REGEX, (_match, rawTag: string, content: string) => {
    const tag = resolveTagName(rawTag)
    return `<${tag}>${expandTilde(content.trim())}</${tag}>`
  })
}
