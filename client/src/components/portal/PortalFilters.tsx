import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { PORTALS } from "@/lib/portals"
import { cn } from "@/lib/utils"
import { DEFAULT_FILTERS, type FilterState } from "@/types"

export type { FilterState }

interface PortalFiltersProps {
  /** Filtros actuales (el estado vive en el padre, así escritorio y móvil comparten valores). */
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  /** Se llama al pulsar "Buscar". */
  onSearch: () => void
  /** Se llama al pulsar limpiar, con los filtros ya restablecidos. */
  onClear: (cleared: FilterState) => void
  isMobileDrawer?: boolean
}

const PORTALES_OPCIONES = PORTALS.map(p => p.label)

const PRINCIPALES_DISTRITOS = [
  'Ancón', 'Ate', 'Barranco', 'Bellavista', 'Breña', 'Callao', 'Carabayllo',
  'Carmen de la Legua', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas',
  'El Agustino', 'Independencia', 'Jesús María', 'La Molina', 'La Perla',
  'La Punta', 'La Victoria', 'Lima', 'Lince', 'Los Olivos', 'Lurigancho',
  'Lurín', 'Magdalena del Mar', 'Mi Perú', 'Miraflores', 'Pachacámac',
  'Pucusana', 'Pueblo Libre', 'Puente Piedra', 'Punta Hermosa', 'Punta Negra',
  'Rímac', 'San Bartolo', 'San Borja', 'San Isidro', 'San Juan de Lurigancho',
  'San Juan de Miraflores', 'San Luis', 'San Martín de Porres', 'San Miguel',
  'Santa Anita', 'Santa María del Mar', 'Santa Rosa', 'Santiago de Surco',
  'Surquillo', 'Ventanilla', 'Villa El Salvador', 'Villa María del Triunfo',
  'Arequipa', 'Cayma', 'Cerro Colorado', 'Trujillo', 'Víctor Larco Herrera',
  'Chiclayo', 'Cusco', 'Piura', 'Tarapoto', 'Chimbote', 'Huancayo',
  'Iquitos', 'Pucallpa', 'Tacna'
].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

const OPERACIONES: { value: FilterState['operacion']; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ALQUILER', label: 'Alquiler' },
  { value: 'VENTA', label: 'Venta' },
]

const TIPOS: { value: FilterState['inmueble']; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Departamento', label: 'Depto.' },
  { value: 'Casa', label: 'Casa' },
]

const DORMITORIOS: { value: FilterState['dormitorios']; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4+', label: '4+' },
]

const removeAccents = (str: string) =>
  str.normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Grupo de opciones excluyentes con estilo segmentado. */
function Segmented<T extends string>({
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
  return (
    <div>
      <span className="field-label" id={`seg-${label}`}>{label}</span>
      <div className="segmented" role="group" aria-labelledby={`seg-${label}`}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className="segmented-option"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PortalFilters({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  isMobileDrawer = false,
}: PortalFiltersProps) {
  const [showPortalDropdown, setShowPortalDropdown] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const portalRef = useRef<HTMLDivElement>(null)

  const update = (patch: Partial<FilterState>) =>
    onFiltersChange({ ...filters, ...patch })

  // Cierra el selector de portales al hacer clic fuera.
  useEffect(() => {
    if (!showPortalDropdown) return
    const onDown = (e: MouseEvent) => {
      if (!portalRef.current?.contains(e.target as Node)) setShowPortalDropdown(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showPortalDropdown])

  const suggestions =
    filters.distrito.trim() === ""
      ? []
      : PRINCIPALES_DISTRITOS.filter(dist =>
          removeAccents(dist.toLowerCase()).includes(
            removeAccents(filters.distrito.toLowerCase())
          )
        )

  const handlePortalToggle = (portal: string) =>
    update({
      portales: filters.portales.includes(portal)
        ? filters.portales.filter(p => p !== portal)
        : [...filters.portales, portal],
    })

  const handlePrecioChange = (field: "precioMin" | "precioMax", value: string) =>
    update({ [field]: value === "" ? "" : Number(value) })

  const handleClear = () => {
    const cleared: FilterState = { ...DEFAULT_FILTERS, portales: [] }
    onFiltersChange(cleared)
    onClear(cleared)
  }

  const currency = filters.moneda === 'PEN' ? 'S/' : 'USD'

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSearch()
      }}
      className={cn(
        isMobileDrawer ? 'space-y-5 p-5' : 'card space-y-5 p-5 sm:p-6'
      )}
      role="search"
      aria-label="Filtros de propiedades"
    >
      {!isMobileDrawer && (
        <div className="flex items-center gap-2 text-sm font-semibold text-text">
          <SlidersHorizontal className="size-4 text-gold" />
          Filtros
        </div>
      )}

      <div className={cn('grid gap-4', isMobileDrawer ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-4')}>
        {/* Distrito */}
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
              {suggestions.map(dist => (
                <li key={dist}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      update({ distrito: dist })
                      setShowSuggestions(false)
                    }}
                    className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-text transition hover:bg-surface-3"
                  >
                    {dist}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Segmented
          label="Operación"
          value={filters.operacion}
          options={OPERACIONES}
          onChange={operacion => update({ operacion })}
        />

        <Segmented
          label="Tipo"
          value={filters.inmueble}
          options={TIPOS}
          onChange={inmueble => update({ inmueble })}
        />

        {/* Portales */}
        <div className="relative" ref={portalRef}>
          <span className="field-label" id="flt-portal-label">Portal</span>
          <button
            type="button"
            onClick={() => setShowPortalDropdown(!showPortalDropdown)}
            aria-haspopup="listbox"
            aria-expanded={showPortalDropdown}
            aria-labelledby="flt-portal-label"
            className="field flex items-center justify-between text-left"
          >
            <span className={filters.portales.length === 0 ? 'text-text-faint' : ''}>
              {filters.portales.length === 0
                ? 'Todos los portales'
                : `${filters.portales.length} seleccionado(s)`}
            </span>
            <ChevronDown
              className={cn('size-4 text-text-muted transition', showPortalDropdown && 'rotate-180')}
            />
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

      <div className={cn('grid items-end gap-4', isMobileDrawer ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr_auto]')}>
        <Segmented
          label="Moneda"
          value={filters.moneda}
          options={[
            { value: 'PEN', label: 'Soles' },
            { value: 'USD', label: 'Dólares' },
          ]}
          onChange={moneda => update({ moneda })}
        />

        <div>
          <label className="field-label" htmlFor="flt-min">Precio mín. ({currency})</label>
          <input
            id="flt-min"
            type="number"
            min={0}
            inputMode="numeric"
            value={filters.precioMin}
            onChange={e => handlePrecioChange('precioMin', e.target.value)}
            placeholder="0"
            className="field mono"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="flt-max">Precio máx. ({currency})</label>
          <input
            id="flt-max"
            type="number"
            min={0}
            inputMode="numeric"
            value={filters.precioMax}
            onChange={e => handlePrecioChange('precioMax', e.target.value)}
            placeholder="Sin límite"
            className="field mono"
          />
        </div>

        <Segmented
          label="Dormitorios"
          value={filters.dormitorios}
          options={DORMITORIOS}
          onChange={dormitorios => update({ dormitorios })}
        />

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1 xl:flex-none">
            <Search className="size-4" />
            Buscar
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="btn btn-secondary btn-icon"
            aria-label="Limpiar filtros"
            title="Limpiar filtros"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </form>
  )
}
