import { Bath, BedDouble, Building2, CalendarClock, Car, ChevronDown, CircleDollarSign, Hammer, Landmark, MapPin, Ruler, Search, SlidersHorizontal, TextCursorInput, UserRound, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Grupo, Segmented, Selector } from '@/components/filters/Campos'
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
  isMobileDrawer?: boolean
}

const PORTALES_OPCIONES = PORTALS.map(p => p.label)

/** Distritos que se sugieren mientras no se conoce el catálogo (o si aún no tiene ubicación guardada). */
const DISTRITOS_BASE = [
  'Ancón', 'Ate', 'Barranco', 'Breña', 'Callao', 'Carabayllo', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas',
  'El Agustino', 'Independencia', 'Jesús María', 'La Molina', 'La Perla', 'La Punta', 'La Victoria', 'Lima', 'Lince',
  'Los Olivos', 'Lurigancho', 'Lurín', 'Magdalena del Mar', 'Miraflores', 'Pachacámac', 'Pueblo Libre', 'Puente Piedra',
  'Rímac', 'San Borja', 'San Isidro', 'San Juan de Lurigancho', 'San Juan de Miraflores', 'San Luis', 'San Martín de Porres',
  'San Miguel', 'Santa Anita', 'Santiago de Surco', 'Surquillo', 'Ventanilla', 'Villa El Salvador', 'Villa María del Triunfo',
  'Arequipa', 'Cayma', 'Cerro Colorado', 'Trujillo', 'Chiclayo', 'Cusco', 'Piura', 'Tarapoto', 'Huancayo', 'Iquitos', 'Tacna',
].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

const OPERACIONES: { value: FilterState['operacion']; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ALQUILER', label: 'Alquiler' },
  { value: 'VENTA', label: 'Venta' },
]

const DORMITORIOS: { value: FilterState['dormitorios']; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4+', label: '4+' },
]

const BANIOS: { value: FilterState['banios']; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3+', label: '3+' },
]

const COCHERAS: { value: FilterState['cocheras']; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: '1+', label: '1+' },
  { value: '2+', label: '2+' },
  { value: '3+', label: '3+' },
]

const PUBLICADOS: { value: FilterState['publicado']; label: string }[] = [
  { value: 'todos', label: 'Cualquiera' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: '7 días' },
  { value: 'mes', label: '30 días' },
]

/** Antigüedad máxima: «Estreno» es 0 años. El valor es el texto del número («» = cualquiera). */
const ANTIGUEDADES: { value: string; label: string }[] = [
  { value: '', label: 'Cualquiera' },
  { value: '0', label: 'Estreno' },
  { value: '5', label: 'Hasta 5' },
  { value: '10', label: 'Hasta 10' },
  { value: '20', label: 'Hasta 20' },
]

const removeAccents = (str: string) => str.normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function PortalFilters({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  onApply,
  isMobileDrawer = false,
}: PortalFiltersProps) {
  const [showPortalDropdown, setShowPortalDropdown] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mas, setMas] = useState(false)
  const portalRef = useRef<HTMLDivElement>(null)
  const masId = useId()
  const facetas = useFacetas()

  const update = (patch: Partial<FilterState>) => onFiltersChange({ ...filters, ...patch })

  // Cierra el selector de portales al hacer clic fuera.
  useEffect(() => {
    if (!showPortalDropdown) return
    const onDown = (e: MouseEvent) => {
      if (!portalRef.current?.contains(e.target as Node)) setShowPortalDropdown(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showPortalDropdown])

  const activos = filtrosActivos(filters)
  const nAvanzados = activos.filter(a => a.avanzado).length

  // Si ya hay filtros avanzados puestos (p. ej. al aplicar una búsqueda guardada), el desglose se abre.
  useEffect(() => {
    if (nAvanzados > 0) setMas(true)
  }, [nAvanzados])

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
  const inmuebles = facetas?.inmuebles?.length ? facetas.inmuebles : [{ valor: 'Departamento' }, { valor: 'Casa' }]

  // Sugerencias de distrito: primero los del catálogo (con su cantidad) y, si no hay, la lista base.
  const suggestions = useMemo(() => {
    const q = removeAccents(filters.distrito.trim().toLowerCase())
    if (!q) return []
    const base: { valor: string; n?: number }[] = distritosCatalogo.length > 0 ? distritosCatalogo : DISTRITOS_BASE.map(valor => ({ valor }))
    return base.filter(d => removeAccents(d.valor.toLowerCase()).includes(q)).slice(0, 12)
  }, [filters.distrito, distritosCatalogo])

  const handlePortalToggle = (portal: string) =>
    update({
      portales: filters.portales.includes(portal)
        ? filters.portales.filter(p => p !== portal)
        : [...filters.portales, portal],
    })

  const numero = (value: string): number | '' => (value === '' ? '' : Number(value))

  const handleClear = () => {
    const cleared: FilterState = { ...DEFAULT_FILTERS, portales: [] }
    onFiltersChange(cleared)
    onClear(cleared)
  }

  const quitar = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch }
    onFiltersChange(next)
    onApply?.(next)
  }

  const currency = filters.moneda === 'PEN' ? 'S/' : 'USD'
  const atajos = atajosDePrecio(filters.moneda, filters.operacion)
  const grid = isMobileDrawer ? 'grid grid-cols-1 gap-5' : 'grid gap-5 md:grid-cols-2 xl:grid-cols-12'
  const col = (xl: string) => (isMobileDrawer ? '' : xl)

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSearch()
      }}
      className={cn(isMobileDrawer ? 'space-y-6 p-5' : 'card overflow-visible')}
      role="search"
      aria-label="Filtros de propiedades"
    >
      {/* Cabecera: título, cantidad de filtros y limpiar todo */}
      {!isMobileDrawer && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
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

      <div className={cn(isMobileDrawer ? 'space-y-6' : 'space-y-7 px-5 py-6 sm:px-6')}>
        {/* Qué buscas */}
        <Grupo icon={Building2} tono="rose" title="Qué buscas">
          <div className={grid}>
            <div className={col('xl:col-span-5')}>
              <label className="field-label" htmlFor="flt-texto">Palabra clave</label>
              <div className="field-icon">
                <TextCursorInput className="size-4" />
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

            <div className={col('xl:col-span-4')}>
              <Segmented label="Operación" value={filters.operacion} options={OPERACIONES} onChange={operacion => update({ operacion })} />
            </div>

            <div className={col('xl:col-span-3')}>
              <Selector id="flt-inmueble" label="Tipo de inmueble" value={filters.inmueble === 'todos' ? '' : filters.inmueble} onChange={v => update({ inmueble: v || 'todos' })} opciones={inmuebles} vacio="Todos" />
            </div>
          </div>
        </Grupo>

        {/* Ubicación */}
        <Grupo icon={MapPin} tono="blue" title="Ubicación">
          <div className={grid}>
            <div className={col('xl:col-span-4')}>
              <Selector
                id="flt-departamento"
                label="Departamento"
                value={filters.departamento}
                onChange={v => update({ departamento: v, provincia: '' })}
                opciones={departamentos}
                vacio="Sin datos aún"
              />
            </div>

            <div className={col('xl:col-span-4')}>
              <Selector id="flt-provincia" label="Ciudad o provincia" value={filters.provincia} onChange={v => update({ provincia: v })} opciones={provincias} vacio="Sin datos aún" />
            </div>

            {/* Distrito */}
            <div className={cn('relative', col('xl:col-span-4'))}>
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
          </div>
        </Grupo>

        {/* Precio y portales */}
        <Grupo
          icon={CircleDollarSign}
          tono="green"
          title="Precio y portales"
          aside={
            <div className="flex flex-wrap items-center justify-end gap-1.5" role="group" aria-label="Topes de precio rápidos">
              {atajos.map(a => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={filters.precioMax === a && filters.precioMin === ''}
                  onClick={() => {
                    const next = { ...filters, precioMin: '' as const, precioMax: a }
                    onFiltersChange(next)
                    onApply?.(next)
                  }}
                  className="rounded-full border border-line bg-surface-3 px-2.5 py-1 text-xs font-medium text-text-muted transition hover:border-gold/50 hover:text-text aria-pressed:border-gold aria-pressed:bg-gold-soft aria-pressed:text-gold"
                >
                  Hasta {currency} {a.toLocaleString('es-PE')}
                </button>
              ))}
            </div>
          }
        >
          <div className={grid}>
            <div className={col('xl:col-span-3')}>
              <Segmented
                label="Moneda"
                value={filters.moneda}
                options={[
                  { value: 'PEN', label: 'Soles' },
                  { value: 'USD', label: 'Dólares' },
                ]}
                onChange={moneda => update({ moneda })}
              />
            </div>

            <div className={col('xl:col-span-3')}>
              <label className="field-label" htmlFor="flt-min">Precio mín. ({currency})</label>
              <input
                id="flt-min"
                type="number"
                min={0}
                inputMode="numeric"
                value={filters.precioMin}
                onChange={e => update({ precioMin: numero(e.target.value) })}
                placeholder="0"
                className="field mono"
              />
            </div>

            <div className={col('xl:col-span-3')}>
              <label className="field-label" htmlFor="flt-max">Precio máx. ({currency})</label>
              <input
                id="flt-max"
                type="number"
                min={0}
                inputMode="numeric"
                value={filters.precioMax}
                onChange={e => update({ precioMax: numero(e.target.value) })}
                placeholder="Sin límite"
                className="field mono"
              />
            </div>

            {/* Portales */}
            <div className={cn('relative', col('xl:col-span-3'))} ref={portalRef}>
              <span className="field-label" id="flt-portal-label">Portal</span>
              <button
                type="button"
                onClick={() => setShowPortalDropdown(!showPortalDropdown)}
                aria-haspopup="listbox"
                aria-expanded={showPortalDropdown}
                aria-labelledby="flt-portal-label"
                className="field flex items-center justify-between gap-2 text-left"
              >
                <span className={cn('truncate', filters.portales.length === 0 && 'text-text-faint')}>
                  {filters.portales.length === 0 ? 'Todos los portales' : `${filters.portales.length} seleccionado(s)`}
                </span>
                <ChevronDown className={cn('size-4 shrink-0 text-text-muted transition', showPortalDropdown && 'rotate-180')} />
              </button>
              {showPortalDropdown && (
                <div
                  className={cn(
                    'animate-popIn z-30 mt-2 w-full rounded-2xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl',
                    isMobileDrawer ? '' : 'absolute left-0 right-0 top-full'
                  )}
                >
                  {PORTALES_OPCIONES.map(portal => (
                    <label
                      key={portal}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text transition hover:bg-surface-3"
                    >
                      <input
                        type="checkbox"
                        checked={filters.portales.includes(portal)}
                        onChange={() => handlePortalToggle(portal)}
                        className="size-4 cursor-pointer accent-gold"
                      />
                      <span>{portal}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-3/40 px-4 py-2.5 text-sm text-text transition hover:border-gold/40">
            <input
              type="checkbox"
              checked={filters.soloConPrecio}
              onChange={e => update({ soloConPrecio: e.target.checked })}
              className="size-4 cursor-pointer accent-gold"
            />
            Solo avisos con precio publicado
          </label>
        </Grupo>

        {/* Desglose: más filtros */}
        <div>
          <button
            type="button"
            onClick={() => setMas(v => !v)}
            aria-expanded={mas}
            aria-controls={masId}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-3/30 px-4 py-3 text-left transition hover:border-gold/50 hover:bg-surface-3/60"
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold text-text">
              <Icono3D icon={SlidersHorizontal} tono="violet" size="sm" />
              Más filtros
              <span className="hidden text-xs font-normal text-text-muted sm:inline">Ambientes, cocheras, área, antigüedad, anunciante y fecha</span>
              {nAvanzados > 0 && <span className="badge badge-gold">{nAvanzados}</span>}
            </span>
            <ChevronDown className={cn('size-5 shrink-0 text-text-muted transition-transform duration-300', mas && 'rotate-180')} />
          </button>

          <div
            id={masId}
            inert={!mas}
            className={cn('grid transition-[grid-template-rows,opacity,margin] duration-500 ease-[var(--ease-out)]', mas ? 'mt-6 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0')}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-7 pb-1 pt-0.5">
                <Grupo icon={BedDouble} tono="violet" title="Ambientes y cocheras">
                  <div className={grid}>
                    <div className={col('xl:col-span-5')}>
                      <Segmented label="Dormitorios" value={filters.dormitorios} options={DORMITORIOS} onChange={dormitorios => update({ dormitorios })} />
                    </div>
                    <div className={col('xl:col-span-4')}>
                      <Segmented label="Baños" value={filters.banios} options={BANIOS} onChange={banios => update({ banios })} />
                    </div>
                    <div className={col('xl:col-span-3')}>
                      <Segmented label="Cocheras" value={filters.cocheras} options={COCHERAS} onChange={cocheras => update({ cocheras })} />
                    </div>
                  </div>
                </Grupo>

                <div className={cn('grid gap-7', !isMobileDrawer && 'xl:grid-cols-2')}>
                  <Grupo icon={Ruler} tono="blue" title="Área construida">
                    <div className={cn('grid gap-5', !isMobileDrawer && 'sm:grid-cols-2')}>
                      <div>
                        <label className="field-label" htmlFor="flt-area-min">Área mín. (m²)</label>
                        <input id="flt-area-min" type="number" min={0} inputMode="numeric" value={filters.areaMin} onChange={e => update({ areaMin: numero(e.target.value) })} placeholder="0" className="field mono" />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="flt-area-max">Área máx. (m²)</label>
                        <input id="flt-area-max" type="number" min={0} inputMode="numeric" value={filters.areaMax} onChange={e => update({ areaMax: numero(e.target.value) })} placeholder="Sin límite" className="field mono" />
                      </div>
                    </div>
                  </Grupo>

                  <Grupo icon={Hammer} tono="rose" title="Antigüedad (años)">
                    <Segmented
                      label="Máxima"
                      value={String(filters.antiguedadMax)}
                      options={ANTIGUEDADES}
                      onChange={v => update({ antiguedadMax: v === '' ? '' : Number(v) })}
                    />
                  </Grupo>
                </div>

                <div className={cn('grid gap-7', !isMobileDrawer && 'xl:grid-cols-2')}>
                  <Grupo icon={UserRound} tono="green" title="Anunciante">
                    <div>
                      <label className="field-label" htmlFor="flt-anunciante">Inmobiliaria o persona</label>
                      <input
                        id="flt-anunciante"
                        type="text"
                        list="flt-anunciantes"
                        value={filters.anunciante}
                        onChange={e => update({ anunciante: e.target.value })}
                        placeholder="Ej.: Prisma"
                        className="field"
                        maxLength={80}
                        autoComplete="off"
                      />
                      <datalist id="flt-anunciantes">
                        {(facetas?.anunciantes ?? []).map(a => <option key={a.valor} value={a.valor} />)}
                      </datalist>
                    </div>
                  </Grupo>

                  <Grupo icon={CalendarClock} tono="amber" title="Novedades">
                    <Segmented label="Publicado en el sistema" value={filters.publicado} options={PUBLICADOS} onChange={publicado => update({ publicado })} />
                  </Grupo>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pie: filtros activos y acciones */}
      <footer
        className={cn(
          'flex flex-wrap items-center justify-between gap-4',
          isMobileDrawer ? 'border-t border-line pt-5' : 'rounded-b-[1.5rem] border-t border-line bg-surface-1/60 px-5 py-4 sm:px-6'
        )}
      >
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2" aria-label="Filtros aplicados">
          {activos.length === 0 ? (
            <li className="text-sm text-text-muted">Sin filtros: se muestran todos los avisos.</li>
          ) : (
            activos.map(a => (
              <li key={a.clave}>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft py-1 pl-3 pr-1 text-xs font-medium text-text">
                  <span className="truncate">{a.etiqueta}</span>
                  <button
                    type="button"
                    onClick={() => quitar(a.quitar)}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-gold/25 hover:text-text"
                    aria-label={`Quitar filtro: ${a.etiqueta}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              </li>
            ))
          )}
        </ul>

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
