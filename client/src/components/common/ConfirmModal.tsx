import { useEffect, type ReactNode } from "react"

interface ConfirmModalProps {
  title: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Texto del botón de confirmar mientras `busy` es true. */
  busyLabel?: string
  busy?: boolean
  /** Color del botón principal. */
  tone?: "gold" | "danger"
  onConfirm: () => void
  onCancel: () => void
}

/** Diálogo de confirmación reutilizable (cierra con clic fuera o con Escape). */
export default function ConfirmModal({
  title,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  busyLabel = "Procesando...",
  busy = false,
  tone = "gold",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onCancel])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="p-6 rounded max-w-sm w-full mx-4"
        style={{
          backgroundColor: "#111111",
          border: "1px solid #2A2A2A",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3
          style={{
            color: "#F0EDE8",
            fontFamily: "DM Sans",
            fontSize: "1.125rem",
            fontWeight: "bold",
            marginBottom: "0.75rem",
          }}
        >
          {title}
        </h3>

        {children && (
          <div
            style={{
              color: "#6B6B6B",
              fontFamily: "DM Sans",
              marginBottom: "1.5rem",
              fontSize: "0.875rem",
            }}
          >
            {children}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 px-4 py-2 rounded text-sm font-medium"
            style={{
              backgroundColor: "transparent",
              border: "1px solid #2A2A2A",
              color: "#6B6B6B",
              fontFamily: "DM Sans",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition"
            style={{
              backgroundColor: tone === "danger" ? "#EF4444" : "#C9A96E",
              color: tone === "danger" ? "white" : "#0F0F0F",
              fontFamily: "DM Sans",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
