import { Search, X } from "lucide-react"
import { useState } from "react"
import { PORTALS } from "@/lib/portals"
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

export default function PortalFilters({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  isMobileDrawer = false,
}: PortalFiltersProps) {
  const [showPortalDropdown, setShowPortalDropdown] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const update = (patch: Partial<FilterState>) =>
    onFiltersChange({ ...filters, ...patch })

  const handleDistritoChange = (value: string) => update({ distrito: value })

  const removeAccents = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const suggestions =
    filters.distrito.trim() === ""
      ? []
      : PRINCIPALES_DISTRITOS.filter(dist =>
          removeAccents(dist.toLowerCase()).includes(
            removeAccents(filters.distrito.toLowerCase())
          )
        )

  const handleOperacionChange = (operacion: FilterState["operacion"]) =>
    update({ operacion })

  const handleInmuebleChange = (inmueble: FilterState["inmueble"]) =>
    update({ inmueble })

  const handlePortalToggle = (portal: string) =>
    update({
      portales: filters.portales.includes(portal)
        ? filters.portales.filter(p => p !== portal)
        : [...filters.portales, portal],
    })

  const handleMonedaChange = (moneda: FilterState["moneda"]) => update({ moneda })

  const handlePrecioChange = (
    field: "precioMin" | "precioMax",
    value: string
  ) => update({ [field]: value === "" ? "" : Number(value) })

  const handleDormitoriosChange = (dormitorios: FilterState["dormitorios"]) =>
    update({ dormitorios })

  const handleClear = () => {
    const cleared: FilterState = { ...DEFAULT_FILTERS, portales: [] }
    onFiltersChange(cleared)
    onClear(cleared)
  }

  return (
    <div
      className={isMobileDrawer ? "px-6 py-6 space-y-6" : "sticky top-16 px-6 py-4 space-y-4"}
      style={isMobileDrawer ? { backgroundColor: 'transparent' } : { backgroundColor: '#1A1A1A', borderBottom: '1px solid #2A2A2A' }}
    >
      {/* Fila 1: Distrito + Operación + Inmueble */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Distrito */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}
          >
            Distrito
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              style={{ color: '#6B6B6B' }}
            />
            <input
              type="text"
              value={filters.distrito}
              onChange={(e) => {
                handleDistritoChange(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200)
              }}
              placeholder="Buscar distrito..."
              className="input-underline w-full pl-8"
              style={{ fontSize: '1rem', height: '44px', padding: '8px 0 8px 32px' }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded shadow-lg z-20 border"
                style={{
                  backgroundColor: '#252525',
                  borderColor: '#2A2A2A',
                  fontFamily: 'DM Sans',
                }}
              >
                {suggestions.map((dist) => (
                  <button
                    key={dist}
                    type="button"
                    onClick={() => {
                      handleDistritoChange(dist)
                      setShowSuggestions(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-black/30 text-sm transition min-h-[44px] flex items-center"
                    style={{ color: '#F0EDE8' }}
                  >
                    {dist}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Operación */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}
          >
            Operación
          </label>
          <div className="flex gap-2">
            {['todos', 'ALQUILER', 'VENTA'].map((op) => (
              <button
                key={op}
                onClick={() =>
                  handleOperacionChange(op as FilterState['operacion'])
                }
                className="px-4 py-2.5 rounded text-sm font-medium transition min-h-[44px] flex-1 flex items-center justify-center"
                style={{
                  backgroundColor:
                    filters.operacion === op ? '#C9A96E' : 'transparent',
                  color: filters.operacion === op ? '#0F0F0F' : '#6B6B6B',
                  border: '1px solid #2A2A2A',
                  fontFamily: 'DM Sans',
                }}
              >
                {op === 'todos' ? 'Todos' : op}
              </button>
            ))}
          </div>
        </div>

        {/* Inmueble */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}
          >
            Tipo
          </label>
          <div className="flex gap-2">
            {['todos', 'Departamento', 'Casa'].map((inm) => (
              <button
                key={inm}
                onClick={() =>
                  handleInmuebleChange(inm as FilterState['inmueble'])
                }
                className="px-4 py-2.5 rounded text-sm font-medium transition min-h-[44px] flex-1 flex items-center justify-center"
                style={{
                  backgroundColor:
                    filters.inmueble === inm ? '#C9A96E' : 'transparent',
                  color: filters.inmueble === inm ? '#0F0F0F' : '#6B6B6B',
                  border: '1px solid #2A2A2A',
                  fontFamily: 'DM Sans',
                }}
              >
                {inm === 'todos' ? 'Todos' : inm}
              </button>
            ))}
          </div>
        </div>

        {/* Portal Multi-select */}
        <div className="relative">
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}
          >
            Portal
          </label>
          <button
            onClick={() => setShowPortalDropdown(!showPortalDropdown)}
            className="w-full px-3 py-2.5 rounded text-sm text-left min-h-[44px] flex items-center justify-between"
            style={{
              backgroundColor: '#252525',
              color: '#F0EDE8',
              border: '1px solid #2A2A2A',
              fontFamily: 'DM Sans',
            }}
          >
            <span>
              {filters.portales.length === 0
                ? 'Seleccionar...'
                : `${filters.portales.length} seleccionado(s)`}
            </span>
            <span className="text-xs text-[#6B6B6B]">{showPortalDropdown ? '▲' : '▼'}</span>
          </button>
          {showPortalDropdown && (
            <div
              className={isMobileDrawer ? "mt-2 rounded z-50 w-full" : "absolute top-full left-0 right-0 mt-1 rounded shadow-lg z-50"}
              style={{ backgroundColor: '#252525', border: '1px solid #2A2A2A' }}
            >
              {PORTALES_OPCIONES.map((portal) => (
                <label
                  key={portal}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-black/30 cursor-pointer min-h-[44px]"
                  style={{ fontFamily: 'DM Sans', fontSize: '0.875rem' }}
                >
                  <input
                    type="checkbox"
                    checked={filters.portales.includes(portal)}
                    onChange={() => handlePortalToggle(portal)}
                    className="w-5 h-5 cursor-pointer accent-[#C9A96E]"
                  />
                  <span>{portal}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fila 2: Moneda + Precio + Dormitorios */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Moneda */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}
          >
            Moneda
          </label>
          <div className="flex gap-2">
            {['PEN', 'USD'].map((mon) => (
              <button
                key={mon}
                onClick={() => handleMonedaChange(mon as 'PEN' | 'USD')}
                className="flex-1 px-3 py-2.5 rounded text-sm font-medium transition min-h-[44px] flex items-center justify-center"
                style={{
                  backgroundColor:
                    filters.moneda === mon ? '#C9A96E' : 'transparent',
                  color: filters.moneda === mon ? '#0F0F0F' : '#6B6B6B',
                  border: '1px solid #2A2A2A',
                  fontFamily: 'DM Sans',
                }}
              >
                {mon}
              </button>
            ))}
          </div>
        </div>

        {/* Precio Mín */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}
          >
            Precio Mín
          </label>
          <input
            type="number"
            value={filters.precioMin}
            onChange={(e) => handlePrecioChange('precioMin', e.target.value)}
            placeholder="0"
            className="input-underline w-full"
            style={{ fontSize: '1rem', height: '44px', padding: '8px 0' }}
          />
        </div>

        {/* Precio Máx */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}
          >
            Precio Máx
          </label>
          <input
            type="number"
            value={filters.precioMax}
            onChange={(e) => handlePrecioChange('precioMax', e.target.value)}
            placeholder="∞"
            className="input-underline w-full"
            style={{ fontSize: '1rem', height: '44px', padding: '8px 0' }}
          />
        </div>

        {/* Dormitorios */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}
          >
            Dormitorios
          </label>
          <div className="flex gap-1">
            {['todos', '1', '2', '3', '4+'].map((dorm) => (
              <button
                key={dorm}
                onClick={() =>
                  handleDormitoriosChange(dorm as FilterState['dormitorios'])
                }
                className="flex-1 px-2 py-2.5 rounded text-sm font-medium transition min-h-[44px] flex items-center justify-center"
                style={{
                  backgroundColor:
                    filters.dormitorios === dorm ? '#C9A96E' : 'transparent',
                  color: filters.dormitorios === dorm ? '#0F0F0F' : '#6B6B6B',
                  border: '1px solid #2A2A2A',
                  fontFamily: 'DM Sans',
                }}
              >
                {dorm === 'todos' ? 'T' : dorm}
              </button>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-end gap-2 w-full pt-2 md:pt-0">
          <button
            onClick={onSearch}
            className="flex-grow h-11 rounded font-semibold transition hover:opacity-90 flex items-center justify-center"
            style={{
              backgroundColor: '#C9A96E',
              color: '#0F0F0F',
              fontFamily: 'DM Sans',
              fontSize: '0.9rem',
            }}
          >
            Buscar
          </button>
          <button
            onClick={handleClear}
            className="px-4 h-11 rounded transition hover:bg-white/5 flex items-center justify-center"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #2A2A2A',
              color: '#6B6B6B',
              fontFamily: 'DM Sans',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
