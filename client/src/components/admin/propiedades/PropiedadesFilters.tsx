import { PORTALS } from "@/lib/portals"
import type { AdminSearchFilters } from "@/lib/propertiesApi"

interface PropiedadesFiltersProps {
  filters: AdminSearchFilters
  onChange: (filters: AdminSearchFilters) => void
  onSearch: () => void
  onClear: () => void
}

const labelStyle = {
  color: "#C9A96E",
  fontFamily: "DM Sans",
} as const

const selectStyle = {
  backgroundColor: "#252525",
  color: "#F0EDE8",
  border: "1px solid #2A2A2A",
  fontFamily: "DM Sans",
  height: "38px",
} as const

/** Formulario de filtros de la pestaña "Buscar propiedades" del panel admin. */
export default function PropiedadesFilters({
  filters,
  onChange,
  onSearch,
  onClear,
}: PropiedadesFiltersProps) {
  const set = (patch: Partial<AdminSearchFilters>) =>
    onChange({ ...filters, ...patch })

  // Los precios escritos pertenecen a la moneda anterior: se limpian para no
  // interpretar un rango en otra moneda por accidente.
  const handleCambioMoneda = (moneda: "USD" | "PEN") =>
    set({ moneda, precioMin: "", precioMax: "" })

  const monedaLabel = filters.moneda === "PEN" ? "S/" : "USD"

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 p-4 rounded"
      style={{ backgroundColor: "#111111", border: "1px solid #2A2A2A" }}
    >
      <div>
        <label className="block text-xs font-semibold mb-2" style={labelStyle}>
          Distrito
        </label>
        <input
          type="text"
          value={filters.distrito}
          onChange={e => set({ distrito: e.target.value })}
          onKeyDown={e => e.key === "Enter" && onSearch()}
          placeholder="Buscar distrito..."
          className="input-underline w-full text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-2" style={labelStyle}>
          Operación
        </label>
        <select
          value={filters.operacion}
          onChange={e => set({ operacion: e.target.value })}
          className="w-full px-3 py-2 rounded text-xs"
          style={selectStyle}
        >
          <option value="todos">Todos</option>
          <option value="ALQUILER">Alquiler</option>
          <option value="VENTA">Venta</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-2" style={labelStyle}>
          Portal
        </label>
        <select
          value={filters.portal}
          onChange={e => set({ portal: e.target.value })}
          className="w-full px-3 py-2 rounded text-xs"
          style={selectStyle}
        >
          <option value="todos">Todos</option>
          {PORTALS.map(portal => (
            <option key={portal.key} value={portal.label}>
              {portal.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-2" style={labelStyle}>
          Moneda
        </label>
        <select
          value={filters.moneda ?? "USD"}
          onChange={e => handleCambioMoneda(e.target.value as "USD" | "PEN")}
          className="w-full px-3 py-2 rounded text-xs"
          style={selectStyle}
        >
          <option value="USD">USD ($)</option>
          <option value="PEN">Soles (S/)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-2" style={labelStyle}>
          Precio mín. ({monedaLabel})
        </label>
        <input
          type="number"
          min={0}
          value={filters.precioMin}
          onChange={e => set({ precioMin: e.target.value })}
          onKeyDown={e => e.key === "Enter" && onSearch()}
          placeholder="0"
          className="input-underline w-full text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-2" style={labelStyle}>
          Precio máx. ({monedaLabel})
        </label>
        <input
          type="number"
          min={0}
          value={filters.precioMax}
          onChange={e => set({ precioMax: e.target.value })}
          onKeyDown={e => e.key === "Enter" && onSearch()}
          placeholder="Sin límite"
          className="input-underline w-full text-sm"
        />
      </div>

      <div className="flex items-end gap-2">
        <button
          onClick={onSearch}
          className="flex-1 px-4 py-2 rounded font-medium transition"
          style={{
            backgroundColor: "#C9A96E",
            color: "#0F0F0F",
            fontFamily: "DM Sans",
            fontSize: "0.875rem",
            height: "38px",
          }}
        >
          Buscar
        </button>

        <button
          onClick={onClear}
          className="px-3 py-2 rounded transition flex items-center justify-center"
          style={{
            backgroundColor: "transparent",
            border: "1px solid #2A2A2A",
            color: "#6B6B6B",
            fontFamily: "DM Sans",
            height: "38px",
            width: "38px",
          }}
          title="Limpiar filtros"
          aria-label="Limpiar filtros"
        >
          X
        </button>
      </div>
    </div>
  )
}
