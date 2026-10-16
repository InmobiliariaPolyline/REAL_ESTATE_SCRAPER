import { Bookmark, BookmarkPlus, Loader2, Play, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import EmptyState from '@/components/common/EmptyState'
import { useToast } from '@/contexts/ToastContext'
import { ApiError } from '@/lib/api'
import {
  deleteSavedSearch,
  listSavedSearches,
  saveSearch,
  type SavedSearch,
} from '@/lib/propertiesApi'
import type { FilterState } from '@/types'

/** Resumen legible de unos filtros ("Lince · Venta · S/ 100.000 – 250.000"). */
export function describeFilters(f: FilterState): string {
  const parts: string[] = []
  if (f.distrito) parts.push(f.distrito)
  if (f.operacion !== 'todos') parts.push(f.operacion === 'VENTA' ? 'Venta' : 'Alquiler')
  if (f.inmueble !== 'todos') parts.push(f.inmueble)
  if (f.portales.length) parts.push(f.portales.map(p => p[0].toUpperCase() + p.slice(1)).join(', '))
  if (f.dormitorios !== 'todos') parts.push(`${f.dormitorios} dorm.`)
  if (f.precioMin !== '' || f.precioMax !== '') {
    const cur = f.moneda === 'PEN' ? 'S/' : 'USD'
    const n = (v: number | '') => (v === '' ? '' : v.toLocaleString('es-PE'))
    parts.push(`${cur} ${n(f.precioMin) || '0'} – ${n(f.precioMax) || 'sin límite'}`)
  }
  return parts.length ? parts.join(' · ') : 'Sin filtros'
}

interface SavedSearchesModalProps {
  /** Filtros que se guardarán al pulsar "Guardar". */
  currentFilters: FilterState
  onApply: (filters: FilterState) => void
  onClose: () => void
}

export default function SavedSearchesModal({
  currentFilters,
  onApply,
  onClose,
}: SavedSearchesModalProps) {
  const [items, setItems] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  const load = useCallback(async () => {
    try {
      setItems(await listSavedSearches())
    } catch (err) {
      console.error(err)
      addToast('No se pudieron cargar tus búsquedas', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!nombre.trim()) {
      addToast('Ponle un nombre a la búsqueda', 'error')
      return
    }
    setSaving(true)
    try {
      await saveSearch(nombre.trim(), currentFilters)
      addToast('Búsqueda guardada', 'success')
      setNombre('')
      await load()
    } catch (err) {
      addToast(
        err instanceof ApiError && err.status === 400 ? err.message : 'No se pudo guardar la búsqueda',
        'error'
      )
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (id: string) => {
    try {
      await deleteSavedSearch(id)
      setItems(prev => prev.filter(s => s.id !== id))
      addToast('Búsqueda eliminada', 'success')
    } catch (err) {
      console.error(err)
      addToast('No se pudo eliminar la búsqueda', 'error')
    }
  }

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mis búsquedas guardadas"
        className="animate-popIn card flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gold-soft ring-1 ring-gold/25">
              <Bookmark className="size-5 text-gold" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text">Mis búsquedas</h2>
              <p className="text-sm text-text-muted">Guarda tus filtros y reutilízalos cuando quieras.</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={guardar} className="border-b border-line p-6">
          <label htmlFor="ss-nombre" className="field-label">Guardar los filtros actuales</label>
          <p className="mb-2 truncate text-xs text-text-muted">{describeFilters(currentFilters)}</p>
          <div className="flex gap-2">
            <input
              id="ss-nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Depas en venta en Lince"
              className="field"
              maxLength={80}
              autoFocus
              disabled={saving}
            />
            <button type="submit" disabled={saving} className="btn btn-primary shrink-0">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <BookmarkPlus className="size-4" />}
              Guardar
            </button>
          </div>
        </form>

        <div className="overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2 p-3">
              <div className="skeleton h-16" />
              <div className="skeleton h-16" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Aún no tienes búsquedas guardadas"
              description="Ajusta los filtros, ponle un nombre arriba y guárdalas."
            />
          ) : (
            <ul className="space-y-2">
              {items.map(s => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface-1 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{s.nombre}</p>
                    <p className="truncate text-xs text-text-muted">{describeFilters(s.filtros)}</p>
                  </div>
                  <button
                    onClick={() => {
                      onApply(s.filtros)
                      onClose()
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    <Play className="size-4" />
                    Aplicar
                  </button>
                  <button
                    onClick={() => eliminar(s.id)}
                    className="btn btn-danger btn-sm btn-icon"
                    aria-label={`Eliminar búsqueda ${s.nombre}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
