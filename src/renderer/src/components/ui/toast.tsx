import { useEffect } from "react"

export interface ToastMessage {
  id: string
  type: "info" | "success" | "warning" | "error"
  message: string
}

interface ToastItemProps {
  toast: ToastMessage
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose }: ToastItemProps): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id)
    }, 5000)
    return () => clearTimeout(timer)
  }, [toast.id, onClose])

  const bgColor = {
    info: "bg-blue-600/80",
    success: "bg-emerald-600/80",
    warning: "bg-amber-600/80",
    error: "bg-red-600/80"
  }[toast.type]

  const glowColor = {
    info: "shadow-[0_0_24px_rgba(37,99,235,0.3)]",
    success: "shadow-[0_0_24px_rgba(5,150,105,0.3)]",
    warning: "shadow-[0_0_24px_rgba(217,119,6,0.3)]",
    error: "shadow-[0_0_24px_rgba(220,38,38,0.3)]"
  }[toast.type]

  const icon = {
    info: "ℹ",
    success: "✓",
    warning: "⚠",
    error: "✕"
  }[toast.type]

  return (
    <div
      className={`${bgColor} ${glowColor} backdrop-blur-xl text-white px-5 py-3.5 rounded-2xl flex items-center gap-3.5 min-w-[340px] max-w-[520px] animate-in slide-in-from-top-2 fade-in duration-300 border border-white/15`}
    >
      <span className="text-lg neon-text">{icon}</span>
      <span className="flex-1 text-sm font-semibold tracking-wide">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="text-white/60 hover:text-white transition-all duration-200 rounded-lg p-1 hover:bg-white/15 hover:scale-110"
      >
        ✕
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps): React.JSX.Element | null {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-12 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  )
}
