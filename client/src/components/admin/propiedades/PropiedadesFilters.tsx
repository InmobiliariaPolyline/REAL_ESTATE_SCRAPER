import { Search, X } from "lucide-react"
import { PORTALS } from "@/lib/portals"
import type { AdminSearchFilters } from "@/lib/propertiesApi"

interface PropiedadesFiltersProps {
  filters: AdminSearchFilters
  onChange: (filters: AdminSearchFilters) => void
  onSearch: () => void
  onClear: () => void
}

/** Formulario de filtros de la pestaña "Buscar" del panel admin. */
export default function PropiedadesFilters({
  filters,
  onChange,
  onSearch,
  onClear,
}: PropiedadesFiltersProps) {
  const set = (patch: Partial<AdminSearchFilters>) => onChange({ ...filters, ...patch })

  // Los precios escritos pertenecen a la moneda anterior: se limpian para no
  // interpretar un rango en otra moneda por accidente.
  const handleCambioMoneda = (moneda: "USD" | "PEN") =>
    set({ moneda, precioMin: "", precioMax: "" })

  const monedaLabel = filters.moneda === "PEN" ? "S/" : "USD"

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSearch()
      }}
      className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_auto]"
      role="search"
      aria-label="Filtros de propiedades"
    >
      <div>
        <label htmlFor="adm-distrito" className="field-label">Distrito</label>
        <div className="field-icon">
          <Search className="size-4" />
          <input
            id="adm-distrito"
            type="text"
            value={filters.distrito}
            onChange={e => set({ distrito: e.target.value })}
            placeholder="Buscar distrito..."
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="adm-operacion" className="field-label">Operación</label>
        <select
          id="adm-operacion"
          value={filters.operacion}
          onChange={e => set({ operacion: e.target.value })}
          className="field"
        >
          <option value="todos">Todas</option>
          <option value="ALQUILER">Alquiler</option>
          <option value="VENTA">Venta</option>
        </select>
      </div>

      <div>
        <label htmlFor="adm-portal" className="field-label">Portal</label>
        <select
          id="adm-portal"
          value={filters.portal}
          onChange={e => set({ portal: e.target.value })}
          className="field"
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
        <label htmlFor="adm-moneda" className="field-label">Moneda</label>
        <select
          id="adm-moneda"
          value={filters.moneda ?? "USD"}
          onChange={e => handleCambioMoneda(e.target.value as "USD" | "PEN")}
          className="field"
        >
          <option value="USD">Dólares (USD)</option>
          <option value="PEN">Soles (S/)</option>
        </select>
      </div>

      <div>
        <label htmlFor="adm-min" className="field-label">Precio mín. ({monedaLabel})</label>
        <input
          id="adm-min"
          type="number"
          min={0}
          value={filters.precioMin}
          onChange={e => set({ precioMin: e.target.value })}
          placeholder="0"
          className="field mono"
        />
      </div>

      <div>
        <label htmlFor="adm-max" className="field-label">Precio máx. ({monedaLabel})</label>
        <input
          id="adm-max"
          type="number"
          min={0}
          value={filters.precioMax}
          onChange={e => set({ precioMax: e.target.value })}
          placeholder="Sin límite"
          className="field mono"
        />
      </div>

      <div className="flex items-end gap-2">
        <button type="submit" className="btn btn-primary flex-1">
          <Search className="size-4" />
          Buscar
        </button>
        <button
          type="button"
          onClick={onClear}
          className="btn btn-secondary btn-icon"
          title="Limpiar filtros"
          aria-label="Limpiar filtros"
        >
          <X className="size-4" />
        </button>
      </div>
    </form>
  )
}
