import { History, Loader2, Play, RefreshCw, Rocket } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import Avatar from "@/components/common/Avatar"
import ConfirmModal from "@/components/common/ConfirmModal"
import EmptyState from "@/components/common/EmptyState"
import { useToast } from "@/contexts/ToastContext"
import { ApiError, api } from "@/lib/api"
import { formatDateTime } from "@/lib/dates"

interface AccessLog {
  id: number
  usuario_id: number
  fecha_acceso: string
  usuario: string | null
}

const usernameOf = (log: AccessLog): string => log.usuario || "desconocido"

export default function AdminScraper() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [scraperLoading, setScraperLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
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

  const handleForceScraper = async () => {
    if (scraperLoading) return
    try {
      setScraperLoading(true)

      // El GITHUB_PAT vive en las variables de entorno del servidor, NUNCA en el frontend.
      await api.post("/admin/scraper")
      addToast("Scraper iniciado: los resultados llegarán en unos 45 minutos", "success")
    } catch (err) {
      addToast(
        err instanceof ApiError && (err.status === 501 || err.status === 502) && err.message
          ? err.message
          : "Error al contactar el servidor",
        "error"
      )
      console.error(err)
    } finally {
      setScraperLoading(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {/* Ejecución del scraper */}
      <section className="card flex flex-col p-6">
        <span className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-gold-soft ring-1 ring-gold/25">
          <Rocket className="size-6 text-gold" strokeWidth={1.75} />
        </span>
        <h2 className="text-base font-semibold text-text">Ejecución del scraper</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Lanza una corrida manual sin esperar al horario automático. El estado del scraper
          (avisos nuevos y última actividad) se ve en el Dashboard.
        </p>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={scraperLoading}
          className="btn btn-primary btn-lg mt-6 self-start"
        >
          {scraperLoading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {scraperLoading ? "Iniciando..." : "Forzar scraper ahora"}
        </button>

        <p className="mt-auto pt-6 text-xs leading-relaxed text-text-faint">
          Seguridad: el botón llama a <code className="text-text-muted">POST /api/admin/scraper</code>,
          que verifica que quien lo invoca sea administrador. El token de GitHub se guarda en las
          variables de entorno del servidor, nunca en el navegador.
        </p>
      </section>

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

      {confirmOpen && (
        <ConfirmModal
          title="¿Forzar el scraper ahora?"
          confirmLabel="Iniciar"
          busyLabel="Iniciando..."
          busy={scraperLoading}
          onConfirm={handleForceScraper}
          onCancel={() => setConfirmOpen(false)}
        >
          Se lanzará una corrida completa del scraper (puede tardar unos 45 minutos).
        </ConfirmModal>
      )}
    </div>
  )
}
