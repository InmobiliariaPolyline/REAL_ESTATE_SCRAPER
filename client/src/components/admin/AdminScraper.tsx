import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import ConfirmModal from "@/components/common/ConfirmModal"
import { useToast } from "@/contexts/ToastContext"
import { formatDateTime } from "@/lib/dates"
import { ApiError, api } from "@/lib/api"

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
      addToast("✅ Scraper iniciado — resultados en ~45 minutos", "success")
    } catch (err) {
      addToast(
        err instanceof ApiError && err.status === 501
          ? "El scraper no está configurado en el servidor (GITHUB_PAT / GITHUB_REPO / GITHUB_WORKFLOW)"
          : "❌ Error al contactar el servidor",
        "error"
      )
      console.error(err)
    } finally {
      setScraperLoading(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={loadLogs}
          disabled={loading}
          className="px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2"
          style={{
            backgroundColor: "transparent",
            border: "1px solid #C9A96E",
            color: "#C9A96E",
            fontFamily: "DM Sans",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={scraperLoading}
          className="px-4 py-2 rounded text-sm font-medium transition"
          style={{
            backgroundColor: "#C9A96E",
            color: "#0F0F0F",
            fontFamily: "DM Sans",
            opacity: scraperLoading ? 0.6 : 1,
          }}
        >
          {scraperLoading ? "Iniciando..." : "🔄 Forzar Scraper Ahora"}
        </button>
      </div>

      <h2
        className="text-lg font-bold"
        style={{ fontFamily: "Cormorant Garamond", color: "#F0EDE8" }}
      >
        Últimos accesos de usuarios
      </h2>

      {/* Consola de accesos */}
      <div
        className="rounded p-4 font-mono text-sm overflow-y-auto"
        style={{
          backgroundColor: "#050505",
          border: "1px solid #2A2A2A",
          color: "#22C55E",
          height: "400px",
          fontFamily: "JetBrains Mono",
        }}
      >
        {loading ? (
          <div style={{ color: "#6B6B6B" }}>Cargando accesos...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: "#6B6B6B" }}>Sin accesos registrados</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="mb-2">
              [{formatDateTime(log.fecha_acceso)}] Usuario:{" "}
              <span style={{ color: "#C9A96E" }}>{usernameOf(log)}</span> conectado
            </div>
          ))
        )}
      </div>

      <div
        className="p-4 rounded text-xs"
        style={{
          backgroundColor: "#1A1A1A",
          border: "1px solid #2A2A2A",
          color: "#6B6B6B",
          fontFamily: "DM Sans",
        }}
      >
        <strong style={{ color: "#C9A96E" }}>Nota de seguridad:</strong> El botón
        "Forzar Scraper" llama a la API (<code>POST /api/admin/scraper</code>), que verifica
        que quien la invoca sea administrador. El GITHUB_PAT se guarda en las variables de
        entorno del servidor, NUNCA en el frontend.
      </div>

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
