import { useId, type ReactNode } from 'react'
import { Icono3D, type Tono } from '@/components/portal/detail/Piezas'
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
