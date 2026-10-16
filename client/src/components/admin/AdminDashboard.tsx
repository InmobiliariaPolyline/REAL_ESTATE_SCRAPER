import { Activity, AlertTriangle, Building2, CalendarClock, Crown, MessageCircle, RefreshCw, Users } from 'lucide-react'
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
import AnimatedNumber from '@/components/common/AnimatedNumber'
import StatCard from '@/components/common/StatCard'
import { useToast } from '@/contexts/ToastContext'
import { timeAgo } from '@/lib/account'
import { api } from '@/lib/api'
import { mensajeRenovacion, whatsappLink, type PorVencer } from '@/lib/insights'
import { formatDateTime } from '@/lib/dates'
import { PORTALS } from '@/lib/portals'
import { cn } from '@/lib/utils'
import type { AdminTab } from './tabs'

/** Cada cuánto se refrescan las métricas mientras el panel está visible. */
const REFRESH_MS = 30_000

/** Horas sin avisos nuevos a partir de las cuales se considera sin actividad la carga de datos. */
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
  porVencer: PorVencer[]
}

const GOLD = 'var(--gold)'
const TEAL = 'var(--teal)'

const fmt = (n: number) => n.toLocaleString('es-PE')

/** "2026-10-16" -> "16/10" */
const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

interface DashboardProps {
  onNavigate: (tab: AdminTab) => void
}

export default function AdminDashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const { addToast } = useToast()

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      try {
        setStats(await api.get<Stats>('/admin/stats'))
        setUpdatedAt(Date.now())
      } catch (err) {
        // Los refrescos automáticos fallan en silencio: se conserva lo último mostrado.
        if (!silent) addToast('Error al cargar métricas', 'error')
        console.error(err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [addToast]
  )

  useEffect(() => {
    load()
  }, [load])

  // Reloj de 1 s (tiempos relativos "en vivo") y refresco periódico mientras la pestaña esté visible.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const refresh = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(tick)
      clearInterval(refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
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
    ? (now - new Date(stats.ultimoAviso).getTime()) / 36e5
    : null

  // Series para las mini gráficas de las tarjetas.
  const dailySeries = series.slice(-14).map(d => d.total)
  const cumulativeSeries = (() => {
    const base = (stats?.totalProps ?? 0) - total30
    let acc = base
    return series.slice(-14).map(d => (acc += d.total))
  })()
  const dataFresh = hoursSince !== null && hoursSince <= STALE_HOURS

  return (
    <div className="space-y-6">
      {/* Aviso: dejaron de llegar avisos nuevos */}
      {!loading && stats?.ultimoAviso && !dataFresh && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/30 bg-amber/10 px-5 py-4"
        >
          <p className="flex items-center gap-3 text-sm text-amber">
            <AlertTriangle className="size-5 shrink-0" />
            Llevan {Math.floor(hoursSince ?? 0)} h sin llegar avisos nuevos.
            Revisa la fuente que carga los datos.
          </p>
        </div>
      )}

      {/* Indicador en vivo */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
        <span className="flex items-center gap-2">
          <span className="live-dot" aria-hidden="true" />
          <span className="font-semibold uppercase tracking-[0.12em] text-green">En vivo</span>
          <span aria-live="off">
            {updatedAt ? `actualizado ${timeAgo(new Date(updatedAt).toISOString(), now)}` : 'cargando...'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn btn-ghost btn-sm"
          aria-label="Actualizar métricas ahora"
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {/* Métricas */}
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total de propiedades"
          icon={Building2}
          tone="gold"
          loading={loading}
          value={<AnimatedNumber value={stats?.totalProps ?? 0} />}
          spark={cumulativeSeries}
          hint={stats ? `+${fmt(stats.addedHoy)} hoy` : undefined}
          footerLabel="Ver propiedades"
          onFooterClick={() => onNavigate('propiedades')}
        />
        <StatCard
          label="Usuarios"
          icon={Users}
          tone="blue"
          loading={loading}
          value={<AnimatedNumber value={stats?.totalUsers ?? 0} />}
          footerLabel="Gestionar usuarios"
          onFooterClick={() => onNavigate('usuarios')}
        />
        <StatCard
          label="Suscripciones activas"
          icon={Crown}
          tone="green"
          loading={loading}
          value={<AnimatedNumber value={stats?.subsActivas ?? 0} />}
          footerLabel="Ver suscripciones"
          onFooterClick={() => onNavigate('usuarios')}
        />
        <StatCard
          label="Avisos nuevos (24 h)"
          icon={Activity}
          tone="amber"
          loading={loading}
          value={<AnimatedNumber value={stats?.added24h ?? 0} />}
          spark={dailySeries}
        />
      </div>

      <div className="stagger grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tickFormatter={shortDay}
                    interval={4}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--line-strong)' }}
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
                    activeDot={{ r: 5, fill: GOLD, stroke: 'var(--app)', strokeWidth: 2 }}
                    isAnimationActive
                    animationDuration={1500}
                    animationEasing="ease-out"
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
                        isAnimationActive
                        animationBegin={150}
                        animationDuration={1200}
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
                    <li key={p.key} className="text-sm">
                      <div className="flex items-center gap-3">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                        <span className="flex-1 text-text">{p.label}</span>
                        <span className="mono text-text-muted">{fmt(p.count)}</span>
                        <span className="mono w-10 text-right text-xs text-text-faint">{p.share}%</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                        <div
                          key={`${p.key}-${p.share}`}
                          className="bar-grow h-full rounded-full"
                          style={{ width: `${p.share}%`, background: p.color }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Suscripciones por vencer */}
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <CalendarClock className="size-4 text-amber" aria-hidden="true" />
              Vencimientos
            </h2>
            <p className="text-sm text-text-muted">Próximos 7 días y vencidos recientes</p>

            {loading ? (
              <div className="skeleton mt-4 h-24" />
            ) : !stats || stats.porVencer.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-faint">Nadie vence esta semana</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {stats.porVencer.map(v => (
                  <li key={v.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{v.usuario}</p>
                      <p className="mono text-xs text-text-muted">
                        {v.fecha_vencimiento.split('-').reverse().join('/')}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'badge',
                        v.dias < 0 ? 'badge-rose' : v.dias <= 2 ? 'badge-gold' : 'badge-muted'
                      )}
                    >
                      {v.dias < 0
                        ? `venció hace ${-v.dias} d`
                        : v.dias === 0
                          ? 'vence hoy'
                          : `en ${v.dias} d`}
                    </span>
                    <a
                      href={whatsappLink(mensajeRenovacion(v.usuario, v.fecha_vencimiento, v.dias))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-icon btn-sm text-green"
                      aria-label={`Recordar la renovación a ${v.usuario} por WhatsApp`}
                      title="Recordar por WhatsApp"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Estado de la carga de datos */}
          <section className="gold-gradient sheen relative overflow-hidden rounded-[1.25rem] p-6 shadow-[0_24px_48px_-24px_rgb(var(--gold-rgb)/0.55)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] opacity-75">
              <span className="relative inline-flex">
                <span className={cn('dot', dataFresh && 'dot-live')} />
                {dataFresh && (
                  <span className="radar-ring absolute inset-0 rounded-full bg-current opacity-40" aria-hidden="true" />
                )}
              </span>
              Carga de datos
            </div>
            <p className="mt-3 font-display text-3xl font-semibold leading-tight">
              {loading ? '...' : dataFresh ? 'Al día' : 'Sin novedades'}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {stats?.ultimoAviso
                ? `Último aviso ${timeAgo(stats.ultimoAviso, now)} (${formatDateTime(stats.ultimoAviso)})`
                : 'Aún no hay avisos cargados'}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
