import { useEffect, useState } from "react"

interface GuardarBusquedaModalProps {
  busy?: boolean
  onSave: (nombre: string) => void
  onCancel: () => void
}

export default function GuardarBusquedaModal({
  busy = false,
  onSave,
  onCancel,
}: GuardarBusquedaModalProps) {
  const [nombre, setNombre] = useState("")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onCancel])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!busy) onSave(nombre)
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Guardar esta búsqueda"
        onSubmit={submit}
        className="p-6 rounded max-w-sm w-full mx-4"
        style={{ backgroundColor: "#111111", border: "1px solid #2A2A2A" }}
        onClick={e => e.stopPropagation()}
      >
        <h3
          style={{
            color: "#F0EDE8",
            fontFamily: "DM Sans",
            fontSize: "1.125rem",
            fontWeight: "bold",
            marginBottom: "1rem",
          }}
        >
          Guardar esta búsqueda
        </h3>

        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Depas en venta San Miguel"
          className="input-underline w-full text-sm mb-4"
          maxLength={80}
          autoFocus
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 px-4 py-2 rounded text-sm font-medium"
            style={{
              backgroundColor: "transparent",
              border: "1px solid #2A2A2A",
              color: "#6B6B6B",
              fontFamily: "DM Sans",
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={busy}
            className="flex-1 px-4 py-2 rounded text-sm font-medium"
            style={{
              backgroundColor: "#C9A96E",
              color: "#0F0F0F",
              fontFamily: "DM Sans",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  )
}
