import { Bookmark, DollarSign, Globe, MapPin, Play, Tag, Trash2 } from "lucide-react"
import EmptyState from "@/components/common/EmptyState"

export interface BusquedaGuardada {
  id: string
  nombre: string
  distrito: string
  operacion: string
  portal: string
  /** Límites normalizados a USD. */
  precio_min: number | null
  precio_max: number | null
}

interface BusquedasGuardadasListProps {
  busquedas: BusquedaGuardada[]
  onExecute: (busqueda: BusquedaGuardada) => void
  onDelete: (busqueda: BusquedaGuardada) => void
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-text-muted">
      <Icon className="size-4 shrink-0 text-text-faint" strokeWidth={1.75} />
      <span className="truncate">{children}</span>
    </p>
  )
}

export default function BusquedasGuardadasList({
  busquedas,
  onExecute,
  onDelete,
}: BusquedasGuardadasListProps) {
  if (busquedas.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={Bookmark}
          title="Aún no has guardado ninguna búsqueda"
          description='Ve a "Buscar", ajusta los filtros y usa "Guardar búsqueda".'
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {busquedas.map(b => (
        <article key={b.id} className="card card-interactive flex flex-col p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft ring-1 ring-gold/25">
              <Bookmark className="size-5 text-gold" strokeWidth={1.75} />
            </span>
            <h3 className="pt-1.5 text-base font-semibold leading-snug text-text">{b.nombre}</h3>
          </div>

          <div className="mb-5 space-y-2">
            {b.distrito && <Row icon={MapPin}>{b.distrito}</Row>}
            <Row icon={Tag}>
              {b.operacion === "todos" ? "Cualquier operación" : b.operacion}
            </Row>
            <Row icon={Globe}>{b.portal === "todos" ? "Cualquier portal" : b.portal}</Row>
            {(b.precio_min || b.precio_max) && (
              <Row icon={DollarSign}>
                <span className="mono">
                  {b.precio_min || 0} — {b.precio_max || "sin límite"} USD
                </span>
              </Row>
            )}
          </div>

          <div className="mt-auto flex gap-2">
            <button onClick={() => onExecute(b)} className="btn btn-primary btn-sm flex-1">
              <Play className="size-4" />
              Ejecutar
            </button>
            <button
              onClick={() => onDelete(b)}
              className="btn btn-danger btn-sm btn-icon"
              aria-label={`Eliminar búsqueda ${b.nombre}`}
              title="Eliminar"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
