import { Bookmark, CalendarPlus, Clock, Heart, TrendingDown } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import AnimatedNumber from "@/components/common/AnimatedNumber"
import EmptyState from "@/components/common/EmptyState"
import StatCard from "@/components/common/StatCard"
import { useToast } from "@/contexts/ToastContext"
import { timeAgo } from "@/lib/account"
import { fetchInicio, type Inicio } from "@/lib/insights"
import { getDisplayPrice, formatDisplayPrice } from "@/lib/prices"
import { safeHttpUrl } from "@/lib/url"
import type { FilterState, Propiedad } from "@/types"

interface PortalInicioProps {
  onOpenProperty: (id: string) => void
  onApplySearch: (filters: FilterState) => void
  onGoCatalog: () => void
}

function MiniAviso({ p, onOpen, extra }: { p: Propiedad; onOpen: () => void; extra?: React.ReactNode }) {
  const img = safeHttpUrl(p.imagen)
  const price = formatDisplayPrice(getDisplayPrice(p.precio, p.precio_usd, p.moneda === "USD" ? "USD" : "PEN"))
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-surface-3"
      >
        <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface-3 ring-1 ring-line">
          {img && <img src={img} alt="" loading="lazy" className="size-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">{p.titulo || "Sin título"}</span>
          <span className="block truncate text-xs text-text-muted">{p.distrito || "Sin distrito"}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="mono text-sm font-semibold text-text">{price}</span>
          {extra}
        </span>
      </button>
    </li>
  )
}

/** Pantalla de inicio del cliente: novedades, bajadas de precio y búsquedas guardadas. */
export default function PortalInicio({ onOpenProperty, onApplySearch, onGoCatalog }: PortalInicioProps) {
  const [data, setData] = useState<Inicio | null>(null)
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const load = useCallback(async () => {
    try {
      setData(await fetchInicio())
    } catch (err) {
      console.error(err)
      addToast("No se pudo cargar tu resumen", "error")
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    load()
  }, [load])

  const nuevosBusquedas = data?.busquedas.reduce((n, b) => n + b.nuevos, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Avisos nuevos hoy"
          icon={CalendarPlus}
          tone="gold"
          loading={loading}
          value={<AnimatedNumber value={data?.hoy ?? 0} />}
          hint={data ? `${data.ultimas24h.toLocaleString("es-PE")} en las últimas 24 h` : undefined}
          footerLabel="Ver el catálogo"
          onFooterClick={onGoCatalog}
        />
        <StatCard
          label="Bajadas en tus favoritos"
          icon={TrendingDown}
          tone="green"
          loading={loading}
          value={<AnimatedNumber value={data?.bajadas.length ?? 0} />}
          hint="en los últimos 30 días"
        />
        <StatCard
          label="Novedades en tus búsquedas"
          icon={Bookmark}
          tone="blue"
          loading={loading}
          value={<AnimatedNumber value={nuevosBusquedas} />}
          hint={data ? `avisos de los últimos ${data.nuevosDias} días` : undefined}
        />
        <StatCard
          label="Búsquedas guardadas"
          icon={Heart}
          tone="violet"
          loading={loading}
          value={<AnimatedNumber value={data?.busquedas.length ?? 0} />}
        />
      </div>

      <div className="stagger grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <TrendingDown className="size-4 text-green" aria-hidden="true" />
            Bajaron de precio
          </h2>
          <p className="mb-3 text-sm text-text-muted">Tus favoritos que se abarataron recientemente.</p>
          {loading ? (
            <div className="skeleton h-40" />
          ) : data && data.bajadas.length > 0 ? (
            <ul className="-mx-2.5">
              {data.bajadas.map(b => (
                <MiniAviso
                  key={b.id}
                  p={b}
                  onOpen={() => onOpenProperty(b.id)}
                  extra={
                    <span className="badge badge-green">
                      <TrendingDown className="size-3" aria-hidden="true" />-{b.baja_pct}%
                    </span>
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Heart}
              title="Aún no hay bajadas"
              description="Marca avisos como favoritos y te mostraremos aquí cuando alguno baje de precio."
            />
          )}
        </section>

        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <Bookmark className="size-4 text-blue" aria-hidden="true" />
            Tus búsquedas guardadas
          </h2>
          <p className="mb-3 text-sm text-text-muted">Cuántos avisos nuevos hay en cada una.</p>
          {loading ? (
            <div className="skeleton h-40" />
          ) : data && data.busquedas.length > 0 ? (
            <ul className="-mx-2.5">
              {data.busquedas.map(b => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onApplySearch(b.filtros as FilterState)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition hover:bg-surface-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text">{b.nombre}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {[b.filtros.distrito, b.filtros.operacion !== "todos" ? b.filtros.operacion : ""]
                          .filter(Boolean)
                          .join(" · ") || "Todos los avisos"}
                      </span>
                    </span>
                    <span className={b.nuevos > 0 ? "badge badge-gold" : "badge badge-muted"}>
                      {b.nuevos > 0 ? `${b.nuevos} nuevos` : "sin novedades"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Bookmark}
              title="Sin búsquedas guardadas"
              description="En el catálogo, guarda una búsqueda para ver aquí sus novedades."
            />
          )}
        </section>
      </div>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text">
          <Clock className="size-4 text-gold" aria-hidden="true" />
          Últimos avisos
        </h2>
        <p className="mb-3 text-sm text-text-muted">Lo más reciente que llegó al catálogo.</p>
        {loading ? (
          <div className="skeleton h-40" />
        ) : data && data.recientes.length > 0 ? (
          <ul className="-mx-2.5 grid gap-x-4 md:grid-cols-2">
            {data.recientes.map(p => (
              <MiniAviso
                key={p.id}
                p={p}
                onOpen={() => onOpenProperty(p.id)}
                extra={
                  p.creado_en ? (
                    <span className="text-[0.6875rem] text-text-faint">{timeAgo(p.creado_en)}</span>
                  ) : undefined
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Clock} title="Todavía no hay avisos" description="Cuando lleguen datos aparecerán aquí." />
        )}
      </section>
    </div>
  )
}
