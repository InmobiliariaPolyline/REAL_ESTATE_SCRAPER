import {
  Bath, BedDouble, Briefcase, Building2, CalendarClock, Car, CircleDollarSign, Construction, Hammer, Home, KeyRound, Layers, Loader2, MapPin, Ruler,
  Search, SlidersHorizontal, Store, Tag, TextCursorInput, Trees, UserRound, Warehouse, X, BedSingle, type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bloque, Etiquetas, Fichas, Selector, type OpcionFicha } from '@/components/filters/Campos'
import { Icono3D } from '@/components/portal/detail/Piezas'
import { useFacetas } from '@/hooks/useFacetas'
import { atajosDePrecio, filtrosActivos } from '@/lib/filterChips'
import { PORTALS } from '@/lib/portals'
import { claveNombre } from '@shared/ubicacion'
import { cn } from '@/lib/utils'
import { DEFAULT_FILTERS, type FilterState } from '@/types'

export type { FilterState }

interface PortalFiltersProps {
  /** Filtros actuales (el estado vive en el padre, así escritorio y móvil comparten valores). */
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  /** Se llama al pulsar "Buscar". */
  onSearch: () => void
  /** Se llama al pulsar limpiar, con los filtros ya restablecidos. */
  onClear: (cleared: FilterState) => void
  /** Aplica filtros al instante (al quitar un chip o elegir un atajo); sin esta función solo se editan. */
  onApply?: (filters: FilterState) => void
  /** Cuántos avisos cumplen unos filtros; si se da, la ventana muestra el total en vivo mientras se editan. */
  contar?: (filters: FilterState) => Promise<number>
  isMobileDrawer?: boolean
}

/** Distritos que se sugieren mientras no se conoce el catálogo (o si aún no tiene ubicación guardada). */
const DISTRITOS_BASE = [
  'Ancón', 'Ate', 'Barranco', 'Breña', 'Callao', 'Carabayllo', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas',
  'El Agustino', 'Independencia', 'Jesús María', 'La Molina', 'La Perla', 'La Punta', 'La Victoria', 'Lima', 'Lince',
  'Los Olivos', 'Lurigancho', 'Lurín', 'Magdalena del Mar', 'Miraflores', 'Pachacámac', 'Pueblo Libre', 'Puente Piedra',
  'Rímac', 'San Borja', 'San Isidro', 'San Juan de Lurigancho', 'San Juan de Miraflores', 'San Luis', 'San Martín de Porres',
  'San Miguel', 'Santa Anita', 'Santiago de Surco', 'Surquillo', 'Ventanilla', 'Villa El Salvador', 'Villa María del Triunfo',
  'Arequipa', 'Cayma', 'Cerro Colorado', 'Trujillo', 'Chiclayo', 'Cusco', 'Piura', 'Tarapoto', 'Huancayo', 'Iquitos', 'Tacna',
].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

const ICONO_TIPO: Record<string, LucideIcon> = {
  departamento: Building2,
  casa: Home,
  terreno: Trees,
  oficina: Briefcase,
  'local comercial': Store,
  proyecto: Construction,
  habitación: BedSingle,
  habitacion: BedSingle,
  'galpón': Warehouse,
}

const removeAccents = (str: string) => str.normalize('NFD').replace(/[̀-ͯ]/g, '')
const numero = (value: string): number | '' => (value === '' ? '' : Number(value))

/** Rangos de área rápidos. */
const AREAS_RAPIDAS: { label: string; min: number | ''; max: number | '' }[] = [
  { label: 'Hasta 50 m²', min: '', max: 50 },
  { label: '50 a 100 m²', min: 50, max: 100 },
  { label: '100 a 200 m²', min: 100, max: 200 },
  { label: 'Más de 200 m²', min: 200, max: '' },
]

export default function PortalFilters({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  onApply,
  contar,
  isMobileDrawer = false,
}: PortalFiltersProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const facetas = useFacetas()

  const update = (patch: Partial<FilterState>) => onFiltersChange({ ...filters, ...patch })
  const aplicar = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch }
    onFiltersChange(next)
    onApply?.(next)
  }

  const activos = filtrosActivos(filters)

  // Total en vivo: se vuelve a contar un instante después del último cambio.
  const [total, setTotal] = useState<number | null>(null)
  const [contando, setContando] = useState(false)
  const claveFiltros = JSON.stringify(filters)
  const ultimo = useRef(0)
  useEffect(() => {
    if (!contar) return
    const id = ++ultimo.current
    setContando(true)
    const t = setTimeout(() => {
      contar(filters)
        .then(n => id === ultimo.current && setTotal(n))
        .catch(() => id === ultimo.current && setTotal(null))
        .finally(() => id === ultimo.current && setContando(false))
    }, 450)
    return () => clearTimeout(t)
    // `contar` cambia de identidad en cada render del padre: solo importan los filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFiltros])

  // Listas del catálogo: las provincias se limitan al departamento elegido y los distritos a ambos.
  const departamentos = facetas?.departamentos ?? []
  const provincias = useMemo(
    () => (facetas?.provincias ?? []).filter(p => !filters.departamento || !p.padre || claveNombre(p.padre) === claveNombre(filters.departamento)),
    [facetas, filters.departamento]
  )
  const distritosCatalogo = useMemo(
    () => (facetas?.distritos ?? []).filter(d => !filters.departamento || !d.padre || claveNombre(d.padre) === claveNombre(filters.departamento)),
    [facetas, filters.departamento]
  )

  // Tipos de inmueble: los más frecuentes del catálogo (con su cantidad), o los dos de siempre si aún no hay datos.
  const tipos: OpcionFicha<string>[] = useMemo(() => {
    const base = facetas?.inmuebles?.length ? facetas.inmuebles.slice(0, 5) : [{ valor: 'Departamento', n: undefined }, { valor: 'Casa', n: undefined }]
    return [
      { value: 'todos', label: 'Todos', icon: Layers },
      ...base.map(t => ({ value: t.valor, label: t.valor, icon: ICONO_TIPO[t.valor.toLowerCase()] ?? Building2, n: t.n })),
    ]
  }, [facetas])
  // Si el tipo elegido no está entre los más frecuentes (búsqueda guardada), se muestra igual.
  const tiposConActual = filters.inmueble !== 'todos' && !tipos.some(t => t.value === filters.inmueble) ? [...tipos, { value: filters.inmueble, label: filters.inmueble, icon: Building2 }] : tipos

  // Sugerencias de distrito mientras se escribe.
  const suggestions = useMemo(() => {
    const q = removeAccents(filters.distrito.trim().toLowerCase())
    if (!q) return []
    const base: { valor: string; n?: number }[] = distritosCatalogo.length > 0 ? distritosCatalogo : DISTRITOS_BASE.map(valor => ({ valor }))
    return base.filter(d => removeAccents(d.valor.toLowerCase()).includes(q)).slice(0, 12)
  }, [filters.distrito, distritosCatalogo])
  const populares = distritosCatalogo.slice(0, 8)

  const handlePortalToggle = (portal: string) =>
    update({ portales: filters.portales.includes(portal) ? filters.portales.filter(p => p !== portal) : [...filters.portales, portal] })

  const handleClear = () => {
    const cleared: FilterState = { ...DEFAULT_FILTERS, portales: [] }
    onFiltersChange(cleared)
    onClear(cleared)
  }

  const currency = filters.moneda === 'PEN' ? 'S/' : 'USD'
  const atajos = atajosDePrecio(filters.moneda, filters.operacion)
  const numeros = (cant: 3 | 4) =>
    (cant === 4
      ? [['todos', 'Todos'], ['1', '1'], ['2', '2'], ['3', '3'], ['4+', '4+']]
      : [['todos', 'Todos'], ['1', '1'], ['2', '2'], ['3+', '3+']]) as [string, string][]

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSearch()
      }}
      className={cn(isMobileDrawer ? 'flex h-full flex-col' : 'card flex flex-col overflow-hidden xl:max-h-[calc(100vh-6.5rem)]')}
      role="search"
      aria-label="Filtros de propiedades"
    >
      {/* Cabecera: título, cantidad de filtros y limpiar todo */}
      {!isMobileDrawer && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <Icono3D icon={SlidersHorizontal} tono="gold" size="sm" />
            <h2 className="text-base font-semibold text-text">Filtros</h2>
            {activos.length > 0 && <span className="badge badge-gold">{activos.length} activo{activos.length === 1 ? '' : 's'}</span>}
          </div>
          {activos.length > 0 && (
            <button type="button" onClick={handleClear} className="btn btn-ghost btn-sm">
              <X className="size-4" />
              Limpiar todo
            </button>
          )}
        </header>
      )}

      {/* Filtros aplicados */}
      <ul className={cn('flex flex-wrap items-center gap-2 border-b border-line px-5 py-3', activos.length === 0 && 'hidden')} aria-label="Filtros aplicados">
        {activos.map(a => (
          <li key={a.clave}>
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft py-1 pl-3 pr-1 text-xs font-medium text-text">
              <span className="truncate">{a.etiqueta}</span>
              <button
                type="button"
                onClick={() => aplicar(a.quitar)}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-gold/25 hover:text-text"
                aria-label={`Quitar filtro: ${a.etiqueta}`}
              >
                <X className="size-3" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {/* Ventana de filtros: todo a la vista, en bloques */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className={cn('grid gap-4', !isMobileDrawer && 'md:grid-cols-2 xl:grid-cols-1')}>
          <Bloque icon={TextCursorInput} tono="rose" title="Buscar por palabra">
            <div>
              <label className="field-label" htmlFor="flt-texto">Palabra clave</label>
              <div className="field-icon">
                <Search className="size-4" />
                <input
                  id="flt-texto"
                  type="search"
                  value={filters.texto}
                  onChange={e => update({ texto: e.target.value })}
                  placeholder="Ej.: terraza, vista al mar"
                  className="field"
                  maxLength={80}
                  autoComplete="off"
                />
              </div>
            </div>
          </Bloque>

          <Bloque icon={KeyRound} tono="gold" title="Operación">
            <Fichas
              label="Qué buscas"
              columnas={3}
              value={filters.operacion}
              onChange={operacion => update({ operacion })}
              options={[
                { value: 'todos', label: 'Todas', icon: Layers },
                { value: 'ALQUILER', label: 'Alquiler', icon: KeyRound },
                { value: 'VENTA', label: 'Venta', icon: Tag },
              ]}
            />
          </Bloque>

          <Bloque icon={Building2} tono="violet" title="Tipo de inmueble" className="md:col-span-2 xl:col-span-1">
            <Fichas label="Tipo" columnas={3} value={filters.inmueble} onChange={inmueble => update({ inmueble })} options={tiposConActual} />
          </Bloque>

          <Bloque icon={MapPin} tono="blue" title="Ubicación">
            <div className="grid gap-4">
              <Selector id="flt-departamento" label="Departamento" value={filters.departamento} onChange={v => update({ departamento: v, provincia: '' })} opciones={departamentos} vacio="Sin datos aún" />
              <Selector id="flt-provincia" label="Ciudad o provincia" value={filters.provincia} onChange={v => update({ provincia: v })} opciones={provincias} vacio="Sin datos aún" />

              <div className="relative">
                <label className="field-label" htmlFor="flt-distrito">Distrito</label>
                <div className="field-icon">
                  <Search className="size-4" />
                  <input
                    id="flt-distrito"
                    type="text"
                    value={filters.distrito}
                    onChange={e => {
                      update({ distrito: e.target.value })
                      setShowSuggestions(true)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="Buscar distrito..."
                    className="field"
                    autoComplete="off"
                  />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="animate-popIn absolute left-0 right-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl">
                    {suggestions.map(d => (
                      <li key={d.valor}>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            update({ distrito: d.valor })
                            setShowSuggestions(false)
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-text transition hover:bg-surface-3"
                        >
                          <span className="truncate">{d.valor}</span>
                          {d.n !== undefined && <span className="mono shrink-0 text-xs text-text-muted">{d.n.toLocaleString('es-PE')}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {populares.length > 0 && (
                <Etiquetas
                  label="Distritos con más avisos"
                  options={populares.map(d => ({ value: d.valor, label: d.valor, n: d.n }))}
                  seleccion={filters.distrito ? [populares.find(d => claveNombre(d.valor) === claveNombre(filters.distrito))?.valor ?? ''] : []}
                  onToggle={v => aplicar({ distrito: claveNombre(filters.distrito) === claveNombre(v) ? '' : v })}
                />
              )}
            </div>
          </Bloque>

          <Bloque icon={CircleDollarSign} tono="green" title="Precio">
            <div className="grid gap-4">
              <Fichas
                label="Moneda"
                columnas={2}
                value={filters.moneda}
                onChange={moneda => update({ moneda })}
                options={[
                  { value: 'PEN', label: 'Soles (S/)', icon: CircleDollarSign },
                  { value: 'USD', label: 'Dólares (USD)', icon: CircleDollarSign },
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="flt-min">Mín. ({currency})</label>
                  <input id="flt-min" type="number" min={0} inputMode="numeric" value={filters.precioMin} onChange={e => update({ precioMin: numero(e.target.value) })} placeholder="0" className="field mono" />
                </div>
                <div>
                  <label className="field-label" htmlFor="flt-max">Máx. ({currency})</label>
                  <input id="flt-max" type="number" min={0} inputMode="numeric" value={filters.precioMax} onChange={e => update({ precioMax: numero(e.target.value) })} placeholder="Sin límite" className="field mono" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topes de precio rápidos">
                {atajos.map(a => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={filters.precioMax === a && filters.precioMin === ''}
                    onClick={() => aplicar({ precioMin: '', precioMax: a })}
                    className="rounded-full border border-line bg-surface-3 px-2.5 py-1 text-xs font-medium text-text-muted transition hover:border-gold/50 hover:text-text aria-pressed:border-gold aria-pressed:bg-gold-soft aria-pressed:text-gold"
                  >
                    Hasta {currency} {a.toLocaleString('es-PE')}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-3/40 px-4 py-2.5 text-sm text-text transition hover:border-gold/40">
                <input type="checkbox" checked={filters.soloConPrecio} onChange={e => update({ soloConPrecio: e.target.checked })} className="size-4 cursor-pointer accent-gold" />
                Solo avisos con precio publicado
              </label>
            </div>
          </Bloque>

          <Bloque icon={BedDouble} tono="violet" title="Ambientes y cocheras">
            <div className="grid gap-4">
              <Fichas label="Dormitorios" columnas={5} value={filters.dormitorios} onChange={dormitorios => update({ dormitorios })} options={numeros(4).map(([value, label]) => ({ value: value as FilterState['dormitorios'], label, icon: value === 'todos' ? Layers : BedDouble }))} />
              <Fichas label="Baños" columnas={4} value={filters.banios} onChange={banios => update({ banios })} options={numeros(3).map(([value, label]) => ({ value: value as FilterState['banios'], label, icon: value === 'todos' ? Layers : Bath }))} />
              <Fichas
                label="Cocheras"
                columnas={4}
                value={filters.cocheras}
                onChange={cocheras => update({ cocheras })}
                options={[
                  { value: 'todos', label: 'Todas', icon: Layers },
                  { value: '1+', label: '1+', icon: Car },
                  { value: '2+', label: '2+', icon: Car },
                  { value: '3+', label: '3+', icon: Car },
                ]}
              />
            </div>
          </Bloque>

          <Bloque icon={Ruler} tono="blue" title="Área construida">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="flt-area-min">Mín. (m²)</label>
                  <input id="flt-area-min" type="number" min={0} inputMode="numeric" value={filters.areaMin} onChange={e => update({ areaMin: numero(e.target.value) })} placeholder="0" className="field mono" />
                </div>
                <div>
                  <label className="field-label" htmlFor="flt-area-max">Máx. (m²)</label>
                  <input id="flt-area-max" type="number" min={0} inputMode="numeric" value={filters.areaMax} onChange={e => update({ areaMax: numero(e.target.value) })} placeholder="Sin límite" className="field mono" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rangos de área rápidos">
                {AREAS_RAPIDAS.map(a => (
                  <button
                    key={a.label}
                    type="button"
                    aria-pressed={filters.areaMin === a.min && filters.areaMax === a.max}
                    onClick={() => aplicar({ areaMin: a.min, areaMax: a.max })}
                    className="rounded-full border border-line bg-surface-3 px-2.5 py-1 text-xs font-medium text-text-muted transition hover:border-gold/50 hover:text-text aria-pressed:border-gold aria-pressed:bg-gold-soft aria-pressed:text-gold"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </Bloque>

          <Bloque icon={Hammer} tono="rose" title="Antigüedad">
            <Fichas
              label="Años máximos"
              columnas={5}
              value={String(filters.antiguedadMax)}
              onChange={v => update({ antiguedadMax: v === '' ? '' : Number(v) })}
              options={[
                { value: '', label: 'Todas', icon: Layers },
                { value: '0', label: 'Estreno', icon: Hammer },
                { value: '5', label: '5', icon: Hammer },
                { value: '10', label: '10', icon: Hammer },
                { value: '20', label: '20', icon: Hammer },
              ]}
            />
          </Bloque>

          <Bloque icon={Building2} tono="teal" title="Portales">
            <Etiquetas
              label="Dónde se publicó"
              options={PORTALS.map(p => ({ value: p.label, label: p.label, color: p.color }))}
              seleccion={filters.portales}
              onToggle={handlePortalToggle}
            />
          </Bloque>

          <Bloque icon={UserRound} tono="amber" title="Anunciante">
            <div>
              <label className="field-label" htmlFor="flt-anunciante">Inmobiliaria o persona</label>
              <input id="flt-anunciante" type="text" list="flt-anunciantes" value={filters.anunciante} onChange={e => update({ anunciante: e.target.value })} placeholder="Ej.: Prisma" className="field" maxLength={80} autoComplete="off" />
              <datalist id="flt-anunciantes">
                {(facetas?.anunciantes ?? []).map(a => <option key={a.valor} value={a.valor} />)}
              </datalist>
            </div>
          </Bloque>

          <Bloque icon={CalendarClock} tono="green" title="Publicación">
            <Fichas
              label="Publicado en el sistema"
              columnas={4}
              value={filters.publicado}
              onChange={publicado => update({ publicado })}
              options={[
                { value: 'todos', label: 'Siempre', icon: Layers },
                { value: 'hoy', label: 'Hoy', icon: CalendarClock },
                { value: 'semana', label: '7 días', icon: CalendarClock },
                { value: 'mes', label: '30 días', icon: CalendarClock },
              ]}
            />
          </Bloque>
        </div>
      </div>

      {/* Pie fijo: total en vivo y acciones */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-1/70 px-5 py-4">
        <p className="flex min-h-5 items-center gap-2 text-sm text-text-muted" aria-live="polite">
          {contar ? (
            contando ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Contando…
              </>
            ) : total !== null ? (
              <>
                <strong className="mono text-base font-semibold text-gold">{total.toLocaleString('es-PE')}</strong> aviso{total === 1 ? '' : 's'}
              </>
            ) : null
          ) : activos.length === 0 ? (
            'Sin filtros'
          ) : null}
        </p>
        <div className="flex gap-2.5">
          <button type="button" onClick={handleClear} className="btn btn-secondary" aria-label="Limpiar filtros" title="Limpiar filtros">
            <X className="size-4" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
          <button type="submit" className="btn btn-primary">
            <Search className="size-4" />
            Buscar
          </button>
        </div>
      </footer>
    </form>
  )
}
