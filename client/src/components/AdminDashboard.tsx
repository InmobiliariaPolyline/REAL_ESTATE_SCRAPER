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

  useEffect(() => {
    loadMetricas()
  }, [])

  const loadMetricas = async () => {
    try {
      setLoading(true)

      const hoy = new Date().toISOString().split('T')[0]

      const [
        { count: totalProps },
        { count: totalUsers },
        { count: subsActivas },
        { count: addedHoy },
        { data: porPortal },
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
        supabase.from('propiedades').select('portal'),
      ])

      setMetricas({
        totalProps: totalProps || 0,
        totalUsers: totalUsers || 0,
        subsActivas: subsActivas || 0,
        addedHoy: addedHoy || 0,
      })

      // Procesar datos para gráfico
      if (porPortal) {
        const grouped: { [key: string]: number } = {}
        porPortal.forEach((item: any) => {
          grouped[item.portal] = (grouped[item.portal] || 0) + 1
        })

        const chartDataProcessed = Object.entries(grouped).map(([portal, count]) => ({
          name: portal,
          value: count,
        }))

        setChartData(chartDataProcessed)
      }
    } catch (err) {
      addToast('Error al cargar métricas', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const COLORS = {
    Properati: '#3B82F6',
    Infocasas: '#8B5CF6',
    Babilonia: '#F59E0B',
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
        className="p-6 rounded"
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
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
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
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #2A2A2A',
                  color: '#F0EDE8',
                }}
              />
              <Legend
                wrapperStyle={{
                  color: '#F0EDE8',
                  fontFamily: 'DM Sans',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
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
