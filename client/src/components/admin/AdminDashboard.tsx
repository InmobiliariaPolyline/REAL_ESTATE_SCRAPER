import { useCallback, useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useIsMobile } from '@/hooks/useMobile'
import { api } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { formatDateTime } from '@/lib/dates'
import { PORTALS } from '@/lib/portals'

/** Horas sin avisos nuevos a partir de las cuales se considera inactivo al scraper. */
const STALE_HOURS = 48

interface Stats {
  totalProps: number
  totalUsers: number
  subsActivas: number
  addedHoy: number
  added24h: number
  ultimoAviso: string | null
  porPortal: { portal: string; count: number }[]
}

interface MetricaProps {
  icon: string
  titulo: string
  valor: number
  subtitulo?: string
  color: string
}

function MetricaCard({ icon, titulo, valor, subtitulo, color }: MetricaProps) {
  return (
    <div
      className="p-6 rounded"
      style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div style={{ fontSize: '2rem' }}>{icon}</div>
        <div style={{ color, fontSize: '0.75rem', fontFamily: 'DM Sans' }}>
          {subtitulo}
        </div>
      </div>
      <h3
        style={{
          color: '#6B6B6B',
          fontFamily: 'DM Sans',
          fontSize: '0.875rem',
          marginBottom: '0.5rem',
        }}
      >
        {titulo}
      </h3>
      <p
        style={{
          color,
          fontFamily: 'JetBrains Mono',
          fontSize: '1.875rem',
          fontWeight: 'bold',
        }}
      >
        {valor.toLocaleString('es-PE')}
      </p>
    </div>
  )
}

interface ChartPoint {
  name: string
  value: number
  color: string
}

export default function AdminDashboard() {
  const [metricas, setMetricas] = useState({
    totalProps: 0,
    totalUsers: 0,
    subsActivas: 0,
    addedHoy: 0,
    added24h: 0,
    ultimoAviso: null as string | null,
  })
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const { addToast } = useToast()
  const isMobile = useIsMobile()

  const loadMetricas = useCallback(async () => {
    try {
      const stats = await api.get<Stats>('/admin/stats')
      const countOf = (key: string) =>
        stats.porPortal.find(p => p.portal.toLowerCase() === key)?.count ?? 0

      setMetricas({
        totalProps: stats.totalProps,
        totalUsers: stats.totalUsers,
        subsActivas: stats.subsActivas,
        addedHoy: stats.addedHoy,
        added24h: stats.added24h,
        ultimoAviso: stats.ultimoAviso,
      })

      setChartData(
        PORTALS.map(portal => ({
          name: portal.label,
          value: countOf(portal.key),
          color: portal.color,
        })).filter(item => item.value > 0)
      )
    } catch (err) {
      addToast('Error al cargar métricas', 'error')
      console.error(err)
    }
  }, [addToast])

  useEffect(() => {
    loadMetricas()
  }, [loadMetricas])

  const horasDesdeUltimo = metricas.ultimoAviso
    ? (Date.now() - new Date(metricas.ultimoAviso).getTime()) / 36e5
    : null
  const scraperActivo = horasDesdeUltimo !== null && horasDesdeUltimo <= STALE_HOURS

  return (
    <div className="space-y-8">
      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricaCard
          icon="🏠"
          titulo="Total Propiedades"
          valor={metricas.totalProps}
          subtitulo={`+${metricas.addedHoy} hoy`}
          color="#C9A96E"
        />
        <MetricaCard
          icon="👥"
          titulo="Usuarios"
          valor={metricas.totalUsers}
          color="#60A5FA"
        />
        <MetricaCard
          icon="💳"
          titulo="Suscripciones Activas"
          valor={metricas.subsActivas}
          color="#34D399"
        />
        <MetricaCard
          icon={scraperActivo ? '🟢' : '🟠'}
          titulo="Salud: avisos nuevos (24 h)"
          valor={metricas.added24h}
          subtitulo={
            metricas.ultimoAviso
              ? `Scraper: ${scraperActivo ? 'ACTIVO' : 'SIN ACTIVIDAD'} · último ${formatDateTime(metricas.ultimoAviso)}`
              : 'Scraper: sin datos'
          }
          color={scraperActivo ? '#22C55E' : '#F59E0B'}
        />
      </div>

      {/* Gráfico */}
      <div
        className="p-4 sm:p-6 rounded overflow-hidden w-full"
        style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}
      >
        <h3
          style={{
            color: '#F0EDE8',
            fontFamily: 'DM Sans',
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
          }}
        >
          Propiedades por Portal
        </h3>

        {chartData.length > 0 ? (
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  minAngle={15}
                  outerRadius={isMobile ? 60 : 80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#2a2a2a',
                    borderColor: '#444',
                  }}
                  itemStyle={{
                    color: '#ffffff',
                  }}
                />
                <Legend
                  wrapperStyle={{
                    color: '#F0EDE8',
                    fontFamily: 'DM Sans',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div
            className="h-80 flex items-center justify-center"
            style={{ color: '#6B6B6B' }}
          >
            Sin datos
          </div>
        )}
      </div>
    </div>
  )
}
