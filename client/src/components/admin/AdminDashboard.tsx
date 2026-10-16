import { useCallback, useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useIsMobile } from '@/hooks/useMobile'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { formatDateTime, startOfTodayTimestamp, todayISO } from '@/lib/dates'
import { PORTALS } from '@/lib/portals'

/** Horas sin avisos nuevos a partir de las cuales se considera inactivo al scraper. */
const STALE_HOURS = 48
const PAGE = 1000
const MAX_PAGES = 20

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

/** Usuarios distintos con suscripción vigente (pagina para superar el límite por respuesta). */
async function countActiveSubscribers(): Promise<number> {
  const users = new Set<number>()
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from('suscripciones')
      .select('usuario_id')
      .gte('fecha_vencimiento', todayISO())
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (error) throw error
    for (const row of data ?? []) users.add(row.usuario_id as number)
    if ((data?.length ?? 0) < PAGE) break
  }
  return users.size
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
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const count = (q: PromiseLike<{ count: number | null; error: unknown }>) =>
        Promise.resolve(q).then(({ count, error }) => {
          if (error) throw error
          return count ?? 0
        })
      const head = () =>
        supabase.from('propiedades').select('*', { count: 'exact', head: true })

      const [
        totalProps,
        totalUsers,
        subsActivas,
        addedHoy,
        added24h,
        latest,
        ...portalCounts
      ] = await Promise.all([
        count(head()),
        count(supabase.from('usuarios').select('*', { count: 'exact', head: true })),
        countActiveSubscribers(),
        count(head().gte('creado_en', startOfTodayTimestamp())),
        count(head().gte('creado_en', since24h)),
        supabase
          .from('propiedades')
          .select('creado_en')
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle(),
        ...PORTALS.map(portal => count(head().eq('portal', portal.key))),
      ])

      if (latest.error) throw latest.error

      setMetricas({
        totalProps,
        totalUsers,
        subsActivas,
        addedHoy,
        added24h,
        ultimoAviso: (latest.data?.creado_en as string | undefined) ?? null,
      })

      setChartData(
        PORTALS.map((portal, idx) => ({
          name: portal.label,
          value: portalCounts[idx] as number,
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
