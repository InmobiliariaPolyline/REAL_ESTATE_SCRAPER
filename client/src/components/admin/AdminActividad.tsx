import { History, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import Avatar from "@/components/common/Avatar"
import EmptyState from "@/components/common/EmptyState"
import { useToast } from "@/contexts/ToastContext"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/dates"

interface AccessLog {
  id: number
  usuario_id: number
  fecha_acceso: string
  usuario: string | null
}

const usernameOf = (log: AccessLog): string => log.usuario || "desconocido"

export default function AdminActividad() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      setLogs(await api.get<AccessLog[]>("/admin/accesos"))
    } catch (err) {
      addToast("Error al cargar el historial de accesos", "error")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return (
    <div className="max-w-3xl">
      {/* Accesos de usuarios */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text">Accesos de usuarios</h2>
            <p className="text-sm text-text-muted">Últimos {logs.length || 50} inicios de sesión</p>
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            aria-label="Actualizar accesos"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Actualizar
          </button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="skeleton h-14" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={History}
              title="Sin accesos registrados"
              description="Los inicios de sesión aparecerán aquí."
            />
          ) : (
            <ul className="divide-y divide-line">
              {logs.map(log => (
                <li
                  key={log.id}
                  className="flex items-center gap-3 px-6 py-3.5 transition hover:bg-white/[0.025]"
                >
                  <Avatar name={usernameOf(log)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{usernameOf(log)}</p>
                    <p className="text-xs text-text-muted">Inició sesión</p>
                  </div>
                  <time className="mono shrink-0 text-xs text-text-muted" dateTime={log.fecha_acceso}>
                    {formatDateTime(log.fecha_acceso)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

    </div>
  )
}
