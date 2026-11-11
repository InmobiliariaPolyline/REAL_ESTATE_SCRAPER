import { ExternalLink, Heart, Info, Link2, MapPin, Scale, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Insignia from '@/components/common/Insignia'
import { getPortalColor } from '@/lib/portals'
import { getDisplayPrice, getPublishedPrice, partesDePrecio, type Currency } from '@/lib/prices'
import {
  esAlquiler,
  esNuevo,
  estadoDeAntiguedad,
  formatoArea,
  operacionVisual,
  precioPorM2Partes,
  tipoVisual,
  tonoInsignia,
  ubicacionTexto,
} from '@/lib/propertyTags'
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

  // El precio de la tarjeta es el que publicó el aviso (moneda de origen), no una conversión.
  const price = getPublishedPrice(precio, precioUsd, monedaOriginal, moneda)
  const partes = partesDePrecio(price)
  const safeUrl = safeHttpUrl(url)
  const safeImage = safeHttpUrl(imagen)

  const tipo = tipoVisual(inmueble)
  const TipoIcono = tipo.icono
  const alquiler = esAlquiler(operacion)
  const op = operacionVisual(operacion)
  const esProyecto = tipo.label === 'Proyecto'
  const estado = estadoDeAntiguedad(antiguedad)
  const porM2 = precioPorM2Partes(price, area)
  const nuevo = esNuevo(creadoEn)
  const lugar = ubicacionTexto(distrito, departamento)
  const cocheras = cantidad(estacionamientos)
  // Equivalente en la otra moneda (aproximado), solo si el aviso publicó su precio.
  const otraMoneda: Currency = price.label === 'USD' ? 'PEN' : 'USD'
  const equivalente = partes ? partesDePrecio(getDisplayPrice(precio, precioUsd, otraMoneda, monedaOriginal)) : null

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
            <Insignia etiqueta="Op." tono={alquiler ? 'green' : 'rose'} titulo={alquiler ? 'Se alquila' : 'Se vende'}>
              {op.label}
            </Insignia>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleFavorite(id)
                }}
                aria-pressed={!!isFavorite}
                className="inline-flex size-8 items-center justify-center rounded-lg bg-black/60 backdrop-blur-md transition hover:bg-black/80"
                title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Heart className={cn('size-4', isFavorite ? 'fill-rose text-rose' : 'text-white')} />
                <span className="sr-only">{isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}</span>
              </button>
            )}
          </div>

          {/* Abajo de la foto: tipo de inmueble a la izquierda; novedad y cantidad de fotos a la derecha */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[2] flex items-end justify-between gap-2">
            <Insignia etiqueta="Tipo" tono={tonoInsignia(tipo.tono)} className="min-w-0">
              {tipo.label}
            </Insignia>
            <div className="flex shrink-0 items-center gap-1.5">
              {nuevo && (
                <Insignia tono="amber" titulo="Entró al sistema en los últimos 3 días">
                  Nuevo
                </Insignia>
              )}
              {(fotos ?? 0) > 1 && (
                <Insignia tono="neutral" titulo={`${fotos} fotos`}>
                  {fotos} fotos
                </Insignia>
              )}
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex flex-col items-start gap-2">
            {partes ? (
              <Insignia tamano="lg" etiqueta={esProyecto ? `Desde · ${partes.moneda}` : partes.moneda} tono="green">
                {partes.monto}
                {alquiler && <span className="sb-suffix">{" "}/ mes</span>}
              </Insignia>
            ) : (
              <Insignia tamano="lg" etiqueta="Precio" atenuada>
                Sin precio
              </Insignia>
            )}
            {(porM2 && !alquiler) || equivalente ? (
              <div className="flex flex-wrap gap-1.5">
                {porM2 && !alquiler && (
                  <Insignia etiqueta="Por m²" mono>
                    {porM2.moneda} {porM2.monto}
                  </Insignia>
                )}
                {equivalente && (
                  <Insignia etiqueta={`≈ ${equivalente.moneda}`} mono titulo="Conversión aproximada con el tipo de cambio del sistema">
                    {equivalente.monto.replace('~', '')}
                  </Insignia>
                )}
              </div>
            ) : null}
          </div>

          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-text">
            {onOpenDetail ? (
              <button type="button" onClick={() => onOpenDetail(id)} className="text-left transition hover:text-gold">
                {titulo}
              </button>
            ) : (
              titulo
            )}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {cantidad(dormitorios) && <Insignia etiqueta="Dorm" mono>{cantidad(dormitorios)}</Insignia>}
            {cantidad(banios) && <Insignia etiqueta="Baños" mono>{cantidad(banios)}</Insignia>}
            {cantidad(area) && <Insignia etiqueta="Área" mono>{formatoArea(area)}</Insignia>}
            {cocheras && <Insignia etiqueta="Coch" mono>{cocheras}</Insignia>}
            {estado && <Insignia etiqueta="Estado" tono={tonoInsignia(estado.tono)}>{estado.label}</Insignia>}
          </div>

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
