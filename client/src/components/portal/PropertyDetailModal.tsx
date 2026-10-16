import { ArrowDownRight, ArrowUpRight, Building2, ExternalLink, Heart, Link2, Loader2, MapPin, Minus, Scale, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { pricePerM2 } from '@shared/area'
import EnlacesPropiedad from '@/components/properties/EnlacesPropiedad'
import { useToast } from '@/contexts/ToastContext'
import { fetchPropertyDetail, type PropertyDetail } from '@/lib/propertiesApi'
import { getOperacionColor, getPortalColor } from '@/lib/portals'
import { currencyLabel, formatDisplayPrice, getDisplayPrice, type Currency } from '@/lib/prices'
import { safeHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import type { Propiedad } from '@/types'

const GOLD = '#d4b782'
const fmt = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 })
const shortDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
}

interface PropertyDetailModalProps {
  propertyId: string
  moneda: Currency
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  isCompared: boolean
  compareDisabled: boolean
  onToggleCompare: (propiedad: Propiedad) => void
  onClose: () => void
}

/** Detalle de un aviso con precio por m² e historial de cambios de precio. */
export default function PropertyDetailModal({
  propertyId,
  moneda,
  isFavorite,
  onToggleFavorite,
  isCompared,
  compareDisabled,
  onToggleCompare,
  onClose,
}: PropertyDetailModalProps) {
  const [detail, setDetail] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLinks, setShowLinks] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPropertyDetail(propertyId)
      .then(d => !cancelled && setDetail(d))
      .catch(err => {
        console.error(err)
        if (!cancelled) {
          addToast('No se pudo cargar el detalle de la propiedad', 'error')
          onClose()
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [propertyId, addToast, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showLinks) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showLinks])

  const p = detail?.propiedad
  const price = p ? getDisplayPrice(p.precio, p.precio_usd, moneda) : null
  const perM2 = p && price ? pricePerM2(price.amount, p.area) : null

  // Serie de precios en la moneda elegida (con conversión si el aviso solo tiene la otra).
  const series = useMemo(
    () =>
      (detail?.historial ?? []).map(h => ({
        fecha: h.registrado_en,
        precio: getDisplayPrice(h.precio, h.precio_usd, moneda).amount,
      })),
    [detail, moneda]
  )
  const stats = useMemo(() => {
    const values = series.map(s => s.precio).filter(v => v > 0)
    if (values.length === 0) return null
    const first = values[0]
    // El precio actual es el del aviso (el historial puede tener un registro más antiguo).
    const last = price && price.amount > 0 ? price.amount : values[values.length - 1]
    return {
      first,
      last,
      min: Math.min(...values),
      max: Math.max(...values),
      change: first > 0 ? ((last - first) / first) * 100 : 0,
    }
  }, [series, price])

  const image = safeHttpUrl(p?.imagen)
  const url = safeHttpUrl(p?.url)
  const hasHistory = series.length >= 2

  return (
    <>
      <div
        className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de la propiedad"
          className="animate-popIn card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <p className="eyebrow">Detalle de la propiedad</p>
            <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
              <X className="size-5" />
            </button>
          </div>

          {loading || !p || !price ? (
            <div className="flex items-center justify-center gap-2 p-16 text-text-muted">
              <Loader2 className="size-5 animate-spin" />
              Cargando...
            </div>
          ) : (
            <div className="overflow-y-auto">
              <div className="grid gap-0 md:grid-cols-[1fr_1.1fr]">
                <div className="relative min-h-[14rem] bg-surface-3">
                  {image ? (
                    <img src={image} alt={p.titulo} className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Building2 className="size-12 text-text-faint" strokeWidth={1.25} />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium capitalize text-white backdrop-blur-md">
                    <span className="dot" style={{ color: getPortalColor(p.portal) }} />
                    {p.portal}
                  </span>
                  <span
                    className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[#10131a]"
                    style={{ backgroundColor: getOperacionColor(p.operacion) }}
                  >
                    {p.operacion}
                  </span>
                </div>

                <div className="space-y-4 p-6">
                  <h2 className="text-lg font-semibold leading-snug text-text">{p.titulo}</h2>
                  <p className="mono text-3xl font-semibold tracking-tight text-gold">
                    {formatDisplayPrice(price)}
                  </p>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-text-muted">Precio por m²</dt>
                      <dd className="mono mt-0.5 font-medium text-text">
                        {perM2 ? `${currencyLabel(moneda)} ${fmt(perM2)}` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Área</dt>
                      <dd className="mt-0.5 font-medium text-text">{p.area || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Dormitorios</dt>
                      <dd className="mt-0.5 font-medium text-text">{p.dormitorios || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Baños</dt>
                      <dd className="mt-0.5 font-medium text-text">{p.banios || '—'}</dd>
                    </div>
                  </dl>

                  {p.distrito && (
                    <p className="flex items-center gap-1.5 text-sm text-text-muted">
                      <MapPin className="size-4" strokeWidth={1.75} />
                      {p.distrito}
                    </p>
                  )}
                </div>
              </div>

              {/* Historial de precio */}
              <section className="border-t border-line p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-text">Historial de precio</h3>
                    <p className="text-sm text-text-muted">
                      {hasHistory
                        ? `${series.length} registros, en ${currencyLabel(moneda)}`
                        : 'Aún no se han registrado cambios de precio'}
                    </p>
                  </div>
                  {stats && hasHistory && (
                    <span
                      className={cn(
                        'badge',
                        stats.change < 0 ? 'badge-green' : stats.change > 0 ? 'badge-rose' : 'badge-muted'
                      )}
                    >
                      {stats.change < 0 ? (
                        <ArrowDownRight className="size-3.5" />
                      ) : stats.change > 0 ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : (
                        <Minus className="size-3.5" />
                      )}
                      {stats.change > 0 ? '+' : ''}
                      {stats.change.toFixed(1)}% desde el primer registro
                    </span>
                  )}
                </div>

                {hasHistory ? (
                  <>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                          <defs>
                            <linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgb(255 255 255 / 0.05)" vertical={false} />
                          <XAxis
                            dataKey="fecha"
                            tickFormatter={shortDate}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                          />
                          <YAxis
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={v => fmt(Number(v))}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            width={64}
                          />
                          <Tooltip
                            cursor={{ stroke: 'rgb(255 255 255 / 0.15)' }}
                            content={({ active, payload }) =>
                              active && payload?.length ? (
                                <div className="rounded-xl border border-line-strong bg-surface-3 px-3 py-2 text-xs shadow-xl">
                                  <p className="text-text-muted">
                                    {new Date(String(payload[0].payload.fecha)).toLocaleDateString('es-PE')}
                                  </p>
                                  <p className="mono mt-0.5 text-sm font-semibold text-gold">
                                    {currencyLabel(moneda)} {fmt(Number(payload[0].value))}
                                  </p>
                                </div>
                              ) : null
                            }
                          />
                          <Area
                            type="stepAfter"
                            dataKey="precio"
                            stroke={GOLD}
                            strokeWidth={2}
                            fill="url(#detailFill)"
                            dot={{ r: 3, fill: GOLD, stroke: '#101216', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {stats && (
                      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
                        {[
                          ['Primer precio', stats.first],
                          ['Precio actual', stats.last],
                          ['Mínimo', stats.min],
                          ['Máximo', stats.max],
                        ].map(([label, value]) => (
                          <div key={String(label)}>
                            <dt className="text-xs text-text-muted">{label}</dt>
                            <dd className="mono mt-0.5 text-sm font-semibold text-text">
                              {currencyLabel(moneda)} {fmt(Number(value))}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </>
                ) : (
                  <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-text-muted">
                    El gráfico aparecerá cuando el aviso cambie de precio.
                  </p>
                )}
              </section>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 border-t border-line p-6">
                <a
                  href={url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!url}
                  className={cn('btn btn-primary', !url && 'pointer-events-none opacity-50')}
                >
                  <ExternalLink className="size-4" />
                  Ver aviso original
                </a>
                <button onClick={() => setShowLinks(true)} className="btn btn-secondary">
                  <Link2 className="size-4" />
                  Enlaces de apoyo
                </button>
                <button
                  onClick={() => onToggleFavorite(p.id)}
                  aria-pressed={isFavorite}
                  className="btn btn-secondary"
                >
                  <Heart className={cn('size-4', isFavorite && 'fill-rose text-rose')} />
                  {isFavorite ? 'En favoritos' : 'Favorito'}
                </button>
                <button
                  onClick={() => onToggleCompare(p)}
                  disabled={compareDisabled && !isCompared}
                  aria-pressed={isCompared}
                  className={cn('btn', isCompared ? 'btn-primary' : 'btn-secondary')}
                >
                  <Scale className="size-4" />
                  {isCompared ? 'Quitar de la comparación' : 'Comparar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showLinks && p && <EnlacesPropiedad propiedadId={p.id} onClose={() => setShowLinks(false)} />}
    </>
  )
}
