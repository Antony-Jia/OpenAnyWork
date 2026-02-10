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
    info: "bg-blue-600",
    success: "bg-green-600",
    warning: "bg-yellow-600",
    error: "bg-red-600"
  }[toast.type]

  const icon = {
    info: "ℹ",
    success: "✓",
    warning: "⚠",
    error: "✕"
  }[toast.type]

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px] animate-in slide-in-from-top-2 fade-in duration-200`}
    >
      <span className="text-lg">{icon}</span>
      <span className="flex-1 text-sm">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="text-white/80 hover:text-white transition-colors"
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
