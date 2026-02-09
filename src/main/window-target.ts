import { BrowserWindow } from "electron"

function hasQueryFlag(url: string, key: string): boolean {
  try {
    return new URL(url).searchParams.get(key) === "1"
  } catch {
    return url.includes(`${key}=1`)
  }
}

function isAuxiliaryWindow(window: BrowserWindow): boolean {
  const url = window.webContents.getURL()
  if (!url) return false
  return hasQueryFlag(url, "quickInput") || hasQueryFlag(url, "taskPopup")
}

function isVisibleWindow(window: BrowserWindow): boolean {
  return window.isVisible() && !window.isMinimized()
}

export function getPreferredMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed())
  if (windows.length === 0) return null

  const nonAuxiliary = windows.filter((window) => !isAuxiliaryWindow(window))
  const focusedNonAuxiliary = nonAuxiliary.find((window) => window.isFocused())
  if (focusedNonAuxiliary) return focusedNonAuxiliary

  const visibleNonAuxiliary = nonAuxiliary.find((window) => isVisibleWindow(window))
  if (visibleNonAuxiliary) return visibleNonAuxiliary

  if (nonAuxiliary.length > 0) return nonAuxiliary[0]

  const focusedFallback = windows.find((window) => window.isFocused())
  if (focusedFallback) return focusedFallback

  const visibleFallback = windows.find((window) => isVisibleWindow(window))
  if (visibleFallback) return visibleFallback

  return windows[0]
}
