import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CloudDownload,
  Gauge,
  Loader2,
  Play,
  Save,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import AnimatedNumber from "@/components/common/AnimatedNumber"
import ConfirmModal from "@/components/common/ConfirmModal"
import EmptyState from "@/components/common/EmptyState"
import ProgressRing from "@/components/common/ProgressRing"
import Switch from "@/components/common/Switch"
import { useToast } from "@/contexts/ToastContext"
import { timeAgo } from "@/lib/account"
import { ApiError } from "@/lib/api"
import {
  costoEstimadoUsd,
  fetchCarga,
  runCarga,
  saveCarga,
  type Corrida,
  type EstadoCarga,
  type FuenteId,
} from "@/lib/carga"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

const ESTADO: Record<Corrida["estado"], { label: string; badge: string; icon: LucideIcon }> = {
  iniciada: { label: "En curso", badge: "badge-blue", icon: Clock },
  completada: { label: "Completada", badge: "badge-green", icon: CheckCircle2 },
  fallida: { label: "Fallida", badge: "badge-rose", icon: XCircle },
}

const BARRERAS = [
  "Sin tarjeta en Apify: el plan gratuito se bloquea al agotarse el crédito, no cobra.",
  "Solo se planea usar el 90 % del crédito gratuito del ciclo; el resto queda de colchón.",
  "El ciclo, el crédito y el gasto se leen de tu cuenta de Apify: no hay que escribirlos.",
  "Cada corrida envía a Apify un máximo de avisos y un máximo en dólares.",
  "El tope se reserva antes de pedir nada, así que no se puede rebasar.",
  "Una sola corrida a la vez, y la carga empieza pausada hasta que la actives.",
]

/** Indica quién maneja cada valor: lo trae Apify, lo edita el administrador o se hace a mano. */
function Etiqueta({ tipo }: { tipo: "Automático" | "Editable" | "Manual" }) {
  const estilo = tipo === "Automático" ? "badge-blue" : tipo === "Editable" ? "badge-gold" : "badge-muted"
  return <span className={cn("badge !px-2 !py-0.5 !text-[0.6875rem]", estilo)}>{tipo}</span>
}

const usd = (n: number) => `US$ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CargaSection() {
  const [estado, setEstado] = useState<EstadoCarga | null>(null)
  const [loading, setLoading] = useState(true)
  const [tope, setTope] = useState("")
  const [maximo, setMaximo] = useState("")
  const [topeUrb, setTopeUrb] = useState("")
  const [fuenteElegida, setFuenteElegida] = useState<"auto" | FuenteId>("auto")
  const [guardando, setGuardando] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [lanzando, setLanzando] = useState(false)
  const { addToast } = useToast()

  const cargar = useCallback(async () => {
    try {
      const e = await fetchCarga()
      setEstado(e)
      setTope(String(e.config.tope_mensual))
      setMaximo(String(e.config.maximo_por_corrida))
      setTopeUrb(String(e.config.tope_urbania ?? 200))
    } catch (err) {
      console.error(err)
      addToast("No se pudo cargar el estado de la carga de datos", "error")
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    cargar()
  }, [cargar])

  const topeNum = Number(tope)
  const maxNum = Number(maximo)
  const lim = estado?.limites
  const urbania = estado?.fuentes?.find(f => f.id === "urbania")
  const topeUrbNum = Number(topeUrb)
  const validoUrb = !urbania || (Number.isInteger(topeUrbNum) && topeUrbNum >= 0 && topeUrbNum <= urbania.tope_maximo)
  const valido =
    !!lim &&
    validoUrb &&
    Number.isInteger(topeNum) && topeNum >= 0 && topeNum <= lim.tope_mensual &&
    Number.isInteger(maxNum) && maxNum >= 1 && maxNum <= lim.maximo_por_corrida
  const sinCambios = estado
    ? topeNum === estado.config.tope_mensual &&
      maxNum === estado.config.maximo_por_corrida &&
      (!urbania || topeUrbNum === (estado.config.tope_urbania ?? 200))
    : true

  const tapa = estado ? Math.min(estado.config.tope_mensual, estado.limites.tope_mensual) : 0
  const fraccion = tapa > 0 ? Math.min(1, (estado?.usado ?? 0) / tapa) : 0
  const colorAnillo = fraccion >= 1 ? "text-rose" : fraccion >= 0.8 ? "text-amber" : "text-gold"
  const costoMil = estado?.credito.costo_por_mil ?? 3
  // Fuentes que se cargarían: la elegida o todas (las que están en curso no cuentan).
  const objetivo = useMemo(() => {
    const fuentes = estado?.fuentes
    if (!fuentes) return null
    const libres = fuentes.filter(f => !estado.corridas.some(c => c.estado === "iniciada" && c.fuente === f.id))
    return fuenteElegida === "auto" ? libres : libres.filter(f => f.id === fuenteElegida)
  }, [estado, fuenteElegida])
  const aPedir = useMemo(() => {
    if (!estado) return 0
    if (objetivo) return objetivo.reduce((n, f) => n + Math.max(0, Math.min(f.maximo_por_corrida, f.restante)), 0)
    return Math.max(0, Math.min(estado.config.maximo_por_corrida, estado.restante))
  }, [estado, objetivo])

  const guardarTopes = async () => {
    if (!valido) return
    setGuardando(true)
    try {
      await saveCarga({ tope_mensual: topeNum, maximo_por_corrida: maxNum, ...(urbania ? { tope_urbania: topeUrbNum } : {}) })
      addToast("Topes guardados", "success")
      await cargar()
    } catch (err) {
      addToast(err instanceof ApiError && err.message ? err.message : "No se pudieron guardar los topes", "error")
    } finally {
      setGuardando(false)
    }
  }

  const cambiarPausa = async (activa: boolean) => {
    setCambiando(true)
    try {
      await saveCarga({ pausada: !activa })
      addToast(activa ? "Carga automática activada" : "Carga automática pausada", activa ? "success" : "info")
      await cargar()
    } catch (err) {
      addToast(err instanceof ApiError && err.message ? err.message : "No se pudo cambiar el estado", "error")
    } finally {
      setCambiando(false)
    }
  }

  const cargarAhora = async () => {
    setLanzando(true)
    try {
      const r = await runCarga(fuenteElegida === "auto" ? undefined : fuenteElegida)
      const fuentes = r.lanzadas && r.lanzadas.length > 1 ? ` (${r.lanzadas.map(l => nombreFuente(l.fuente)).join(" y ")})` : ""
      addToast(`Carga iniciada${fuentes}: hasta ${r.items} avisos. Llegarán en unos minutos.`, "success")
      setConfirmar(false)
      await cargar()
    } catch (err) {
      addToast(err instanceof ApiError && err.message ? err.message : "No se pudo iniciar la carga", "error")
      setConfirmar(false)
    } finally {
      setLanzando(false)
    }
  }

  if (loading) return <div className="skeleton h-96" aria-busy="true" />
  if (!estado) {
    return <EmptyState icon={AlertTriangle} title="No se pudo cargar" description="Vuelve a intentarlo en un momento." />
  }

  const activa = !estado.config.pausada
  const nombreFuente = (id?: FuenteId) => (id === "urbania" ? "Urbania" : "Adondevivir")
  const enCurso = objetivo ? objetivo.length === 0 : estado.corridas.some(c => c.estado === "iniciada")
  const puedeLanzar = estado.configurada && aPedir > 0 && !enCurso

  return (
    <div className="space-y-6">
      {!estado.configurada && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/10 px-5 py-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden="true" />
          <div className="text-sm text-amber">
            <p className="font-semibold">Falta conectar Apify en el servidor.</p>
            <p className="mt-1 text-amber/90">
              En Netlify (Environment variables) crea <code className="mono">APIFY_TOKEN</code> y{" "}
              <code className="mono">APIFY_WEBHOOK_SECRET</code> como secretas y vuelve a desplegar. Mientras tanto, nada se
              ejecuta.
            </p>
          </div>
        </div>
      )}

      <div className="stagger grid gap-6 xl:grid-cols-[auto_minmax(0,1fr)]">
        {/* Estado del ciclo */}
        <section className="card flex flex-col items-center p-6 text-center">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <Gauge className="size-4 text-gold" aria-hidden="true" />
            Uso del ciclo
          </h2>
          <ProgressRing
            value={fraccion}
            size={156}
            stroke={12}
            className={cn("mt-5", colorAnillo)}
            label={`${estado.usado} de ${tapa} avisos usados en este ciclo`}
          >
            <span className="mono text-3xl font-semibold leading-none text-text">
              <AnimatedNumber value={estado.usado} />
            </span>
            <span className="mt-1 text-xs text-text-muted">de {tapa.toLocaleString("es-PE")}</span>
          </ProgressRing>
          <p className="mt-4 text-sm text-text-muted">
            Quedan <strong className="mono text-text">{estado.restante.toLocaleString("es-PE")}</strong> avisos en este ciclo
          </p>

          {estado.fuentes && estado.fuentes.length > 1 && (
            <ul className="mt-4 w-full space-y-1.5 border-t border-line pt-4 text-left text-xs" aria-label="Uso por fuente">
              {estado.fuentes.map(f => (
                <li key={f.id} className="flex items-center justify-between gap-3">
                  <span className="text-text-muted">{f.nombre}</span>
                  <span className="mono text-text">
                    {f.usado.toLocaleString("es-PE")} / {f.tope.toLocaleString("es-PE")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-4 w-full space-y-2 border-t border-line pt-4 text-left text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">
                {estado.origen_datos === "apify" ? "Gasto real en Apify" : "Gasto estimado"}
              </dt>
              <dd className="mono text-text">
                {usd(estado.credito.gasto_usd)} de {usd(estado.credito.usd)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1 text-text-muted">
                <CalendarClock className="size-3" aria-hidden="true" /> Reinicio del crédito
              </dt>
              <dd className="mono text-text">{formatDate(estado.ventana.reinicia)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">Origen de estos datos</dt>
              <dd>
                <Etiqueta tipo="Automático" />
              </dd>
            </div>
          </dl>
          {estado.origen_datos === "estimado" && (
            <p className="mt-3 text-xs text-amber">
              No se pudo consultar a Apify: se muestran estimaciones prudentes hasta que responda.
            </p>
          )}
        </section>

        <div className="space-y-6">
          {/* Interruptor y acción */}
          <section className="card p-6">
            <div className="flex flex-wrap items-center gap-4">
              <span
                className={cn(
                  "inline-flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1",
                  activa ? "bg-green/10 text-green ring-green/25" : "bg-surface-3 text-text-muted ring-line"
                )}
              >
                <CloudDownload className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-text">
                  Carga automática de avisos <Etiqueta tipo="Editable" />
                </h2>
                <p className="text-sm text-text-muted">
                  {activa
                    ? "Activa: lunes y jueves (09:00, Lima) pide una tanda de cada fuente, dentro de su tope."
                    : "Pausada: no se pide nada hasta que la actives."}
                </p>
              </div>
              <span className={cn("badge", activa ? "badge-green" : "badge-muted")}>{activa ? "Activa" : "Pausada"}</span>
              <Switch
                label="Carga automática"
                checked={activa}
                disabled={cambiando || !estado.configurada}
                onChange={cambiarPausa}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button onClick={() => setConfirmar(true)} disabled={!puedeLanzar || lanzando} className="btn btn-primary">
                {lanzando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" aria-hidden="true" />}
                Cargar ahora
              </button>
              <Etiqueta tipo="Manual" />
              {estado.fuentes && estado.fuentes.length > 1 && (
                <select
                  aria-label="Fuente a cargar"
                  value={fuenteElegida}
                  onChange={e => setFuenteElegida(e.target.value as "auto" | FuenteId)}
                  className="field !w-auto"
                >
                  <option value="auto">Todas las fuentes</option>
                  {estado.fuentes.map(f => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-text-muted">
                {puedeLanzar
                  ? `Pediría hasta ${aPedir.toLocaleString("es-PE")} avisos (≈ ${usd(costoEstimadoUsd(aPedir, costoMil))}).`
                  : !estado.configurada
                    ? "Conecta Apify para poder cargar."
                    : enCurso
                      ? "Hay una carga en curso."
                      : "Sin cupo en este ciclo."}
              </p>
            </div>
          </section>

          {/* Topes */}
          <section className="card p-6">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-text">
              <CircleDollarSign className="size-4 text-gold" aria-hidden="true" />
              Tope de avisos por ciclo <Etiqueta tipo="Editable" />
            </h2>
            <div className="mt-4 max-w-md">
              <label htmlFor="carga-tope" className="field-label">Tope mensual (avisos)</label>
              <input
                id="carga-tope"
                inputMode="numeric"
                value={tope}
                onChange={e => setTope(e.target.value.replace(/\D/g, ""))}
                className="field mono"
                aria-invalid={tope !== "" && !(topeNum >= 0 && topeNum <= (lim?.tope_mensual ?? 0))}
              />
              <p className="field-hint">
                Máximo permitido: {lim?.tope_mensual.toLocaleString("es-PE")} (90 % del crédito de tu cuenta). Con este tope: hasta ≈{" "}
                {usd(costoEstimadoUsd(topeNum || 0, costoMil))} por ciclo.
              </p>
            </div>

            {urbania && (
              <div className="mt-4 max-w-md">
                <label htmlFor="carga-tope-urbania" className="field-label">Tope de Urbania (avisos)</label>
                <input
                  id="carga-tope-urbania"
                  inputMode="numeric"
                  value={topeUrb}
                  onChange={e => setTopeUrb(e.target.value.replace(/\D/g, ""))}
                  className="field mono"
                  aria-invalid={topeUrb !== "" && !validoUrb}
                />
                <p className="field-hint">
                  Máximo {urbania.tope_maximo.toLocaleString("es-PE")}; hasta {urbania.maximo_por_corrida} por corrida. Urbania cobra US$ 0.015 por corrida y ≈ US$ 6 por 1 000 avisos.
                </p>
              </div>
            )}

            <details className="mt-4 rounded-2xl border border-line bg-surface-1 p-4">
              <summary className="cursor-pointer text-sm font-medium text-text-muted">Opciones avanzadas</summary>
              <div className="mt-4 max-w-md">
                <label htmlFor="carga-max" className="field-label">Máximo por corrida (avisos)</label>
                <input
                  id="carga-max"
                  inputMode="numeric"
                  value={maximo}
                  onChange={e => setMaximo(e.target.value.replace(/\D/g, ""))}
                  className="field mono"
                  aria-invalid={maximo !== "" && !(maxNum >= 1 && maxNum <= (lim?.maximo_por_corrida ?? 0))}
                />
                <p className="field-hint">
                  Entre 1 y {lim?.maximo_por_corrida.toLocaleString("es-PE")}. Úsalo en 20 para la primera prueba.
                </p>
              </div>
            </details>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-text-faint">
                El actor cuesta ≈ {usd(estado.credito.costo_por_mil)} por 1 000 avisos y el uso de plataforma va incluido.
              </p>
              <button onClick={guardarTopes} disabled={!valido || sinCambios || guardando} className="btn btn-secondary btn-sm">
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" aria-hidden="true" />}
                Guardar topes
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Historial */}
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-6 py-4">
          <CalendarClock className="size-4 text-gold" aria-hidden="true" />
          <h2 className="text-base font-semibold text-text">Últimas cargas</h2>
        </div>
        {estado.corridas.length === 0 ? (
          <EmptyState icon={CloudDownload} title="Aún no hay cargas" description="Cuando se ejecute la primera aparecerá aquí." />
        ) : (
          <ul className="divide-y divide-line">
            {estado.corridas.map(c => {
              const est = ESTADO[c.estado]
              const Icon = est.icon
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
                  <span className={cn("badge", est.badge)}>
                    <Icon className="size-3.5" aria-hidden="true" />
                    {est.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">
                      <span className="mono font-semibold">{c.avisos_recibidos ?? "?"}</span> recibidos
                      <span className="text-text-muted"> de {c.avisos_pedidos} pedidos</span>
                      {c.avisos_guardados !== null && <span className="text-text-muted"> · {c.avisos_guardados} guardados</span>}
                    </p>
                    <p className="text-xs text-text-muted">
                      {c.fuente ? `${nombreFuente(c.fuente)} · ` : ""}
                      {c.origen === "programada" ? "Programada" : `Manual${c.iniciada_por ? ` · ${c.iniciada_por}` : ""}`}
                      {c.actor ? ` · actor ${c.actor.split("~")[0]}` : ""}
                      {c.detalle ? ` · ${c.detalle}` : ""}
                    </p>
                  </div>
                  <time className="mono shrink-0 text-xs text-text-muted" dateTime={c.iniciada_en}>
                    {timeAgo(c.iniciada_en)}
                  </time>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Cómo se protege el presupuesto */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text">
          <ShieldCheck className="size-4 text-green" aria-hidden="true" />
          Cómo se protege tu presupuesto
        </h2>
        <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
          {BARRERAS.map(b => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-text-muted">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
              {b}
            </li>
          ))}
        </ul>
      </section>

      {confirmar && (
        <ConfirmModal
          title="¿Cargar avisos ahora?"
          confirmLabel="Cargar"
          busyLabel="Iniciando..."
          busy={lanzando}
          onConfirm={cargarAhora}
          onCancel={() => setConfirmar(false)}
        >
          Se pedirán hasta <strong>{aPedir.toLocaleString("es-PE")}</strong> avisos a Apify (≈ {usd(costoEstimadoUsd(aPedir, costoMil))}){fuenteElegida === "auto" ? ", repartidos entre todas las fuentes" : ` de ${nombreFuente(fuenteElegida)}`}.
          Contarán contra el tope de este ciclo.
        </ConfirmModal>
      )}
    </div>
  )
}
