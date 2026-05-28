import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'

interface Log {
  id: number
  usuario_id: number
  fecha_acceso: string
  usuarios?: any
}

export default function AdminScraper() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [scraperLoading, setScraperLoading] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('historial_accesos')
        .select('id, usuario_id, fecha_acceso, usuarios(usuario)')
        .order('fecha_acceso', { ascending: false })
        .limit(50)

      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      addToast('Error al cargar logs', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleForceScraper = async () => {
    try {
      setScraperLoading(true)

      // GITHUB_PAT vive en Supabase Edge Function secrets, NUNCA en el frontend.
      const { error } = await supabase.functions.invoke('trigger-scraper')

      if (error) {
        addToast('❌ Error al contactar el servidor', 'error')
        console.error(error)
      } else {
        addToast('✅ Scraper iniciado — resultados en ~45 minutos', 'success')
      }
    } catch (err) {
      addToast('❌ Error al contactar el servidor', 'error')
      console.error(err)
    } finally {
      setScraperLoading(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-PE')
  }

  return (
    <div className="space-y-6">
      {/* Botones de acción */}
      <div className="flex gap-3">
        <button
          onClick={loadLogs}
          disabled={loading}
          className="px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #C9A96E',
            color: '#C9A96E',
            fontFamily: 'DM Sans',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
        <button
          onClick={handleForceScraper}
          disabled={scraperLoading}
          className="px-4 py-2 rounded text-sm font-medium transition"
          style={{
            backgroundColor: '#C9A96E',
            color: '#0F0F0F',
            fontFamily: 'DM Sans',
            opacity: scraperLoading ? 0.6 : 1,
          }}
        >
          {scraperLoading ? 'Iniciando...' : '🔄 Forzar Scraper Ahora'}
        </button>
      </div>

      {/* Consola de logs */}
      <div
        className="rounded p-4 font-mono text-sm overflow-y-auto"
        style={{
          backgroundColor: '#050505',
          border: '1px solid #2A2A2A',
          color: '#22C55E',
          height: '400px',
          fontFamily: 'JetBrains Mono',
        }}
      >
        {loading ? (
          <div style={{ color: '#6B6B6B' }}>Cargando logs...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#6B6B6B' }}>Sin logs disponibles</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="mb-2">
              [{formatDate(log.fecha_acceso)}] Usuario:{' '}
              <span style={{ color: '#C9A96E' }}>
                {log.usuarios?.usuario || 'desconocido'}
              </span>{' '}
              conectado
            </div>
          ))
        )}
      </div>

      {/* Nota sobre seguridad */}
      <div
        className="p-4 rounded text-xs"
        style={{
          backgroundColor: '#1A1A1A',
          border: '1px solid #2A2A2A',
          color: '#6B6B6B',
          fontFamily: 'DM Sans',
        }}
      >
        <strong style={{ color: '#C9A96E' }}>Nota de seguridad:</strong> El botón
        "Forzar Scraper" llama a una Supabase Edge Function. El GITHUB_PAT se
        almacena de forma segura en los secrets de entorno de la Edge Function,
        NUNCA en el frontend.
      </div>
    </div>
  )
}
