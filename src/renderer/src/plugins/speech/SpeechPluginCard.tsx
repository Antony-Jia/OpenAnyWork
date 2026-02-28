import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n"
import type { AppSettings } from "@/types"

function serializeKeyValue(record?: Record<string, string>): string {
  if (!record) return ""
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
}

function parseKeyValue(text: string): Record<string, string> | undefined {
  const entries = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (entries.length === 0) return undefined

  const result: Record<string, string> = {}
  for (const entry of entries) {
    const [rawKey, ...rest] = entry.split("=")
    const key = rawKey?.trim()
    if (!key) continue
    result[key] = rest.join("=").trim()
  }

  return Object.keys(result).length > 0 ? result : undefined
}

interface SpeechPluginCardProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function SpeechPluginCard({
  collapsed,
  onToggleCollapsed
}: SpeechPluginCardProps): React.JSX.Element {
  const { t } = useLanguage()
  const [sttUrl, setSttUrl] = useState("")
  const [sttHeaders, setSttHeaders] = useState("")
  const [sttLanguage, setSttLanguage] = useState("")
  const [ttsUrl, setTtsUrl] = useState("")
  const [ttsHeaders, setTtsHeaders] = useState("")
  const [ttsVoice, setTtsVoice] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const settings = (await window.api.settings.get()) as AppSettings
        if (settings?.speech) {
          setSttUrl(settings.speech.stt?.url || "")
          setSttHeaders(serializeKeyValue(settings.speech.stt?.headers))
          setSttLanguage(settings.speech.stt?.language || "")
          setTtsUrl(settings.speech.tts?.url || "")
          setTtsHeaders(serializeKeyValue(settings.speech.tts?.headers))
          setTtsVoice(settings.speech.tts?.voice || "")
        }
      } catch (e) {
        console.error("Failed to load speech settings:", e)
      }
    }
    void load()
  }, [])

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await window.api.settings.update({
        updates: {
          speech: {
            stt: {
              url: sttUrl.trim(),
              headers: parseKeyValue(sttHeaders),
              language: sttLanguage.trim()
            },
            tts: {
              url: ttsUrl.trim(),
              headers: parseKeyValue(ttsHeaders),
              voice: ttsVoice.trim()
            }
          }
        }
      })
      window.dispatchEvent(new CustomEvent("openwork:settings-updated"))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error("Failed to save speech settings:", e)
    }
  }, [sttUrl, sttHeaders, sttLanguage, ttsUrl, ttsHeaders, ttsVoice])

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 px-5 py-3.5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {collapsed ? (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-[15px] font-semibold">{t("settings.speech.title")}</span>
        </button>
      </div>

      {!collapsed && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-5">
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              {t("settings.speech.stt_title")}
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-muted-foreground block">
                {t("settings.speech.stt_url")}
              </label>
              <input
                type="text"
                value={sttUrl}
                onChange={(e) => setSttUrl(e.target.value)}
                placeholder="https://example.com/stt"
                className="w-full h-8 px-2.5 text-[13px] bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-muted-foreground block">
                {t("settings.speech.headers")}
              </label>
              <textarea
                value={sttHeaders}
                onChange={(e) => setSttHeaders(e.target.value)}
                placeholder={t("settings.speech.headers_placeholder")}
                className="w-full min-h-[64px] px-2.5 py-2 text-[13px] bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-muted-foreground block">
                {t("settings.speech.stt_language_label")}
              </label>
              <input
                type="text"
                value={sttLanguage}
                onChange={(e) => setSttLanguage(e.target.value)}
                placeholder={t("settings.speech.stt_language")}
                className="w-full h-8 px-2.5 text-[13px] bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              {t("settings.speech.tts_title")}
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-muted-foreground block">
                {t("settings.speech.tts_url")}
              </label>
              <input
                type="text"
                value={ttsUrl}
                onChange={(e) => setTtsUrl(e.target.value)}
                placeholder="https://example.com/tts"
                className="w-full h-8 px-2.5 text-[13px] bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-muted-foreground block">
                {t("settings.speech.headers")}
              </label>
              <textarea
                value={ttsHeaders}
                onChange={(e) => setTtsHeaders(e.target.value)}
                placeholder={t("settings.speech.headers_placeholder")}
                className="w-full min-h-[64px] px-2.5 py-2 text-[13px] bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-muted-foreground block">
                {t("settings.speech.tts_voice_label")}
              </label>
              <input
                type="text"
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                placeholder={t("settings.speech.tts_voice")}
                className="w-full h-8 px-2.5 text-[13px] bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-[12px] text-green-500">{t("settings.saved")}</span>}
            <Button size="sm" onClick={() => void handleSave()}>
              <Check className="size-3.5" />
              {t("settings.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
