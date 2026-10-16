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

const muted = {
  color: "#6B6B6B",
  fontFamily: "DM Sans",
} as const

export default function BusquedasGuardadasList({
  busquedas,
  onExecute,
  onDelete,
}: BusquedasGuardadasListProps) {
  if (busquedas.length === 0) {
    return (
      <div className="text-center py-12" style={muted}>
        Aún no has guardado ninguna búsqueda. Ve a "Buscar propiedades", ajusta los
        filtros y usa "🔖 Guardar esta búsqueda".
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {busquedas.map(b => (
        <div
          key={b.id}
          className="p-4 rounded"
          style={{ backgroundColor: "#111111", border: "1px solid #2A2A2A" }}
        >
          <h3
            style={{
              color: "#C9A96E",
              fontFamily: "DM Sans",
              fontWeight: "bold",
              marginBottom: "0.5rem",
            }}
          >
            {b.nombre}
          </h3>

          <div style={{ ...muted, fontSize: "0.75rem", marginBottom: "1rem" }}>
            {b.distrito && <div>📍 {b.distrito}</div>}
            <div>
              🏷 {b.operacion === "todos" ? "Cualquier operación" : b.operacion}
            </div>
            <div>🌐 {b.portal === "todos" ? "Cualquier portal" : b.portal}</div>
            {(b.precio_min || b.precio_max) && (
              <div>
                💲 {b.precio_min || 0}
                {" — "}
                {b.precio_max || "sin límite"}
                {" USD"}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onExecute(b)}
              className="flex-1 px-3 py-2 rounded text-sm font-medium"
              style={{
                backgroundColor: "#C9A96E",
                color: "#0F0F0F",
                fontFamily: "DM Sans",
              }}
            >
              Ejecutar
            </button>

            <button
              onClick={() => onDelete(b)}
              className="px-3 py-2 rounded text-sm font-medium"
              style={{
                border: "1px solid #EF4444",
                color: "#EF4444",
                fontFamily: "DM Sans",
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
