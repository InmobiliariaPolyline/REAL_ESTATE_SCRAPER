import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Icono3D, type Tono } from '@/components/portal/detail/Piezas'
import { cn } from '@/lib/utils'
import { claveNombre } from '@shared/ubicacion'

/** Grupo de opciones excluyentes con estilo segmentado. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="min-w-0">
      <span className="field-label" id={id}>{label}</span>
      <div className="segmented" role="group" aria-labelledby={id}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className="segmented-option min-w-0 whitespace-nowrap"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Lista desplegable con «Todos» más los valores que existen en el catálogo (con su cantidad). */
export function Selector({
  id,
  label,
  value,
  onChange,
  opciones,
  vacio,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  opciones: { valor: string; n?: number }[]
  vacio: string
}) {
  // Si el valor elegido ya no está en la lista (p. ej. al aplicar una búsqueda guardada) se mantiene visible.
  const lista = value && !opciones.some(o => claveNombre(o.valor) === claveNombre(value)) ? [{ valor: value }, ...opciones] : opciones
  return (
    <div className="min-w-0">
      <label className="field-label" htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className="field" disabled={lista.length === 0}>
        <option value="">{lista.length === 0 ? vacio : 'Todos'}</option>
        {lista.map(o => (
          <option key={o.valor} value={o.valor}>
            {o.valor}{o.n !== undefined ? ` (${o.n.toLocaleString('es-PE')})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Grupo con título: agrupa campos relacionados con aire suficiente entre ellos. */
export function Grupo({ icon, tono, title, children, aside }: { icon: Parameters<typeof Icono3D>[0]['icon']; tono: Tono; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4 border-0 p-0">
      <legend className="mb-4 flex w-full items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-sm font-semibold text-text">
          <Icono3D icon={icon} tono={tono} size="sm" />
          {title}
        </span>
        {aside}
      </legend>
      {children}
    </fieldset>
  )
}

export interface OpcionFicha<T extends string> {
  value: T
  label: string
  /** Icono que se muestra sobre la etiqueta. */
  icon?: LucideIcon
  /** Cantidad de avisos con esta opción. */
  n?: number
}

/**
 * Opciones excluyentes como fichas grandes (icono arriba, etiqueta y cantidad), más fáciles de ver y
 * de tocar que un menú. `columnas` es el número de fichas por fila.
 */
export function Fichas<T extends string>({
  label,
  value,
  options,
  onChange,
  columnas = 3,
}: {
  label: string
  value: T
  options: OpcionFicha<T>[]
  onChange: (value: T) => void
  columnas?: 2 | 3 | 4 | 5
}) {
  const id = useId()
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' }[columnas]
  return (
    <div className="min-w-0">
      <span className="field-label" id={id}>{label}</span>
      <div className={cn('grid gap-2', cols)} role="group" aria-labelledby={id}>
        {options.map(o => {
          const Icon = o.icon
          const activa = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={activa}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-center transition',
                activa
                  ? 'border-gold bg-gold-soft text-text shadow-[0_8px_20px_-12px_rgb(var(--gold-rgb)/0.8)]'
                  : 'border-line bg-surface-3/50 text-text-muted hover:border-gold/40 hover:text-text'
              )}
            >
              {Icon && <Icon className={cn('size-[1.15rem]', activa ? 'text-gold' : 'text-text-faint')} strokeWidth={1.75} aria-hidden="true" />}
              <span className="w-full truncate text-xs font-semibold">{o.label}</span>
              {o.n !== undefined && <span className="mono text-[0.625rem] text-text-faint">{o.n.toLocaleString('es-PE')}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Opciones que se pueden activar varias a la vez (portales), como etiquetas con un punto de color. */
export function Etiquetas({
  label,
  options,
  seleccion,
  onToggle,
}: {
  label: string
  options: { value: string; label: string; color?: string; n?: number }[]
  seleccion: string[]
  onToggle: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="min-w-0">
      <span className="field-label" id={id}>{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
        {options.map(o => {
          const activa = seleccion.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={activa}
              onClick={() => onToggle(o.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                activa ? 'border-gold bg-gold-soft text-text' : 'border-line bg-surface-3/50 text-text-muted hover:border-gold/40 hover:text-text'
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: o.color ?? 'var(--gold)' }} aria-hidden="true" />
              {o.label}
              {o.n !== undefined && <span className="mono text-[0.625rem] text-text-faint">{o.n.toLocaleString('es-PE')}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Bloque de la ventana de filtros: tarjeta con icono 3D, título y sus campos a la vista. */
export function Bloque({ icon, tono, title, children, className }: { icon: LucideIcon; tono: Tono; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 space-y-4 rounded-2xl border border-line bg-surface-2/60 p-4', className)}>
      <h3 className="flex items-center gap-2.5 text-sm font-semibold text-text">
        <Icono3D icon={icon} tono={tono} size="sm" />
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * Bloque desglosable de la ventana de filtros: la cabecera siempre se ve (icono, título y, si hay algo elegido, un
 * resumen) y el contenido se muestra u oculta. Así la ventana no se alarga aunque tenga muchas opciones.
 */
export function BloqueDesplegable({
  icon,
  tono,
  title,
  resumen,
  abierto,
  onToggle,
  children,
  className,
}: {
  icon: LucideIcon
  tono: Tono
  title: string
  /** Lo elegido en este bloque, en una línea; vacío si no hay filtro activo. */
  resumen?: string
  abierto: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
}) {
  const id = useId()
  const activo = !!resumen
  return (
    <section className={cn('min-w-0 overflow-hidden rounded-2xl border bg-surface-2/60 transition-colors', activo ? 'border-gold/35' : 'border-line', className)}>
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={abierto}
          aria-controls={id}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-surface-3/50"
        >
          <Icono3D icon={icon} tono={tono} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text">{title}</span>
            {!abierto && activo && <span className="mt-0.5 block truncate text-xs font-medium text-gold">{resumen}</span>}
          </span>
          {activo && abierto && <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-label="Con filtro activo" />}
          <ChevronDown className={cn('size-4 shrink-0 text-text-muted transition-transform duration-200', abierto && 'rotate-180')} aria-hidden="true" />
        </button>
      </h3>
      <div id={id} hidden={!abierto} className="space-y-4 border-t border-line px-4 pb-4 pt-4">
        {children}
      </div>
    </section>
  )
}
