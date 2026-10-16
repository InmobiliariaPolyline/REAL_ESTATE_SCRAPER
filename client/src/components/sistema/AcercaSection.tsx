import {
  Bug,
  CalendarDays,
  ChevronDown,
  Database,
  GitCommitHorizontal,
  Layers,
  Rocket,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import AnimatedNumber from "@/components/common/AnimatedNumber"
import Logo from "@/components/common/Logo"
import StatCard from "@/components/common/StatCard"
import { TIPOS, VERSIONES, contarPorTipo, type CambioTipo } from "@/lib/changelog"
import { formatDate } from "@/lib/dates"
import { comprobarApi, type EstadoApi } from "@/lib/profile"
import { cn } from "@/lib/utils"

const TIPO_ESTILO: Record<CambioTipo, { icon: LucideIcon; badge: string }> = {
  implementacion: { icon: Rocket, badge: "badge-gold" },
  mejora: { icon: Sparkles, badge: "badge-blue" },
  correccion: { icon: Bug, badge: "badge-rose" },
  seguridad: { icon: ShieldCheck, badge: "badge-green" },
}

const TECNOLOGIAS: { nombre: string; detalle: string; icon: LucideIcon }[] = [
  { nombre: "React 19 + Vite", detalle: "Interfaz y compilación", icon: Layers },
  { nombre: "Tailwind CSS 4", detalle: "Sistema de diseño con tokens", icon: Wrench },
  { nombre: "Neon (PostgreSQL)", detalle: "Base de datos sin servidor", icon: Database },
  { nombre: "Netlify Functions", detalle: "API y despliegue", icon: Zap },
]

const FILTROS: ("todos" | CambioTipo)[] = ["todos", "implementacion", "mejora", "correccion", "seguridad"]

export default function AcercaSection() {
  const [estado, setEstado] = useState<EstadoApi | null>(null)
  const [comprobando, setComprobando] = useState(true)
  const [filtro, setFiltro] = useState<"todos" | CambioTipo>("todos")
  const [abierta, setAbierta] = useState<string | null>(VERSIONES[0].version)

  const verificar = useCallback(async () => {
    setComprobando(true)
    setEstado(await comprobarApi())
    setComprobando(false)
  }, [])

  useEffect(() => {
    verificar()
  }, [verificar])

  const conteo = useMemo(() => contarPorTipo(), [])
  const versiones = useMemo(
    () =>
      VERSIONES.map(v => ({
        ...v,
        cambios: filtro === "todos" ? v.cambios : v.cambios.filter(c => c.tipo === filtro),
      })).filter(v => v.cambios.length > 0),
    [filtro]
  )

  return (
    <div className="space-y-6">
      {/* Identidad */}
      <section className="card sheen relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <Logo />
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
              Plataforma de inteligencia inmobiliaria para el mercado peruano: reúne avisos, normaliza
              precios en soles y dólares y ofrece herramientas para comparar y decidir.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-surface-3 px-4 py-3">
              <dt className="flex items-center justify-center gap-1 text-[0.6875rem] uppercase tracking-wider text-text-muted">
                <Tag className="size-3" aria-hidden="true" /> Versión
              </dt>
              <dd className="mono mt-1 text-xl font-semibold text-gold">v{__APP_VERSION__}</dd>
            </div>
            <div className="rounded-2xl bg-surface-3 px-4 py-3">
              <dt className="flex items-center justify-center gap-1 text-[0.6875rem] uppercase tracking-wider text-text-muted">
                <GitCommitHorizontal className="size-3" aria-hidden="true" /> Compilación
              </dt>
              <dd className="mono mt-1 text-xl font-semibold text-text">{__BUILD_COMMIT__}</dd>
            </div>
            <div className="rounded-2xl bg-surface-3 px-4 py-3">
              <dt className="flex items-center justify-center gap-1 text-[0.6875rem] uppercase tracking-wider text-text-muted">
                <CalendarDays className="size-3" aria-hidden="true" /> Fecha
              </dt>
              <dd className="mono mt-1 text-sm font-semibold text-text">{formatDate(__BUILD_DATE__)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Totales */}
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Implementaciones" icon={Rocket} tone="gold" value={<AnimatedNumber value={conteo.implementacion} />} hint="funciones nuevas" />
        <StatCard label="Mejoras" icon={Sparkles} tone="blue" value={<AnimatedNumber value={conteo.mejora} />} hint="de uso, diseño y rendimiento" />
        <StatCard label="Correcciones" icon={Bug} tone="rose" value={<AnimatedNumber value={conteo.correccion} />} hint="errores resueltos" />
        <StatCard label="Seguridad" icon={ShieldCheck} tone="green" value={<AnimatedNumber value={conteo.seguridad} />} hint="protecciones añadidas" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Estado en vivo */}
        <section className="card p-6" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <Zap className="size-4 text-gold" aria-hidden="true" />
              Estado del sistema
            </h2>
            <button onClick={verificar} disabled={comprobando} className="btn btn-secondary btn-sm">
              <RefreshCw className={cn("size-3.5", comprobando && "animate-spin")} aria-hidden="true" />
              Comprobar
            </button>
          </div>

          {comprobando && !estado ? (
            <div className="skeleton mt-4 h-24" />
          ) : estado ? (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-surface-1 p-4">
              <span
                className={cn(
                  "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full ring-1",
                  estado.ok ? "bg-green/10 text-green ring-green/30" : "bg-rose/10 text-rose ring-rose/30"
                )}
              >
                {estado.ok && <span className="radar-ring absolute inset-0 rounded-full ring-1 ring-green/40" aria-hidden="true" />}
                {estado.ok ? <ShieldCheck className="size-6" aria-hidden="true" /> : <Bug className="size-6" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{estado.ok ? "Operativo" : "Con problemas"}</p>
                <p className="text-xs text-text-muted">{estado.mensaje}</p>
              </div>
              <span className="mono shrink-0 text-sm text-text-muted">{estado.ms} ms</span>
            </div>
          ) : null}
        </section>

        {/* Tecnologías */}
        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <Layers className="size-4 text-gold" aria-hidden="true" />
            Tecnologías
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {TECNOLOGIAS.map(t => {
              const Icon = t.icon
              return (
                <li key={t.nombre} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-1 p-3.5">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-gold">
                    <Icon className="size-[1.1rem]" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{t.nombre}</p>
                    <p className="truncate text-xs text-text-muted">{t.detalle}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {/* Historial de versiones */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <GitCommitHorizontal className="size-4 text-gold" aria-hidden="true" />
            Historial de versiones
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de cambio">
            {FILTROS.map(f => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200",
                  filtro === f
                    ? "border-gold bg-gold-soft text-gold"
                    : "border-line text-text-muted hover:border-line-strong hover:text-text"
                )}
              >
                {f === "todos" ? "Todos" : TIPOS[f].plural}
              </button>
            ))}
          </div>
        </div>

        <ol className="relative mt-6 space-y-4 border-l border-line pl-6">
          {versiones.map((v, i) => {
            const abiertaAhora = abierta === v.version || filtro !== "todos"
            return (
              <li key={v.version} className="animate-timeline relative" style={{ animationDelay: `${i * 70}ms` }}>
                <span
                  className={cn(
                    "absolute -left-[1.9375rem] top-1.5 size-3 rounded-full border-2 border-surface-2",
                    i === 0 ? "bg-gold" : "bg-surface-4"
                  )}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => setAbierta(abierta === v.version ? null : v.version)}
                  aria-expanded={abiertaAhora}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className={cn("badge mono", i === 0 ? "badge-gold" : "badge-muted")}>v{v.version}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{v.titulo}</span>
                    <span className="block text-xs text-text-faint">{formatDate(v.fecha)}</span>
                  </span>
                  <ChevronDown
                    className={cn("size-4 shrink-0 text-text-muted transition-transform duration-300", abiertaAhora && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    abiertaAhora ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <ul className="space-y-2 overflow-hidden">
                    {v.cambios.map((c, j) => {
                      const est = TIPO_ESTILO[c.tipo]
                      const Icon = est.icon
                      return (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-text-muted">
                          <span className={cn("badge mt-0.5 shrink-0 !px-2 !py-1", est.badge)} title={TIPOS[c.tipo].label}>
                            <Icon className="size-3" aria-hidden="true" />
                            <span className="sr-only">{TIPOS[c.tipo].label}:</span>
                          </span>
                          <span>{c.texto}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
