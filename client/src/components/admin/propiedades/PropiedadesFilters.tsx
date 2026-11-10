import { Bath, BedDouble, CalendarClock, ChevronDown, Hammer, MapPin, Ruler, Search, SlidersHorizontal, UserRound, X } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { Grupo, Segmented, Selector } from "@/components/filters/Campos"
import { Icono3D } from "@/components/portal/detail/Piezas"
import { useFacetas } from "@/hooks/useFacetas"
import { PORTALS } from "@/lib/portals"
import { cn } from "@/lib/utils"
import { claveNombre } from "@shared/ubicacion"
import { contarDetalle, type AdminSearchFilters } from "@/lib/propertiesApi"

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

  const [mas, setMas] = useState(false)
  const masId = useId()
  const facetas = useFacetas()
  const nDetalle = contarDetalle(filters)

  // Provincias del departamento elegido; tipos y anunciantes del catálogo (con respaldo si no hay datos).
  const provincias = useMemo(
    () => (facetas?.provincias ?? []).filter(p => !filters.departamento || !p.padre || claveNombre(p.padre) === claveNombre(filters.departamento)),
    [facetas, filters.departamento]
  )
  const inmuebles = facetas?.inmuebles?.length ? facetas.inmuebles : [{ valor: "Departamento" }, { valor: "Casa" }]
  const numero = (v: string): number | "" => (v === "" ? "" : Number(v))

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSearch()
      }}
      className="card space-y-6 p-5 sm:p-6"
      role="search"
      aria-label="Filtros de propiedades"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div className="xl:col-span-2">
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

      </div>

      {/* Desglose: ubicación y detalle (los mismos filtros del portal de clientes) */}
      <div>
        <button
          type="button"
          onClick={() => setMas(v => !v)}
          aria-expanded={mas}
          aria-controls={masId}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-3/30 px-4 py-3 text-left transition hover:border-gold/50 hover:bg-surface-3/60"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold text-text">
            <Icono3D icon={SlidersHorizontal} tono="violet" size="sm" />
            <span className="whitespace-nowrap">Más filtros</span>
            <span className="hidden text-xs font-normal text-text-muted sm:inline">Departamento, ciudad, tipo, ambientes, cocheras, área, antigüedad y anunciante</span>
            {nDetalle > 0 && <span className="badge badge-gold">{nDetalle}</span>}
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-text-muted transition-transform duration-300", mas && "rotate-180")} />
        </button>

        <div
          id={masId}
          inert={!mas}
          className={cn("grid transition-[grid-template-rows,opacity,margin] duration-500 ease-[var(--ease-out)]", mas ? "mt-6 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0")}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-7 pb-1 pt-0.5">
              <Grupo icon={MapPin} tono="blue" title="Ubicación y tipo">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <Selector id="adm-departamento" label="Departamento" value={filters.departamento} onChange={v => set({ departamento: v, provincia: "" })} opciones={facetas?.departamentos ?? []} vacio="Sin datos aún" />
                  <Selector id="adm-provincia" label="Ciudad o provincia" value={filters.provincia} onChange={v => set({ provincia: v })} opciones={provincias} vacio="Sin datos aún" />
                  <Selector id="adm-inmueble" label="Tipo de inmueble" value={filters.inmueble === "todos" ? "" : filters.inmueble} onChange={v => set({ inmueble: v || "todos" })} opciones={inmuebles} vacio="Todos" />
                  <div>
                    <label htmlFor="adm-texto" className="field-label">Palabra clave</label>
                    <input id="adm-texto" type="search" value={filters.texto} onChange={e => set({ texto: e.target.value })} placeholder="Ej.: terraza" className="field" maxLength={80} autoComplete="off" />
                  </div>
                </div>
              </Grupo>

              <Grupo icon={BedDouble} tono="violet" title="Ambientes y cocheras">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <Segmented label="Dormitorios" value={filters.dormitorios} options={[{ value: "todos", label: "Todos" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4+", label: "4+" }]} onChange={dormitorios => set({ dormitorios })} />
                  <Segmented label="Baños" value={filters.banios} options={[{ value: "todos", label: "Todos" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3+", label: "3+" }]} onChange={banios => set({ banios })} />
                  <Segmented label="Cocheras" value={filters.cocheras} options={[{ value: "todos", label: "Todas" }, { value: "1+", label: "1+" }, { value: "2+", label: "2+" }, { value: "3+", label: "3+" }]} onChange={cocheras => set({ cocheras })} />
                </div>
              </Grupo>

              <div className="grid gap-7 xl:grid-cols-2">
                <Grupo icon={Ruler} tono="green" title="Área construida">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="adm-area-min" className="field-label">Área mín. (m²)</label>
                      <input id="adm-area-min" type="number" min={0} inputMode="numeric" value={filters.areaMin} onChange={e => set({ areaMin: numero(e.target.value) })} placeholder="0" className="field mono" />
                    </div>
                    <div>
                      <label htmlFor="adm-area-max" className="field-label">Área máx. (m²)</label>
                      <input id="adm-area-max" type="number" min={0} inputMode="numeric" value={filters.areaMax} onChange={e => set({ areaMax: numero(e.target.value) })} placeholder="Sin límite" className="field mono" />
                    </div>
                  </div>
                </Grupo>

                <Grupo icon={Hammer} tono="rose" title="Antigüedad (años)">
                  <Segmented
                    label="Máxima"
                    value={String(filters.antiguedadMax)}
                    options={[{ value: "", label: "Cualquiera" }, { value: "0", label: "Estreno" }, { value: "5", label: "Hasta 5" }, { value: "10", label: "Hasta 10" }, { value: "20", label: "Hasta 20" }]}
                    onChange={v => set({ antiguedadMax: v === "" ? "" : Number(v) })}
                  />
                </Grupo>
              </div>

              <div className="grid gap-7 xl:grid-cols-2">
                <Grupo icon={UserRound} tono="amber" title="Anunciante">
                  <div>
                    <label htmlFor="adm-anunciante" className="field-label">Inmobiliaria o persona</label>
                    <input id="adm-anunciante" type="text" list="adm-anunciantes" value={filters.anunciante} onChange={e => set({ anunciante: e.target.value })} placeholder="Ej.: Prisma" className="field" maxLength={80} autoComplete="off" />
                    <datalist id="adm-anunciantes">
                      {(facetas?.anunciantes ?? []).map(a => <option key={a.valor} value={a.valor} />)}
                    </datalist>
                  </div>
                </Grupo>

                <Grupo icon={CalendarClock} tono="teal" title="Novedades y precio">
                  <div className="space-y-4">
                    <Segmented label="Publicado en el sistema" value={filters.publicado} options={[{ value: "todos", label: "Cualquiera" }, { value: "hoy", label: "Hoy" }, { value: "semana", label: "7 días" }, { value: "mes", label: "30 días" }]} onChange={publicado => set({ publicado })} />
                    <label className="flex w-fit cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-3/40 px-4 py-2.5 text-sm text-text transition hover:border-gold/40">
                      <input type="checkbox" checked={filters.soloConPrecio} onChange={e => set({ soloConPrecio: e.target.checked })} className="size-4 cursor-pointer accent-gold" />
                      Solo avisos con precio publicado
                    </label>
                  </div>
                </Grupo>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-xs text-text-muted">
          El rango de precio se interpreta en {filters.moneda === 'PEN' ? 'soles' : 'dólares'} y no oculta avisos publicados en la otra moneda.
        </p>
        <div className="flex gap-2.5">
          <button type="button" onClick={onClear} className="btn btn-secondary" title="Limpiar filtros" aria-label="Limpiar filtros">
            <X className="size-4" />
            Limpiar
          </button>
          <button type="submit" className="btn btn-primary">
            <Search className="size-4" />
            Buscar
          </button>
        </div>
      </div>
    </form>
  )
}
