import { Bath, BedDouble, Building2, CalendarClock, Car, CircleDollarSign, Hammer, Home, KeyRound, Layers, MapPin, Ruler, Search, SlidersHorizontal, Store, Tag, TextCursorInput, Trees, UserRound, X, type LucideIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { BloqueDesplegable, ControlesDeFiltros, Fichas, type OpcionFicha } from "@/components/filters/Campos"
import UbicacionFiltro from "@/components/filters/UbicacionFiltro"
import { Icono3D } from "@/components/portal/detail/Piezas"
import { useBloques } from "@/hooks/useBloques"
import { useFacetas } from "@/hooks/useFacetas"
import type { Faceta } from "@/lib/facetas"
import { opcionesGeograficas, rutaGeografica } from "@/lib/geografia"
import { PORTALS } from "@/lib/portals"
import { adminComoPortal, contarDetalle, type AdminSearchFilters } from "@/lib/propertiesApi"
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

const CLAVES_BLOQUES = ["texto", "operacion", "tipo", "ubicacion", "precio", "ambientes", "area", "antiguedad", "anunciante", "publicacion"]
/** Qué bloques se ven abiertos la primera vez: lo esencial para empezar a buscar. */
const BLOQUES_ABIERTOS: Record<string, boolean> = { operacion: true, tipo: true, ubicacion: true }

/** Ventana de filtros de la pestaña "Buscar" del panel admin: bloques desglosables con un resumen de lo elegido. */
export default function PropiedadesFilters({ filters, onChange, onSearch, onClear }: PropiedadesFiltersProps) {
  const set = (patch: Partial<AdminSearchFilters>) => onChange({ ...filters, ...patch })

  // Los precios escritos pertenecen a la moneda anterior: se limpian para no
  // interpretar un rango en otra moneda por accidente.
  const handleCambioMoneda = (moneda: "USD" | "PEN") => set({ moneda, precioMin: "", precioMax: "" })

  const monedaLabel = filters.moneda === "PEN" ? "S/" : "USD"
  // Las opciones se calculan sobre los filtros activos: solo lo disponible con ese portal, operación, precio, etc.
  const facetas = useFacetas(useMemo(() => adminComoPortal(filters), [filters]))
  const nDetalle = contarDetalle(filters)

  const [soloDisponibles, setSoloDisponibles] = useState(true)
  const visibles = (lista: Faceta[], elegido = ""): Faceta[] =>
    facetas.delServidor && soloDisponibles ? lista.filter(x => x.n > 0 || (!!elegido && claveNombre(x.valor) === claveNombre(elegido))) : lista
  const { estaAbierto, alternar, todosAbiertos, cambiarTodos } = useBloques(CLAVES_BLOQUES, BLOQUES_ABIERTOS, "filtros-admin-abiertos")

  const geo = { departamento: filters.departamento, provincia: filters.provincia, distrito: filters.distrito }
  const { provincias: provinciasTodas, distritos: distritosTodos } = useMemo(() => opcionesGeograficas(facetas, geo), [facetas, filters.departamento, filters.provincia]) // eslint-disable-line react-hooks/exhaustive-deps
  const tipos: OpcionFicha<string>[] = useMemo(
    () => [
      { value: "todos", label: "Todos", icon: Layers },
      ...visibles(facetas.inmuebles, filters.inmueble === "todos" ? "" : filters.inmueble).map(t => ({ value: t.valor, label: t.valor, icon: ICONO_TIPO[t.valor.toLowerCase()] ?? Building2, n: t.n })),
    ],
    [facetas, soloDisponibles, filters.inmueble] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const tiposConActual = filters.inmueble !== "todos" && !tipos.some(t => t.value === filters.inmueble) ? [...tipos, { value: filters.inmueble, label: filters.inmueble, icon: Building2 }] : tipos

  const rango = (min: number | string, max: number | string, prefijo = "", sufijo = "") =>
    min === "" && max === ""
      ? ""
      : `${prefijo ? prefijo + " " : ""}${min === "" ? "0" : Number(min).toLocaleString("es-PE")} – ${max === "" ? "sin límite" : Number(max).toLocaleString("es-PE")}${sufijo ? " " + sufijo : ""}`
  const resumenes: Record<string, string> = {
    texto: filters.texto.trim(),
    operacion: [filters.operacion === "todos" ? "" : filters.operacion === "ALQUILER" ? "Alquiler" : "Venta", filters.portal === "todos" ? "" : filters.portal].filter(Boolean).join(" · "),
    tipo: filters.inmueble === "todos" ? "" : filters.inmueble,
    ubicacion: rutaGeografica(geo),
    precio: [rango(filters.precioMin, filters.precioMax, monedaLabel), filters.soloConPrecio ? "con precio" : ""].filter(Boolean).join(" · "),
    ambientes: [
      filters.dormitorios !== "todos" ? `${filters.dormitorios} dorm.` : "",
      filters.banios !== "todos" ? `${filters.banios} baños` : "",
      filters.cocheras !== "todos" ? `${filters.cocheras} coch.` : "",
    ].filter(Boolean).join(" · "),
    area: rango(filters.areaMin, filters.areaMax, "", "m²"),
    antiguedad: filters.antiguedadMax === "" ? "" : filters.antiguedadMax === 0 ? "Estreno" : `Hasta ${filters.antiguedadMax} años`,
    anunciante: filters.anunciante.trim(),
    publicacion: filters.publicado === "todos" ? "" : (({ hoy: "Hoy", semana: "Últimos 7 días", mes: "Últimos 30 días" }) as Record<string, string>)[filters.publicado] ?? "",
  }
  const desp = (clave: string) => ({ abierto: estaAbierto(clave), onToggle: () => alternar(clave), resumen: resumenes[clave] })

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

      <div className="p-4 sm:p-5">
        <ControlesDeFiltros soloDisponibles={soloDisponibles} onSoloDisponibles={() => setSoloDisponibles(v => !v)} todosAbiertos={todosAbiertos} onCambiarTodos={cambiarTodos} />

        {/* Columnas que se llenan hacia abajo: los bloques (de alturas muy distintas) no dejan huecos vacíos como en una cuadrícula. */}
        <div className="gap-x-3 md:columns-2 xl:columns-3 [&>section]:mb-3 [&>section]:break-inside-avoid">
          <BloqueDesplegable icon={TextCursorInput} tono="rose" title="Buscar por palabra" {...desp("texto")}>
            <div>
              <label htmlFor="adm-texto" className="field-label">Palabra clave</label>
              <input id="adm-texto" type="search" value={filters.texto} onChange={e => set({ texto: e.target.value })} placeholder="Ej.: terraza" className="field" maxLength={80} autoComplete="off" />
            </div>
          </BloqueDesplegable>

          <BloqueDesplegable icon={KeyRound} tono="gold" title="Operación y portal" {...desp("operacion")}>
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
          </BloqueDesplegable>

          <BloqueDesplegable icon={Building2} tono="violet" title="Tipo de inmueble" {...desp("tipo")}>
            <Fichas label="Tipo" columnas={2} value={filters.inmueble} onChange={inmueble => set({ inmueble })} options={tiposConActual} />
          </BloqueDesplegable>

          <BloqueDesplegable icon={MapPin} tono="blue" title="Ubicación" {...desp("ubicacion")}>
            <UbicacionFiltro
              idBase="adm"
              geo={geo}
              facetas={facetas}
              departamentos={visibles(facetas.departamentos, filters.departamento)}
              provincias={visibles(provinciasTodas, filters.provincia)}
              distritos={visibles(distritosTodos, filters.distrito)}
              vacio="Sin avisos con estos filtros"
              onCambiar={g => set(g)}
            />
          </BloqueDesplegable>

          <BloqueDesplegable icon={CircleDollarSign} tono="green" title="Precio" {...desp("precio")}>
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
          </BloqueDesplegable>

          <BloqueDesplegable icon={BedDouble} tono="violet" title="Ambientes y cocheras" {...desp("ambientes")}>
            <div className="grid gap-4">
              <Fichas label="Dormitorios" columnas={5} value={filters.dormitorios} onChange={dormitorios => set({ dormitorios })} options={[["todos", "Todos"], ["1", "1"], ["2", "2"], ["3", "3"], ["4+", "4+"]].map(([value, label]) => ({ value: value as AdminSearchFilters["dormitorios"], label, icon: value === "todos" ? Layers : BedDouble }))} />
              <Fichas label="Baños" columnas={4} value={filters.banios} onChange={banios => set({ banios })} options={[["todos", "Todos"], ["1", "1"], ["2", "2"], ["3+", "3+"]].map(([value, label]) => ({ value: value as AdminSearchFilters["banios"], label, icon: value === "todos" ? Layers : Bath }))} />
              <Fichas label="Cocheras" columnas={4} value={filters.cocheras} onChange={cocheras => set({ cocheras })} options={[{ value: "todos", label: "Todas", icon: Layers }, { value: "1+", label: "1+", icon: Car }, { value: "2+", label: "2+", icon: Car }, { value: "3+", label: "3+", icon: Car }]} />
            </div>
          </BloqueDesplegable>

          <BloqueDesplegable icon={Ruler} tono="blue" title="Área construida" {...desp("area")}>
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
          </BloqueDesplegable>

          <BloqueDesplegable icon={Hammer} tono="rose" title="Antigüedad" {...desp("antiguedad")}>
            <Fichas
              label="Años máximos"
              columnas={5}
              value={String(filters.antiguedadMax)}
              onChange={v => set({ antiguedadMax: v === "" ? "" : Number(v) })}
              options={[{ value: "", label: "Todas", icon: Layers }, { value: "0", label: "Estreno", icon: Hammer }, { value: "5", label: "5", icon: Hammer }, { value: "10", label: "10", icon: Hammer }, { value: "20", label: "20", icon: Hammer }]}
            />
          </BloqueDesplegable>

          <BloqueDesplegable icon={UserRound} tono="amber" title="Anunciante" {...desp("anunciante")}>
            <div>
              <label htmlFor="adm-anunciante" className="field-label">Inmobiliaria o persona</label>
              <input id="adm-anunciante" type="text" list="adm-anunciantes" value={filters.anunciante} onChange={e => set({ anunciante: e.target.value })} placeholder="Ej.: Prisma" className="field" maxLength={80} autoComplete="off" />
              <datalist id="adm-anunciantes">
                {facetas.anunciantes.map(a => <option key={a.valor} value={a.valor} />)}
              </datalist>
            </div>
          </BloqueDesplegable>

          <BloqueDesplegable icon={CalendarClock} tono="green" title="Publicación" {...desp("publicacion")}>
            <Fichas
              label="Publicado en el sistema"
              columnas={4}
              value={filters.publicado}
              onChange={publicado => set({ publicado })}
              options={[{ value: "todos", label: "Siempre", icon: Layers }, { value: "hoy", label: "Hoy", icon: CalendarClock }, { value: "semana", label: "7 días", icon: CalendarClock }, { value: "mes", label: "30 días", icon: CalendarClock }]}
            />
          </BloqueDesplegable>
        </div>
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
