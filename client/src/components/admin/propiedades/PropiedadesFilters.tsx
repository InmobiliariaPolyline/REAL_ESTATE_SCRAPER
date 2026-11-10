import { Bath, BedDouble, Building2, CalendarClock, Car, CircleDollarSign, Hammer, Home, KeyRound, Layers, MapPin, Ruler, Search, SlidersHorizontal, Store, Tag, TextCursorInput, Trees, UserRound, X, type LucideIcon } from "lucide-react"
import { useMemo } from "react"
import { Bloque, Fichas, Selector, type OpcionFicha } from "@/components/filters/Campos"
import { Icono3D } from "@/components/portal/detail/Piezas"
import { useFacetas } from "@/hooks/useFacetas"
import { PORTALS } from "@/lib/portals"
import { contarDetalle, type AdminSearchFilters } from "@/lib/propertiesApi"
import { claveNombre } from "@shared/ubicacion"

interface PropiedadesFiltersProps {
  filters: AdminSearchFilters
  onChange: (filters: AdminSearchFilters) => void
  onSearch: () => void
  onClear: () => void
}

const ICONO_TIPO: Record<string, LucideIcon> = {
  departamento: Building2,
  casa: Home,
  terreno: Trees,
  "local comercial": Store,
}

const numero = (v: string): number | "" => (v === "" ? "" : Number(v))

/** Ventana de filtros de la pestaña "Buscar" del panel admin: todos los filtros a la vista, en bloques. */
export default function PropiedadesFilters({ filters, onChange, onSearch, onClear }: PropiedadesFiltersProps) {
  const set = (patch: Partial<AdminSearchFilters>) => onChange({ ...filters, ...patch })

  // Los precios escritos pertenecen a la moneda anterior: se limpian para no
  // interpretar un rango en otra moneda por accidente.
  const handleCambioMoneda = (moneda: "USD" | "PEN") => set({ moneda, precioMin: "", precioMax: "" })

  const monedaLabel = filters.moneda === "PEN" ? "S/" : "USD"
  const facetas = useFacetas()
  const nDetalle = contarDetalle(filters)

  const provincias = useMemo(
    () => (facetas?.provincias ?? []).filter(p => !filters.departamento || !p.padre || claveNombre(p.padre) === claveNombre(filters.departamento)),
    [facetas, filters.departamento]
  )
  const tipos: OpcionFicha<string>[] = useMemo(() => {
    const base = facetas?.inmuebles?.length ? facetas.inmuebles.slice(0, 5) : [{ valor: "Departamento", n: undefined }, { valor: "Casa", n: undefined }]
    return [{ value: "todos", label: "Todos", icon: Layers }, ...base.map(t => ({ value: t.valor, label: t.valor, icon: ICONO_TIPO[t.valor.toLowerCase()] ?? Building2, n: t.n }))]
  }, [facetas])
  const tiposConActual = filters.inmueble !== "todos" && !tipos.some(t => t.value === filters.inmueble) ? [...tipos, { value: filters.inmueble, label: filters.inmueble, icon: Building2 }] : tipos

  return (
    <form onSubmit={e => { e.preventDefault(); onSearch() }} className="card overflow-hidden" role="search" aria-label="Filtros de propiedades">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Icono3D icon={SlidersHorizontal} tono="gold" size="sm" />
          <h2 className="text-base font-semibold text-text">Filtros</h2>
          {nDetalle > 0 && <span className="badge badge-gold">{nDetalle} de detalle</span>}
        </div>
        <button type="button" onClick={onClear} className="btn btn-ghost btn-sm" title="Limpiar filtros" aria-label="Limpiar filtros">
          <X className="size-4" />
          Limpiar todo
        </button>
      </header>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
        <Bloque icon={TextCursorInput} tono="rose" title="Buscar">
          <div className="grid gap-4">
            <div>
              <label htmlFor="adm-texto" className="field-label">Palabra clave</label>
              <input id="adm-texto" type="search" value={filters.texto} onChange={e => set({ texto: e.target.value })} placeholder="Ej.: terraza" className="field" maxLength={80} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="adm-distrito" className="field-label">Distrito</label>
              <div className="field-icon">
                <Search className="size-4" />
                <input id="adm-distrito" type="text" value={filters.distrito} onChange={e => set({ distrito: e.target.value })} placeholder="Buscar distrito..." className="field" />
              </div>
            </div>
          </div>
        </Bloque>

        <Bloque icon={KeyRound} tono="gold" title="Operación y portal">
          <div className="grid gap-4">
            <Fichas
              label="Operación"
              columnas={3}
              value={filters.operacion as "todos" | "ALQUILER" | "VENTA"}
              onChange={operacion => set({ operacion })}
              options={[{ value: "todos", label: "Todas", icon: Layers }, { value: "ALQUILER", label: "Alquiler", icon: KeyRound }, { value: "VENTA", label: "Venta", icon: Tag }]}
            />
            <div>
              <label htmlFor="adm-portal" className="field-label">Portal</label>
              <select id="adm-portal" value={filters.portal} onChange={e => set({ portal: e.target.value })} className="field">
                <option value="todos">Todos</option>
                {PORTALS.map(portal => (
                  <option key={portal.key} value={portal.label}>{portal.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Bloque>

        <Bloque icon={Building2} tono="violet" title="Tipo de inmueble">
          <Fichas label="Tipo" columnas={3} value={filters.inmueble} onChange={inmueble => set({ inmueble })} options={tiposConActual} />
        </Bloque>

        <Bloque icon={MapPin} tono="blue" title="Ubicación">
          <div className="grid gap-4">
            <Selector id="adm-departamento" label="Departamento" value={filters.departamento} onChange={v => set({ departamento: v, provincia: "" })} opciones={facetas?.departamentos ?? []} vacio="Sin datos aún" />
            <Selector id="adm-provincia" label="Ciudad o provincia" value={filters.provincia} onChange={v => set({ provincia: v })} opciones={provincias} vacio="Sin datos aún" />
          </div>
        </Bloque>

        <Bloque icon={CircleDollarSign} tono="green" title="Precio">
          <div className="grid gap-4">
            <Fichas
              label="Moneda del rango"
              columnas={2}
              value={filters.moneda ?? "PEN"}
              onChange={m => handleCambioMoneda(m as "USD" | "PEN")}
              options={[{ value: "PEN", label: "Soles (S/)", icon: CircleDollarSign }, { value: "USD", label: "Dólares (USD)", icon: CircleDollarSign }]}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="adm-min" className="field-label">Mín. ({monedaLabel})</label>
                <input id="adm-min" type="number" min={0} value={filters.precioMin} onChange={e => set({ precioMin: e.target.value })} placeholder="0" className="field mono" />
              </div>
              <div>
                <label htmlFor="adm-max" className="field-label">Máx. ({monedaLabel})</label>
                <input id="adm-max" type="number" min={0} value={filters.precioMax} onChange={e => set({ precioMax: e.target.value })} placeholder="Sin límite" className="field mono" />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-3/40 px-4 py-2.5 text-sm text-text transition hover:border-gold/40">
              <input type="checkbox" checked={filters.soloConPrecio} onChange={e => set({ soloConPrecio: e.target.checked })} className="size-4 cursor-pointer accent-gold" />
              Solo avisos con precio publicado
            </label>
            <p className="text-xs text-text-muted">El rango se escribe en {filters.moneda === "PEN" ? "soles" : "dólares"} y no oculta avisos publicados en la otra moneda.</p>
          </div>
        </Bloque>

        <Bloque icon={BedDouble} tono="violet" title="Ambientes y cocheras">
          <div className="grid gap-4">
            <Fichas label="Dormitorios" columnas={5} value={filters.dormitorios} onChange={dormitorios => set({ dormitorios })} options={[["todos", "Todos"], ["1", "1"], ["2", "2"], ["3", "3"], ["4+", "4+"]].map(([value, label]) => ({ value: value as AdminSearchFilters["dormitorios"], label, icon: value === "todos" ? Layers : BedDouble }))} />
            <Fichas label="Baños" columnas={4} value={filters.banios} onChange={banios => set({ banios })} options={[["todos", "Todos"], ["1", "1"], ["2", "2"], ["3+", "3+"]].map(([value, label]) => ({ value: value as AdminSearchFilters["banios"], label, icon: value === "todos" ? Layers : Bath }))} />
            <Fichas label="Cocheras" columnas={4} value={filters.cocheras} onChange={cocheras => set({ cocheras })} options={[{ value: "todos", label: "Todas", icon: Layers }, { value: "1+", label: "1+", icon: Car }, { value: "2+", label: "2+", icon: Car }, { value: "3+", label: "3+", icon: Car }]} />
          </div>
        </Bloque>

        <Bloque icon={Ruler} tono="blue" title="Área construida">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="adm-area-min" className="field-label">Mín. (m²)</label>
              <input id="adm-area-min" type="number" min={0} inputMode="numeric" value={filters.areaMin} onChange={e => set({ areaMin: numero(e.target.value) })} placeholder="0" className="field mono" />
            </div>
            <div>
              <label htmlFor="adm-area-max" className="field-label">Máx. (m²)</label>
              <input id="adm-area-max" type="number" min={0} inputMode="numeric" value={filters.areaMax} onChange={e => set({ areaMax: numero(e.target.value) })} placeholder="Sin límite" className="field mono" />
            </div>
          </div>
        </Bloque>

        <Bloque icon={Hammer} tono="rose" title="Antigüedad">
          <Fichas
            label="Años máximos"
            columnas={5}
            value={String(filters.antiguedadMax)}
            onChange={v => set({ antiguedadMax: v === "" ? "" : Number(v) })}
            options={[{ value: "", label: "Todas", icon: Layers }, { value: "0", label: "Estreno", icon: Hammer }, { value: "5", label: "5", icon: Hammer }, { value: "10", label: "10", icon: Hammer }, { value: "20", label: "20", icon: Hammer }]}
          />
        </Bloque>

        <Bloque icon={UserRound} tono="amber" title="Anunciante">
          <div>
            <label htmlFor="adm-anunciante" className="field-label">Inmobiliaria o persona</label>
            <input id="adm-anunciante" type="text" list="adm-anunciantes" value={filters.anunciante} onChange={e => set({ anunciante: e.target.value })} placeholder="Ej.: Prisma" className="field" maxLength={80} autoComplete="off" />
            <datalist id="adm-anunciantes">
              {(facetas?.anunciantes ?? []).map(a => <option key={a.valor} value={a.valor} />)}
            </datalist>
          </div>
        </Bloque>

        <Bloque icon={CalendarClock} tono="green" title="Publicación">
          <Fichas
            label="Publicado en el sistema"
            columnas={4}
            value={filters.publicado}
            onChange={publicado => set({ publicado })}
            options={[{ value: "todos", label: "Siempre", icon: Layers }, { value: "hoy", label: "Hoy", icon: CalendarClock }, { value: "semana", label: "7 días", icon: CalendarClock }, { value: "mes", label: "30 días", icon: CalendarClock }]}
          />
        </Bloque>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface-1/60 px-5 py-4 sm:px-6">
        <button type="button" onClick={onClear} className="btn btn-secondary">
          <X className="size-4" />
          Limpiar
        </button>
        <button type="submit" className="btn btn-primary">
          <Search className="size-4" />
          Buscar
        </button>
      </footer>
    </form>
  )
}
