import { ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Etiquetas, Selector } from '@/components/filters/Campos'
import type { Faceta, Facetas } from '@/lib/facetas'
import { elegirDepartamento, elegirDistrito, elegirProvincia, rutaGeografica, sugerirDistritos, type SeleccionGeo } from '@/lib/geografia'
import { claveNombre } from '@shared/ubicacion'

interface UbicacionFiltroProps {
  /** Prefijo de los id de los campos (`flt` en el portal, `adm` en el panel). */
  idBase: string
  geo: SeleccionGeo
  /** Todas las opciones, para validar la jerarquía al elegir. */
  facetas: Pick<Facetas, 'provincias' | 'distritos'>
  /** Lo que se ofrece en cada lista (ya limitado por la jerarquía y por lo disponible). */
  departamentos: Faceta[]
  provincias: Faceta[]
  distritos: Faceta[]
  vacio: string
  /** Cambio normal (selectores y escritura). */
  onCambiar: (geo: SeleccionGeo) => void
  /** Cambio de un solo clic (etiquetas de distritos populares); sin esta función se usa `onCambiar`. */
  onAplicar?: (geo: SeleccionGeo) => void
}

/**
 * Ubicación con jerarquía departamento → provincia → distrito: cada nivel ofrece solo lo del nivel de arriba, y elegir un
 * nivel completa los de arriba. Se usa igual en el portal y en el panel de administración.
 */
export default function UbicacionFiltro({ idBase, geo, facetas, departamentos, provincias, distritos, vacio, onCambiar, onAplicar }: UbicacionFiltroProps) {
  const [mostrar, setMostrar] = useState(false)
  const sugerencias = sugerirDistritos(distritos, geo.distrito)
  const populares = distritos.filter(d => d.n > 0).slice(0, 8)
  const lugar = geo.provincia || geo.departamento
  const aplicar = onAplicar ?? onCambiar
  const ruta = [geo.departamento, geo.provincia, geo.distrito].filter(Boolean)

  return (
    <div className="grid gap-4">
      {rutaGeografica(geo) && (
        <p className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-3/60 px-3 py-2 text-xs font-medium text-text" aria-label="Lugar elegido">
          {ruta.map((n, i) => (
            <span key={n + i} className="inline-flex items-center gap-1">
              {n}
              {i < ruta.length - 1 && <ChevronRight className="size-3 text-text-faint" aria-hidden="true" />}
            </span>
          ))}
        </p>
      )}
      <Selector id={`${idBase}-departamento`} label="Departamento" value={geo.departamento} onChange={v => onCambiar(elegirDepartamento(facetas, geo, v))} opciones={departamentos} vacio={vacio} />
      <Selector id={`${idBase}-provincia`} label="Ciudad o provincia" value={geo.provincia} onChange={v => onCambiar(elegirProvincia(facetas, geo, v))} opciones={provincias} vacio={vacio} />

      <div className="relative">
        <label className="field-label" htmlFor={`${idBase}-distrito`}>Distrito</label>
        <div className="field-icon">
          <Search className="size-4" />
          <input
            id={`${idBase}-distrito`}
            type="text"
            value={geo.distrito}
            onChange={e => {
              onCambiar({ ...geo, distrito: e.target.value })
              setMostrar(true)
            }}
            onFocus={() => setMostrar(true)}
            onBlur={() => setTimeout(() => setMostrar(false), 150)}
            placeholder={lugar ? `Distritos de ${lugar}…` : 'Buscar distrito...'}
            className="field"
            autoComplete="off"
          />
        </div>
        {mostrar && sugerencias.length > 0 && (
          <ul className="animate-popIn absolute left-0 right-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl">
            {sugerencias.map(d => (
              <li key={`${d.valor}|${d.padre}|${d.provincia}`}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onCambiar(elegirDistrito(facetas, geo, d.valor))
                    setMostrar(false)
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-text transition hover:bg-surface-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{d.valor}</span>
                    {(d.provincia || d.padre) && (
                      <span className="block truncate text-[0.6875rem] text-text-faint">{[d.provincia, d.padre].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ')}</span>
                    )}
                  </span>
                  <span className="mono shrink-0 text-xs text-text-muted">{d.n.toLocaleString('es-PE')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {populares.length > 0 && (
        <Etiquetas
          label={lugar ? `Distritos con más avisos en ${lugar}` : 'Distritos con más avisos'}
          options={populares.map(d => ({ value: d.valor, label: d.valor, n: d.n }))}
          seleccion={geo.distrito ? [populares.find(d => claveNombre(d.valor) === claveNombre(geo.distrito))?.valor ?? ''] : []}
          onToggle={v => aplicar(claveNombre(geo.distrito) === claveNombre(v) ? { ...geo, distrito: '' } : elegirDistrito(facetas, geo, v))}
        />
      )}
    </div>
  )
}
