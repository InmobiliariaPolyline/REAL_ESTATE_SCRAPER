import { Building2, Scale, Trophy, X } from 'lucide-react'
import { useEffect } from 'react'
import { parseAreaM2, pricePerM2 } from '@shared/area'
import { getOperacionColor, getPortalColor } from '@/lib/portals'
import { currencyLabel, getDisplayPrice, type Currency } from '@/lib/prices'
import { safeHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import type { Propiedad } from '@/types'

const fmt = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 })

interface CompareModalProps {
  items: Propiedad[]
  moneda: Currency
  onRemove: (id: string) => void
  onClose: () => void
}

interface Row {
  label: string
  value: (p: Propiedad) => string
  /** Valor numérico para resaltar el mejor (menor o mayor); `null` si no aplica. */
  score?: (p: Propiedad) => number | null
  best?: 'min' | 'max'
}

/** Comparación lado a lado de 2 o 3 propiedades con el mejor valor resaltado. */
export default function CompareModal({ items, moneda, onRemove, onClose }: CompareModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const priceOf = (p: Propiedad) => getDisplayPrice(p.precio, p.precio_usd, moneda)
  const label = currencyLabel(moneda)

  const rows: Row[] = [
    {
      label: 'Precio',
      value: p => {
        const price = priceOf(p)
        return price.amount > 0 ? `${label} ${price.approximate ? '~' : ''}${fmt(price.amount)}` : 'Sin precio'
      },
      score: p => (priceOf(p).amount > 0 ? priceOf(p).amount : null),
      best: 'min',
    },
    {
      label: 'Precio por m²',
      value: p => {
        const v = pricePerM2(priceOf(p).amount, p.area)
        return v ? `${label} ${fmt(v)}` : '—'
      },
      score: p => pricePerM2(priceOf(p).amount, p.area),
      best: 'min',
    },
    {
      label: 'Área',
      value: p => p.area || '—',
      score: p => parseAreaM2(p.area),
      best: 'max',
    },
    {
      label: 'Dormitorios',
      value: p => p.dormitorios || '—',
      score: p => {
        const n = parseInt(p.dormitorios, 10)
        return Number.isFinite(n) ? n : null
      },
      best: 'max',
    },
    {
      label: 'Baños',
      value: p => p.banios || '—',
      score: p => {
        const n = parseInt(p.banios, 10)
        return Number.isFinite(n) ? n : null
      },
      best: 'max',
    },
    { label: 'Distrito', value: p => p.distrito || '—' },
    { label: 'Operación', value: p => p.operacion || '—' },
    { label: 'Portal', value: p => p.portal || '—' },
  ]

  /** Ids ganadores de una fila (ignora empates entre todos y filas con un solo dato). */
  const winners = (row: Row): Set<string> => {
    if (!row.score || !row.best) return new Set()
    const scored = items
      .map(p => ({ id: p.id, v: row.score!(p) }))
      .filter((s): s is { id: string; v: number } => s.v !== null)
    if (scored.length < 2) return new Set()
    const target = (row.best === 'min' ? Math.min : Math.max)(...scored.map(s => s.v))
    const best = scored.filter(s => s.v === target)
    return best.length === scored.length ? new Set() : new Set(best.map(s => s.id))
  }

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comparar propiedades"
        className="animate-popIn card flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gold-soft ring-1 ring-gold/25">
              <Scale className="size-5 text-gold" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text">Comparar propiedades</h2>
              <p className="text-sm text-text-muted">
                Precios en {moneda === 'PEN' ? 'soles' : 'dólares'}. El mejor valor de cada fila se resalta.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="w-36 border-b border-line bg-surface-1 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted" />
                {items.map(p => {
                  const image = safeHttpUrl(p.imagen)
                  return (
                    <th key={p.id} className="border-b border-line bg-surface-1 p-3 text-left align-top font-normal">
                      <div className="relative overflow-hidden rounded-xl bg-surface-3">
                        <div className="aspect-[16/9]">
                          {image ? (
                            <img src={image} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center">
                              <Building2 className="size-8 text-text-faint" strokeWidth={1.25} />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => onRemove(p.id)}
                          className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
                          aria-label={`Quitar ${p.titulo} de la comparación`}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-medium text-text">{p.titulo}</p>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const best = winners(row)
                return (
                  <tr key={row.label}>
                    <th
                      scope="row"
                      className="border-b border-line px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      {row.label}
                    </th>
                    {items.map(p => (
                      <td
                        key={p.id}
                        className={cn(
                          'border-b border-line px-4 py-3',
                          best.has(p.id) ? 'bg-gold-soft' : ''
                        )}
                      >
                        <span
                          className={cn(
                            'mono inline-flex items-center gap-1.5',
                            best.has(p.id) ? 'font-semibold text-gold' : 'text-text'
                          )}
                        >
                          {row.label === 'Portal' ? (
                            <span className="flex items-center gap-1.5 font-sans capitalize">
                              <span className="dot" style={{ color: getPortalColor(p.portal) }} />
                              {row.value(p)}
                            </span>
                          ) : row.label === 'Operación' ? (
                            <span
                              className="font-sans text-xs font-semibold"
                              style={{ color: getOperacionColor(p.operacion) }}
                            >
                              {row.value(p)}
                            </span>
                          ) : (
                            <span className={row.label === 'Distrito' ? 'font-sans' : ''}>{row.value(p)}</span>
                          )}
                          {best.has(p.id) && (
                            <Trophy className="size-3.5" aria-label="Mejor valor" />
                          )}
                        </span>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
