import { AlertTriangle, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { ApiError, api } from '@/lib/api'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { trapFocus } from '@/lib/focusTrap'

interface Preview {
  dias: number
  total: number
  eliminables: number
  protegidas: number
  ultimaVista: string | null
  seguro: boolean
  motivo?: string
}

const OPCIONES = [15, 30, 60, 90]

interface LimpiezaModalProps {
  onClose: () => void
  /** Se llama tras una limpieza exitosa para refrescar la lista. */
  onDone: () => void
}

/** Limpieza de avisos inactivos con vista previa y salvaguardas calculadas en el servidor. */
export default function LimpiezaModal({ onClose, onDone }: LimpiezaModalProps) {
  const [dias, setDias] = useState(30)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const { addToast } = useToast()

  const cargar = useCallback(
    async (d: number) => {
      setLoading(true)
      setPreview(null)
      try {
        setPreview(await api.get<Preview>('/admin/limpieza', { dias: d }))
      } catch (err) {
        console.error(err)
        addToast('No se pudo calcular la limpieza', 'error')
      } finally {
        setLoading(false)
      }
    },
    [addToast]
  )

  useEffect(() => {
    cargar(dias)
  }, [dias, cargar])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const ejecutar = async () => {
    if (busy || !preview?.seguro || preview.eliminables === 0) return
    setBusy(true)
    try {
      const res = await api.post<{ eliminadas: number }>('/admin/limpiar-inactivos', { dias })
      addToast(`Limpieza completada: ${res.eliminadas} avisos eliminados`, 'success')
      onDone()
      onClose()
    } catch (err) {
      addToast(
        err instanceof ApiError && err.status === 409
          ? err.message
          : 'No se pudo ejecutar la limpieza',
        'error'
      )
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  const puedeEjecutar = !!preview?.seguro && preview.eliminables > 0

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <div
        ref={trapFocus}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Limpieza de avisos inactivos"
        className="animate-popIn card w-full max-w-lg p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose/10 ring-1 ring-rose/25">
            <Trash2 className="size-5 text-rose" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-text">Limpieza de avisos inactivos</h3>
            <p className="mt-1 text-sm text-text-muted">
              Elimina los avisos que el scraper no ha vuelto a ver (probablemente ya no están
              publicados). Se conservan los que tienen enlaces o están en favoritos.
            </p>
          </div>
        </div>

        <span className="field-label" id="limpieza-dias">No vistos en los últimos</span>
        <div className="segmented mb-5" role="group" aria-labelledby="limpieza-dias">
          {OPCIONES.map(d => (
            <button
              key={d}
              type="button"
              aria-pressed={dias === d}
              disabled={busy}
              onClick={() => setDias(d)}
              className="segmented-option"
            >
              {d} días
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-surface-1 p-4" aria-live="polite">
          {loading || !preview ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="size-4 animate-spin" />
              Calculando...
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs text-text-muted">Se eliminarían</dt>
                  <dd className={cn('mono mt-1 text-2xl font-semibold', preview.eliminables ? 'text-rose' : 'text-text')}>
                    {preview.eliminables.toLocaleString('es-PE')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Protegidos</dt>
                  <dd className="mono mt-1 text-2xl font-semibold text-text">
                    {preview.protegidas.toLocaleString('es-PE')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Total actual</dt>
                  <dd className="mono mt-1 text-2xl font-semibold text-text">
                    {preview.total.toLocaleString('es-PE')}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 border-t border-line pt-3 text-xs text-text-muted">
                Última vez que el scraper vio avisos:{' '}
                <span className="text-text">{formatDateTime(preview.ultimaVista)}</span>
              </p>

              {preview.seguro ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-green">
                  <ShieldCheck className="size-4" />
                  El scraper está refrescando los datos: la limpieza es segura.
                </p>
              ) : (
                <p className="mt-2 flex items-start gap-2 text-xs text-amber">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {preview.motivo}
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="btn btn-ghost">
            Cancelar
          </button>
          <button onClick={ejecutar} disabled={busy || !puedeEjecutar} className="btn btn-danger">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {busy ? 'Eliminando...' : 'Eliminar avisos'}
          </button>
        </div>
      </div>
    </div>
  )
}
