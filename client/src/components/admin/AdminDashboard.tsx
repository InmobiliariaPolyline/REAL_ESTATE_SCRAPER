import { Activity, ArrowRight, Building2, Crown, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import StatCard from '@/components/common/StatCard'
import { useToast } from '@/contexts/ToastContext'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/dates'
import { PORTALS } from '@/lib/portals'
import { cn } from '@/lib/utils'
import type { AdminTab } from './tabs'

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
  porDia: { dia: string; total: number }[]
}

const GOLD = '#d4b782'
const TEAL = '#4fd1b5'

const fmt = (n: number) => n.toLocaleString('es-PE')

/** "2026-10-16" -> "16/10" */
const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

interface DashboardProps {
  onNavigate: (tab: AdminTab) => void
}

export default function AdminDashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const load = useCallback(async () => {
    try {
      setStats(await api.get<Stats>('/admin/stats'))
    } catch (err) {
      addToast('Error al cargar métricas', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    load()
  }, [load])

  const portals = useMemo(() => {
    const rows = stats?.porPortal ?? []
    const total = rows.reduce((n, r) => n + r.count, 0)
    return PORTALS.map(p => {
      const count = rows.find(r => r.portal.toLowerCase() === p.key)?.count ?? 0
      return { ...p, count, share: total ? Math.round((count / total) * 100) : 0 }
    }).sort((a, b) => b.count - a.count)
  }, [stats])

  const series = stats?.porDia ?? []
  const total30 = series.reduce((n, d) => n + d.total, 0)
  const average = series.length ? total30 / series.length : 0
  const peak = series.reduce((m, d) => Math.max(m, d.total), 0)

  const hoursSince = stats?.ultimoAviso
    ? (Date.now() - new Date(stats.ultimoAviso).getTime()) / 36e5
    : null
  const scraperActive = hoursSince !== null && hoursSince <= STALE_HOURS

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total de propiedades"
          icon={Building2}
          tone="gold"
          loading={loading}
          value={fmt(stats?.totalProps ?? 0)}
          hint={stats ? `+${fmt(stats.addedHoy)} hoy` : undefined}
          footerLabel="Ver propiedades"
          onFooterClick={() => onNavigate('propiedades')}
        />
        <StatCard
          label="Usuarios"
          icon={Users}
          tone="blue"
          loading={loading}
          value={fmt(stats?.totalUsers ?? 0)}
          footerLabel="Gestionar usuarios"
          onFooterClick={() => onNavigate('usuarios')}
        />
        <StatCard
          label="Suscripciones activas"
          icon={Crown}
          tone="green"
          loading={loading}
          value={fmt(stats?.subsActivas ?? 0)}
          footerLabel="Ver suscripciones"
          onFooterClick={() => onNavigate('usuarios')}
        />
        <StatCard
          label="Avisos nuevos (24 h)"
          icon={Activity}
          tone="amber"
          loading={loading}
          value={fmt(stats?.added24h ?? 0)}
          footerLabel="Ver actividad"
          onFooterClick={() => onNavigate('scraper')}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Gráfica de avisos por día */}
        <section className="card p-6">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text">Avisos nuevos</h2>
              <p className="text-sm text-text-muted">Últimos 30 días</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-gold" /> Avisos por día
              </span>
              <span className="flex items-center gap-2">
                <span className="h-0 w-4 border-t-2 border-dashed border-teal" /> Promedio
              </span>
            </div>
          </div>

          <div className="mt-4 h-[280px] w-full">
            {loading ? (
              <div className="skeleton size-full" />
            ) : series.length === 0 ? (
              <div className="flex size-full items-center justify-center text-sm text-text-faint">
                Sin datos
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgb(255 255 255 / 0.05)" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tickFormatter={shortDay}
                    interval={4}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgb(255 255 255 / 0.15)' }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-xl border border-line-strong bg-surface-3 px-3 py-2 text-xs shadow-xl">
                          <p className="text-text-muted">{shortDay(String(payload[0].payload.dia))}</p>
                          <p className="mono mt-0.5 text-sm font-semibold text-gold">
                            {fmt(Number(payload[0].value))} avisos
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <ReferenceLine y={average} stroke={TEAL} strokeDasharray="5 5" />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={GOLD}
                    strokeWidth={2}
                    fill="url(#goldFill)"
                    activeDot={{ r: 5, fill: GOLD, stroke: '#101216', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
            <div>
              <dt className="text-xs text-text-muted">Total (30 días)</dt>
              <dd className="mono mt-1 text-lg font-semibold text-text">{fmt(total30)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Promedio diario</dt>
              <dd className="mono mt-1 text-lg font-semibold text-text">
                {average.toLocaleString('es-PE', { maximumFractionDigits: 1 })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Día máximo</dt>
              <dd className="mono mt-1 text-lg font-semibold text-text">{fmt(peak)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          {/* Portales */}
          <section className="card p-6">
            <h2 className="text-base font-semibold text-text">Propiedades por portal</h2>
            <p className="text-sm text-text-muted">Distribución del catálogo</p>

            {loading ? (
              <div className="skeleton mt-5 h-44" />
            ) : portals.every(p => p.count === 0) ? (
              <p className="py-10 text-center text-sm text-text-faint">Sin datos</p>
            ) : (
              <>
                <div className="mx-auto mt-4 h-36 w-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portals.filter(p => p.count > 0)}
                        dataKey="count"
                        nameKey="label"
                        innerRadius="68%"
                        outerRadius="100%"
                        paddingAngle={3}
                        stroke="none"
                        cornerRadius={6}
                      >
                        {portals
                          .filter(p => p.count > 0)
                          .map(p => (
                            <Cell key={p.key} fill={p.color} />
                          ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="mt-5 space-y-3">
                  {portals.map(p => (
                    <li key={p.key} className="flex items-center gap-3 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="flex-1 text-text">{p.label}</span>
                      <span className="mono text-text-muted">{fmt(p.count)}</span>
                      <span className="mono w-10 text-right text-xs text-text-faint">{p.share}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Estado del scraper */}
          <section className="gold-gradient relative overflow-hidden rounded-[1.25rem] p-6 shadow-[0_24px_48px_-24px_rgb(212_183_130/0.55)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] opacity-75">
              <span className={cn('dot', scraperActive && 'dot-live')} />
              Estado del scraper
            </div>
            <p className="mt-3 font-display text-3xl font-semibold leading-tight">
              {loading ? '...' : scraperActive ? 'Activo' : 'Sin actividad'}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {stats?.ultimoAviso
                ? `Último aviso: ${formatDateTime(stats.ultimoAviso)}`
                : 'Aún no hay avisos cargados'}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('scraper')}
              className="btn btn-sm mt-5 bg-[#17130a] text-gold-strong hover:bg-black"
            >
              Ir a Actividad
              <ArrowRight className="size-4" />
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
