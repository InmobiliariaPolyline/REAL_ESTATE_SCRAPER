import { Search, X } from 'lucide-react'
import { useState, useCallback } from 'react'

interface PortalFiltersProps {
  onFilterChange: (filters: FilterState) => void
  onSearch: () => void
  onClear: () => void
}

export interface FilterState {
  distrito: string
  operacion: 'todos' | 'ALQUILER' | 'VENTA'
  inmueble: 'todos' | 'Departamento' | 'Casa'
  portales: string[]
  moneda: 'PEN' | 'USD'
  precioMin: number | ''
  precioMax: number | ''
  dormitorios: 'todos' | '1' | '2' | '3' | '4+'
}

const PORTALES_OPCIONES = ['Properati', 'Infocasas', 'Babilonia', 'Urbania', 'Adondevivir']

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
  onFilterChange,
  onSearch,
  onClear,
}: PortalFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    distrito: '',
    operacion: 'todos',
    inmueble: 'todos',
    portales: [],
    moneda: 'PEN',
    precioMin: '',
    precioMax: '',
    dormitorios: 'todos',
  })

  const [showPortalDropdown, setShowPortalDropdown] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleDistritoChange = useCallback(
    (value: string) => {
      const newFilters = { ...filters, distrito: value }
      setFilters(newFilters)
      onFilterChange(newFilters)
    },
    [filters, onFilterChange]
  )

  const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  }

  const suggestions = filters.distrito.trim() === ''
    ? []
    : PRINCIPALES_DISTRITOS.filter(dist =>
        removeAccents(dist.toLowerCase()).includes(removeAccents(filters.distrito.toLowerCase()))
      )

  const handleOperacionChange = (op: FilterState['operacion']) => {
    const newFilters = { ...filters, operacion: op }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleInmuebleChange = (inm: FilterState['inmueble']) => {
    const newFilters = { ...filters, inmueble: inm }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handlePortalToggle = (portal: string) => {
    const newPortales = filters.portales.includes(portal)
      ? filters.portales.filter((p) => p !== portal)
      : [...filters.portales, portal]
    const newFilters = { ...filters, portales: newPortales }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleMonedaChange = (moneda: 'PEN' | 'USD') => {
    const newFilters = { ...filters, moneda }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handlePrecioChange = (field: 'precioMin' | 'precioMax', value: string) => {
    const numValue = value === '' ? '' : Number(value)
    const newFilters = { ...filters, [field]: numValue }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleDormitoriosChange = (dorm: FilterState['dormitorios']) => {
    const newFilters = { ...filters, dormitorios: dorm }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleClear = () => {
    const clearedFilters: FilterState = {
      distrito: '',
      operacion: 'todos',
      inmueble: 'todos',
      portales: [],
      moneda: 'PEN',
      precioMin: '',
      precioMax: '',
      dormitorios: 'todos',
    }
    setFilters(clearedFilters)
    onFilterChange(clearedFilters)
    onClear()
  }

  return (
    <div
      className="sticky top-16 px-6 py-4 space-y-4"
      style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid #2A2A2A' }}
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
              style={{ fontSize: '0.875rem' }}
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
                    className="w-full text-left px-3 py-2 hover:bg-black/30 text-sm transition"
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
                className="px-3 py-1 rounded text-xs font-medium transition"
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
                className="px-3 py-1 rounded text-xs font-medium transition"
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
            className="w-full px-3 py-2 rounded text-xs text-left"
            style={{
              backgroundColor: '#252525',
              color: '#F0EDE8',
              border: '1px solid #2A2A2A',
              fontFamily: 'DM Sans',
            }}
          >
            {filters.portales.length === 0
              ? 'Seleccionar...'
              : `${filters.portales.length} seleccionado(s)`}
          </button>
          {showPortalDropdown && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded shadow-lg z-10"
              style={{ backgroundColor: '#252525', border: '1px solid #2A2A2A' }}
            >
              {PORTALES_OPCIONES.map((portal) => (
                <label
                  key={portal}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-black/30 cursor-pointer"
                  style={{ fontFamily: 'DM Sans', fontSize: '0.875rem' }}
                >
                  <input
                    type="checkbox"
                    checked={filters.portales.includes(portal)}
                    onChange={() => handlePortalToggle(portal)}
                    style={{ accentColor: '#C9A96E' }}
                  />
                  {portal}
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
                className="flex-1 px-2 py-1 rounded text-xs font-medium transition"
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
            style={{ fontSize: '0.875rem' }}
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
            style={{ fontSize: '0.875rem' }}
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
                className="flex-1 px-2 py-1 rounded text-xs font-medium transition"
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
        <div className="flex items-end gap-2">
          <button
            onClick={onSearch}
            className="flex-1 px-4 py-2 rounded font-medium transition"
            style={{
              backgroundColor: '#C9A96E',
              color: '#0F0F0F',
              fontFamily: 'DM Sans',
              fontSize: '0.875rem',
            }}
          >
            Buscar
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded transition"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #2A2A2A',
              color: '#6B6B6B',
              fontFamily: 'DM Sans',
              fontSize: '0.875rem',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
