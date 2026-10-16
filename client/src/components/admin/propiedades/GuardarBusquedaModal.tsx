import { Bookmark, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { trapFocus } from '@/lib/focusTrap'

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
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <form
        ref={trapFocus}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Guardar esta búsqueda"
        onSubmit={submit}
        className="animate-popIn card w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-4">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-gold-soft ring-1 ring-gold/25">
            <Bookmark className="size-5 text-gold" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-text">Guardar esta búsqueda</h3>
            <p className="text-sm text-text-muted">Se guardan los filtros actuales.</p>
          </div>
        </div>

        <label htmlFor="busqueda-nombre" className="field-label">Nombre</label>
        <input
          id="busqueda-nombre"
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Depas en venta San Miguel"
          className="field"
          maxLength={80}
          autoFocus
        />

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  )
}
