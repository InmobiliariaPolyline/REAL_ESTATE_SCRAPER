import { Bath, BedDouble, Car, ExternalLink, Heart, Info, Link2, MapPin, Ruler, Scale, Trash2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { getOperacionColor, getPortalColor } from '@/lib/portals'
import { formatDisplayPrice, getDisplayPrice, type Currency } from '@/lib/prices'
import {
  esAlquiler,
  esNuevo,
  estadoDeAntiguedad,
  formatoArea,
  operacionVisual,
  precioPorM2Texto,
  tipoVisual,
  ubicacionTexto,
} from '@/lib/propertyTags'
import { safeHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import EnlacesPropiedad from './EnlacesPropiedad'
import { ChipFotos, ChipFoto, ChipNuevo, Etiqueta } from './Etiquetas'

interface PropertyCardProps {
  id: string
  portal: string
  operacion: string
  titulo: string
  precio: number
  precioUsd: number
  /** Moneda en que se muestra el precio. */
  moneda: Currency
  /** Moneda en que se publicó el aviso (`precio` está en ella). */
  monedaOriginal?: string
  distrito: string
  dormitorios: string
  banios: string
  area: string
  imagen: string | null
  url: string
  index: number
  /** Datos para las etiquetas (todos opcionales: sin ellos la tarjeta muestra lo básico). */
  inmueble?: string
  creadoEn?: string
  fotos?: number
  estacionamientos?: string | null
  antiguedad?: string | null
  departamento?: string | null
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

/** Dato de ficha (dormitorios, baños, área, cocheras) con icono y su unidad; se oculta si no hay valor. */
function Dato({ icon: Icon, value, unidad, label }: { icon: LucideIcon; value: string | null | undefined; unidad?: string; label: string }) {
  const v = (value ?? '').trim()
  if (!v) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-2.5 py-1.5 text-xs text-text" title={label}>
      <Icon className="size-3.5 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      <span className="font-semibold">{v}</span>
      {unidad && <span className="text-text-muted">{unidad}</span>}
    </span>
  )
}

/** Valor de la ficha sin espacios sobrantes. */
const cantidad = (v: string | null | undefined) => (v ?? '').trim()

export default function PropertyCard({
  id,
  portal,
  operacion,
  titulo,
  precio,
  precioUsd,
  moneda,
  monedaOriginal,
  distrito,
  dormitorios,
  banios,
  area,
  imagen,
  url,
  index,
  inmueble,
  creadoEn,
  fotos,
  estacionamientos,
  antiguedad,
  departamento,
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

  const price = getDisplayPrice(precio, precioUsd, moneda, monedaOriginal)
  const hasPrice = price.amount > 0
  const safeUrl = safeHttpUrl(url)
  const safeImage = safeHttpUrl(imagen)

  const tipo = tipoVisual(inmueble)
  const TipoIcono = tipo.icono
  const op = operacionVisual(operacion)
  const OpIcono = op.icono
  const alquiler = esAlquiler(operacion)
  const esProyecto = tipo.label === 'Proyecto'
  const estado = estadoDeAntiguedad(antiguedad)
  const porM2 = precioPorM2Texto(price, area)
  const nuevo = esNuevo(creadoEn)
  const lugar = ubicacionTexto(distrito, departamento)
  const cocheras = cantidad(estacionamientos)

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
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,var(--surface-4),var(--surface-3))]">
              <TipoIcono className="size-10 text-text-faint" strokeWidth={1.25} aria-hidden="true" />
              <span className="text-xs text-text-faint">Sin fotos</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent" />

          <span className="pointer-events-none absolute left-3 top-3 z-[2] inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium capitalize text-white backdrop-blur-md">
            <span className="dot" style={{ color: getPortalColor(portal) }} />
            {portal}
          </span>

          <div className="absolute right-3 top-3 z-[2] flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[#10131a]"
              style={{ backgroundColor: getOperacionColor(operacion) }}
              title={alquiler ? 'Se alquila' : 'Se vende'}
            >
              <OpIcono className="size-3.5" strokeWidth={2} aria-hidden="true" />
              {op.label}
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
                className="inline-flex size-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md transition hover:bg-black/80"
                title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Heart className={cn('size-4', isFavorite ? 'fill-rose text-rose' : 'text-white')} />
                <span className="sr-only">{isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}</span>
              </button>
            )}
          </div>

          {/* Abajo de la foto: tipo de inmueble a la izquierda; novedad y cantidad de fotos a la derecha */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[2] flex items-end justify-between gap-2">
            <ChipFoto icono={tipo.icono} className="min-w-0">{tipo.label}</ChipFoto>
            <div className="flex shrink-0 items-center gap-1.5">
              {nuevo && <ChipNuevo />}
              {(fotos ?? 0) > 1 && <ChipFotos cantidad={fotos as number} />}
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div>
            <p className="flex items-baseline gap-1.5">
              {esProyecto && hasPrice && <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Desde</span>}
              <span className={cn('mono text-2xl font-semibold tracking-tight', hasPrice ? 'text-gold' : 'text-lg text-text-faint')}>
                {formatDisplayPrice(price)}
              </span>
              {hasPrice && alquiler && <span className="text-xs font-medium text-text-muted">al mes</span>}
            </p>
            {hasPrice && porM2 && !alquiler && <p className="mt-0.5 text-xs text-text-muted">{porM2}</p>}
          </div>

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
            <Dato icon={BedDouble} value={cantidad(dormitorios)} unidad="dorm." label="Dormitorios" />
            <Dato icon={Bath} value={cantidad(banios)} unidad={cantidad(banios) === '1' ? 'baño' : 'baños'} label="Baños" />
            <Dato icon={Ruler} value={formatoArea(area)} label="Área" />
            <Dato icon={Car} value={cocheras} unidad={cocheras === '1' ? 'cochera' : 'cocheras'} label="Cocheras" />
          </div>

          {estado && (
            <div className="flex flex-wrap gap-1.5">
              <Etiqueta visual={estado} />
            </div>
          )}

          {lugar && (
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="truncate">{lugar}</span>
            </p>
          )}

          <div className="mt-auto flex gap-2 pt-1">
            <a
              href={safeUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onView?.(id)}
              aria-disabled={!safeUrl}
              className={cn('btn btn-primary btn-sm flex-1', !safeUrl && 'pointer-events-none opacity-50')}
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
                className={cn('btn btn-sm btn-icon', isCompared ? 'btn-primary' : 'btn-secondary')}
                title={isCompared ? 'Quitar de la comparación' : compareDisabled ? 'Máximo 3 propiedades' : 'Agregar a la comparación'}
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

      {mostrarEnlaces && <EnlacesPropiedad propiedadId={id} onClose={() => setMostrarEnlaces(false)} />}
    </>
  )
}

