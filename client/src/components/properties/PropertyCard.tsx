import { Bath, BedDouble, Building2, ExternalLink, Heart, Info, Link2, MapPin, Ruler, Scale, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getOperacionColor, getPortalColor } from '@/lib/portals'
import {
  formatDisplayPrice,
  getDisplayPrice,
  type Currency,
} from '@/lib/prices'
import { safeHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import EnlacesPropiedad from './EnlacesPropiedad'

interface PropertyCardProps {
  id: string
  portal: string
  operacion: string
  titulo: string
  precio: number
  precioUsd: number
  moneda: Currency
  distrito: string
  dormitorios: string
  banios: string
  area: string
  imagen: string | null
  url: string
  index: number
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
  onDelete?: (id: string) => void
  onView?: (id: string) => void
  /** Abre el detalle con el historial de precios. */
  onOpenDetail?: (id: string) => void
  /** Selección para comparar propiedades. */
  isCompared?: boolean
  compareDisabled?: boolean
  onToggleCompare?: (id: string) => void
}

/** Dato de ficha (dormitorios, baños, área) con icono; se oculta si no hay valor. */
function Meta({ icon: Icon, value, label }: { icon: typeof Bath; value: string; label: string }) {
  if (!value) return null
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-2.5 py-1.5 text-xs text-text"
      title={label}
    >
      <Icon className="size-3.5 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  )
}

export default function PropertyCard({
  id,
  portal,
  operacion,
  titulo,
  precio,
  precioUsd,
  moneda,
  distrito,
  dormitorios,
  banios,
  area,
  imagen,
  url,
  index,
  isFavorite,
  onToggleFavorite,
  onDelete,
  onView,
  onOpenDetail,
  isCompared,
  compareDisabled,
  onToggleCompare,
}: PropertyCardProps) {
  const [mostrarEnlaces, setMostrarEnlaces] = useState(false)

  const price = getDisplayPrice(precio, precioUsd, moneda)
  const hasPrice = price.amount > 0
  const safeUrl = safeHttpUrl(url)
  const safeImage = safeHttpUrl(imagen)

  return (
    <>
      <article
        className={cn(
          'card card-interactive animate-slideInUp group flex flex-col overflow-hidden',
          isCompared && 'border-gold/60 ring-1 ring-gold/40'
        )}
        style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      >
        {/* Imagen: al hacer clic abre la vista previa con todas las fotos */}
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-3">
          {onOpenDetail && (
            <button
              type="button"
              onClick={() => onOpenDetail(id)}
              className="absolute inset-0 z-[1] cursor-zoom-in focus-visible:ring-2 focus-visible:ring-gold/60"
              aria-label={`Ver fotos y detalle: ${titulo}`}
            />
          )}
          {safeImage ? (
            <img
              src={safeImage}
              alt={titulo}
              className="size-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,var(--surface-4),var(--surface-3))]">
              <Building2 className="size-10 text-text-faint" strokeWidth={1.25} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />

          <span className="pointer-events-none absolute left-3 top-3 z-[2] inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium capitalize text-white backdrop-blur-md">
            <span className="dot" style={{ color: getPortalColor(portal) }} />
            {portal}
          </span>

          <div className="absolute right-3 top-3 z-[2] flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[#10131a]"
              style={{ backgroundColor: getOperacionColor(operacion) }}
            >
              {operacion}
            </span>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleFavorite(id)
                }}
                aria-pressed={!!isFavorite}
                className="inline-flex size-8 items-center justify-center rounded-full bg-black/55 backdrop-blur-md transition hover:bg-black/75"
                title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Heart
                  className={cn('size-4', isFavorite ? 'fill-rose text-rose' : 'text-white')}
                />
                <span className="sr-only">
                  {isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <p
            className={cn(
              'mono text-2xl font-semibold tracking-tight',
              hasPrice ? 'text-gold' : 'text-text-faint'
            )}
          >
            {formatDisplayPrice(price)}
          </p>

          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-text">
            {onOpenDetail ? (
              <button
                type="button"
                onClick={() => onOpenDetail(id)}
                className="text-left transition hover:text-gold"
              >
                {titulo}
              </button>
            ) : (
              titulo
            )}
          </h3>

          <div className="flex flex-wrap gap-2">
            <Meta icon={BedDouble} value={dormitorios} label="Dormitorios" />
            <Meta icon={Bath} value={banios} label="Baños" />
            <Meta icon={Ruler} value={area} label="Área" />
          </div>

          {distrito && (
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{distrito}</span>
            </p>
          )}

          <div className="mt-auto flex gap-2 pt-1">
            <a
              href={safeUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onView?.(id)}
              aria-disabled={!safeUrl}
              className={cn(
                'btn btn-primary btn-sm flex-1',
                !safeUrl && 'pointer-events-none opacity-50'
              )}
            >
              <ExternalLink className="size-4" />
              Ver aviso
            </a>

            {onOpenDetail && (
              <button
                onClick={() => onOpenDetail(id)}
                className="btn btn-secondary btn-sm btn-icon"
                title="Ver detalle e historial de precio"
                aria-label="Ver detalle e historial de precio"
              >
                <Info className="size-4" />
              </button>
            )}

            <button
              onClick={() => setMostrarEnlaces(true)}
              className="btn btn-secondary btn-sm btn-icon"
              title="Ver enlaces de apoyo"
              aria-label="Ver enlaces de apoyo"
            >
              <Link2 className="size-4" />
            </button>

            {onToggleCompare && (
              <button
                onClick={() => onToggleCompare(id)}
                disabled={compareDisabled && !isCompared}
                aria-pressed={!!isCompared}
                className={cn(
                  'btn btn-sm btn-icon',
                  isCompared ? 'btn-primary' : 'btn-secondary'
                )}
                title={
                  isCompared
                    ? 'Quitar de la comparación'
                    : compareDisabled
                      ? 'Máximo 3 propiedades'
                      : 'Agregar a la comparación'
                }
                aria-label={isCompared ? 'Quitar de la comparación' : 'Agregar a la comparación'}
              >
                <Scale className="size-4" />
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => onDelete(id)}
                className="btn btn-danger btn-sm btn-icon"
                title="Eliminar propiedad"
                aria-label="Eliminar propiedad"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
      </article>

      {mostrarEnlaces && (
        <EnlacesPropiedad propiedadId={id} onClose={() => setMostrarEnlaces(false)} />
      )}
    </>
  )
}
