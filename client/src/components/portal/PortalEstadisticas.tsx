import { BarChart3, MapPin, Ruler } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import AnimatedNumber from "@/components/common/AnimatedNumber"
import EmptyState from "@/components/common/EmptyState"
import StatCard from "@/components/common/StatCard"
import { useToast } from "@/contexts/ToastContext"
import { fetchEstadisticas, type Estadisticas } from "@/lib/insights"
import { cn } from "@/lib/utils"

type Operacion = "VENTA" | "ALQUILER"

interface PortalEstadisticasProps {
  /** Lleva al catálogo con ese distrito y operación ya filtrados. */
  onSelectDistrito: (distrito: string, operacion: Operacion) => void
}

const usd = (n: number) => `USD ${Math.round(n).toLocaleString("es-PE")}`
const usdDec = (n: number) => `USD ${n.toLocaleString("es-PE", { maximumFractionDigits: 1 })}`

/** Precio mediano por m² y por distrito, para comparar zonas de un vistazo. */
export default function PortalEstadisticas({ onSelectDistrito }: PortalEstadisticasProps) {
  const [data, setData] = useState<Estadisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [operacion, setOperacion] = useState<Operacion>("VENTA")
  const { addToast } = useToast()

  useEffect(() => {
    fetchEstadisticas()
      .then(setData)
      .catch(err => {
        console.error(err)
        addToast("No se pudieron cargar las estadísticas", "error")
      })
      .finally(() => setLoading(false))
  }, [addToast])

  const filas = useMemo(
    () =>
      (data?.distritos ?? [])
        .filter(d => d.operacion === operacion)
        .sort((a, b) => (b.precioM2Mediano ?? -1) - (a.precioM2Mediano ?? -1) || b.avisos - a.avisos),
    [data, operacion]
  )
  const maxM2 = Math.max(1, ...filas.map(f => f.precioM2Mediano ?? 0))
  const resumen = (op: Operacion) => data?.resumen.find(r => r.operacion === op)

  return (
    <div className="space-y-6">
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard
          label="Venta: mediana por m²"
          icon={Ruler}
          tone="gold"
          loading={loading}
          value={
            resumen("VENTA")?.precioM2Mediano ? (
              <AnimatedNumber value={resumen("VENTA")!.precioM2Mediano!} format={usdDec} />
            ) : (
              "—"
            )
          }
          hint={`${(resumen("VENTA")?.avisos ?? 0).toLocaleString("es-PE")} avisos con precio`}
        />
        <StatCard
          label="Alquiler: mediana por m²"
          icon={Ruler}
          tone="green"
          loading={loading}
          value={
            resumen("ALQUILER")?.precioM2Mediano ? (
              <AnimatedNumber value={resumen("ALQUILER")!.precioM2Mediano!} format={usdDec} />
            ) : (
              "—"
            )
          }
          hint={`${(resumen("ALQUILER")?.avisos ?? 0).toLocaleString("es-PE")} avisos con precio`}
        />
      </div>

      <section className="card p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <BarChart3 className="size-4 text-gold" aria-hidden="true" />
              Precio por m² por distrito
            </h2>
            <p className="text-sm text-text-muted">
              Mediana en USD. Solo distritos con al menos 3 avisos. Pulsa uno para ver sus avisos.
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Operación">
            {(["VENTA", "ALQUILER"] as const).map(op => (
              <button
                key={op}
                className="segmented-option !px-4"
                aria-pressed={operacion === op}
                onClick={() => setOperacion(op)}
              >
                {op === "VENTA" ? "Venta" : "Alquiler"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="skeleton h-64" />
        ) : filas.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Aún no hay suficientes datos"
            description="Se necesitan al menos 3 avisos con precio en un mismo distrito para calcular su mediana."
          />
        ) : (
          <ul className="space-y-1">
            {filas.map(f => (
              <li key={`${f.operacion}-${f.distrito}`}>
                <button
                  type="button"
                  onClick={() => onSelectDistrito(f.distrito, f.operacion)}
                  className="group grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
                >
                  <span className="truncate text-sm font-medium text-text">{f.distrito}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-3 group-hover:bg-surface-4">
                    {f.precioM2Mediano !== null && (
                      <span
                        key={`${operacion}-${f.distrito}-${f.precioM2Mediano}`}
                        className={cn(
                          "bar-grow block h-full rounded-full",
                          operacion === "VENTA" ? "bg-gold" : "bg-green"
                        )}
                        style={{ width: `${(f.precioM2Mediano / maxM2) * 100}%` }}
                      />
                    )}
                  </span>
                  <span className="text-right">
                    <span className="mono block text-sm font-semibold text-text">
                      {f.precioM2Mediano !== null ? `${usdDec(f.precioM2Mediano)}/m²` : "sin áreas"}
                    </span>
                    <span className="block text-[0.6875rem] text-text-faint">
                      {f.avisos} avisos · mediana {usd(f.precioMediano)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
