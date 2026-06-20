import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'

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

export default function AdminDashboard() {
  const [metricas, setMetricas] = useState({
    totalProps: 0,
    totalUsers: 0,
    subsActivas: 0,
    addedHoy: 0,
  })
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    loadMetricas()
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const loadMetricas = async () => {
    try {
      setLoading(true)

      const hoy = new Date().toISOString().split('T')[0]
      const portals = ['properati', 'infocasas', 'babilonia', 'urbania', 'adondevivir']

      const [
        { count: totalProps },
        { count: totalUsers },
        { count: subsActivas },
        { count: addedHoy },
        ...portalResults
      ] = await Promise.all([
        supabase
          .from('propiedades')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('usuarios')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('suscripciones')
          .select('*', { count: 'exact', head: true })
          .gte('fecha_vencimiento', hoy),
        supabase
          .from('propiedades')
          .select('*', { count: 'exact', head: true })
          .gte('creado_en', hoy),
        ...portals.map((portal) =>
          supabase
            .from('propiedades')
            .select('*', { count: 'exact', head: true })
            .eq('portal', portal)
        ),
      ])

      setMetricas({
        totalProps: totalProps || 0,
        totalUsers: totalUsers || 0,
        subsActivas: subsActivas || 0,
        addedHoy: addedHoy || 0,
      })

      // Procesar datos para gráfico
      const chartDataProcessed = portals
        .map((portal, idx) => ({
          name: portal.charAt(0).toUpperCase() + portal.slice(1),
          value: portalResults[idx]?.count || 0,
        }))
        .filter((item) => item.value > 0)

      setChartData(chartDataProcessed)
    } catch (err) {
      addToast('Error al cargar métricas', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const COLORS: { [key: string]: string } = {
    Properati: '#3B82F6',
    properati: '#3B82F6',
    Infocasas: '#8B5CF6',
    infocasas: '#8B5CF6',
    Babilonia: '#F59E0B',
    babilonia: '#F59E0B',
    urbania: '#EC4899',
    Urbania: '#EC4899',
    adondevivir: '#10B981',
    Adondevivir: '#10B981',
  }

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
          icon="🟢"
          titulo="Salud Sistema"
          valor={0}
          subtitulo="Scraper: ACTIVO"
          color="#22C55E"
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
                      fill={COLORS[entry.name as keyof typeof COLORS] || '#60A5FA'}
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
