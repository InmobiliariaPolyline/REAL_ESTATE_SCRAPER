import { AlertTriangle, Bot, CheckCircle2, Clock, ExternalLink, Loader2, Play, RefreshCw, XCircle, type LucideIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import ConfirmModal from "@/components/common/ConfirmModal"
import { useToast } from "@/contexts/ToastContext"
import { timeAgo } from "@/lib/account"
import { ApiError } from "@/lib/api"
import { fetchScraperPropio, runScraperPropio, type EjecucionScraper, type EstadoEjecucion, type EstadoScraperPropio } from "@/lib/carga"
import { cn } from "@/lib/utils"

const ESTADO: Record<EstadoEjecucion, { label: string; badge: string; icon: LucideIcon }> = {
  en_cola: { label: "En cola", badge: "badge-blue", icon: Clock },
  en_curso: { label: "En curso", badge: "badge-blue", icon: Loader2 },
  completada: { label: "Completada", badge: "badge-green", icon: CheckCircle2 },
  fallida: { label: "Fallida", badge: "badge-rose", icon: XCircle },
  cancelada: { label: "Cancelada", badge: "badge-muted", icon: XCircle },
}

const activa = (e: EjecucionScraper) => e.estado === "en_cola" || e.estado === "en_curso"

/** Carga con el scraper propio (GitHub Actions): botón para ejecutarlo, cobertura por entidad y últimas ejecuciones. */
export default function ScraperPropioCard() {
  const [estado, setEstado] = useState<EstadoScraperPropio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState(false)
  const [paginas, setPaginas] = useState("5")
  const [confirmar, setConfirmar] = useState(false)
  const [lanzando, setLanzando] = useState(false)
  const { addToast } = useToast()

  const cargar = useCallback(async () => {
    try {
      const e = await fetchScraperPropio()
      setEstado(e)
      setPaginas(p => (p === "" ? String(e.paginas.por_defecto) : p))
      setFallo(false)
    } catch (err) {
      console.error(err)
      setFallo(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const hayActiva = !!estado?.ejecuciones.some(activa)
  // Mientras hay una ejecución en curso se actualiza solo cada 15 segundos.
  useEffect(() => {
    if (!hayActiva) return
    const t = setInterval(cargar, 15_000)
    return () => clearInterval(t)
  }, [hayActiva, cargar])

  if (cargando) return <div className="skeleton h-40" aria-busy="true" />
  if (fallo || !estado) {
    return (
      <section className="card flex items-center gap-3 p-6 text-sm text-text-muted">
        <AlertTriangle className="size-5 text-amber" aria-hidden="true" />
        No se pudo consultar el scraper propio. Vuelve a intentarlo en un momento.
      </section>
    )
  }

  const max = estado.paginas.maximo
  const n = Number(paginas)
  const paginasValidas = Number.isInteger(n) && n >= 1 && n <= max
  const puedeLanzar = estado.configurado && !estado.error && paginasValidas && !hayActiva

  const ejecutar = async () => {
    setLanzando(true)
    try {
      await runScraperPropio(n)
      addToast("Scraper iniciado en GitHub. En unos segundos aparecerá «En cola» y tarda varios minutos.", "success")
      setConfirmar(false)
      // GitHub tarda un instante en mostrar la ejecución nueva.
      setTimeout(cargar, 4000)
    } catch (err) {
      addToast(err instanceof ApiError && err.message ? err.message : "No se pudo iniciar el scraper", "error")
      setConfirmar(false)
    } finally {
      setLanzando(false)
    }
  }

  return (
    <section className="card p-6" aria-labelledby="scraper-propio-titulo">
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/25">
          <Bot className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="scraper-propio-titulo" className="text-base font-semibold text-text">
            Scraper propio
          </h2>
          <p className="text-sm text-text-muted">
            Lee los listados públicos directamente, sin Apify y sin costo. Corre en GitHub: lunes y jueves solo, o ahora con el botón.
          </p>
        </div>
        <button onClick={cargar} className="btn btn-secondary btn-sm btn-icon" aria-label="Actualizar estado">
          <RefreshCw className="size-4" aria-hidden="true" />
        </button>
      </div>

      {!estado.configurado && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden="true" />
          <p className="text-sm text-amber">
            Falta conectar GitHub. En Netlify (Environment variables) crea <code className="mono">GITHUB_TOKEN</code> (token de solo este
            repositorio con permiso «Actions: lectura y escritura», secreta) y <code className="mono">GITHUB_REPO</code> (
            <code className="mono">usuario/repositorio</code>) y vuelve a desplegar.
          </p>
        </div>
      )}
      {estado.error && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3">
          <XCircle className="mt-0.5 size-5 shrink-0 text-rose" aria-hidden="true" />
          <p className="text-sm text-rose">{estado.error}</p>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-text">Qué entidades cubre</h3>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line" aria-label="Cobertura por entidad">
            {estado.fuentes.map(f => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="font-medium text-text">{f.nombre}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("badge !text-[0.6875rem]", f.propio ? "badge-green" : "badge-muted")}>
                    {f.propio ? "Scraper propio" : "Scraper propio: bloqueado"}
                  </span>
                  {f.apify && <span className="badge badge-blue !text-[0.6875rem]">Apify · {f.busquedas_apify} búsquedas</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-faint">
            Urbania, Adondevivir y Properati bloquean (403) las lecturas automáticas directas; esas entidades se cargan con Apify, con todas sus
            direcciones de venta, alquiler y tipo.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text">Últimas ejecuciones</h3>
          {estado.ejecuciones.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-line px-4 py-3 text-sm text-text-muted">Aún no hay ejecuciones.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
              {estado.ejecuciones.map(e => {
                const est = ESTADO[e.estado]
                const Icon = est.icon
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className={cn("badge", est.badge)}>
                      <Icon className={cn("size-3.5", e.estado === "en_curso" && "animate-spin")} aria-hidden="true" />
                      {est.label}
                    </span>
                    <span className="flex-1 text-xs text-text-muted">{e.origen === "programada" ? "Programada" : "Manual"}</span>
                    <time className="mono text-xs text-text-muted" dateTime={e.iniciada_en}>
                      {e.iniciada_en ? timeAgo(e.iniciada_en) : ""}
                    </time>
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-gold" aria-label="Ver en GitHub">
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button onClick={() => setConfirmar(true)} disabled={!puedeLanzar || lanzando} className="btn btn-primary">
          {lanzando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" aria-hidden="true" />}
          Ejecutar scraper propio
        </button>
        <div className="flex items-center gap-2">
          <label htmlFor="scraper-paginas" className="text-xs text-text-muted">
            Páginas por búsqueda
          </label>
          <input
            id="scraper-paginas"
            inputMode="numeric"
            value={paginas}
            onChange={e => setPaginas(e.target.value.replace(/\D/g, ""))}
            className="field mono !w-20"
            aria-invalid={paginas !== "" && !paginasValidas}
          />
        </div>
        <p className="text-xs text-text-muted">
          {!estado.configurado
            ? "Conecta GitHub para poder ejecutarlo."
            : hayActiva
              ? "Hay una ejecución en curso."
              : paginasValidas
                ? `Cada página trae 21 avisos; con ${n} página${n === 1 ? "" : "s"} por búsqueda tarda unos ${Math.max(2, Math.round(n * 1.8))} minutos o más.`
                : `Elige entre 1 y ${max} páginas.`}
        </p>
      </div>

      {confirmar && (
        <ConfirmModal
          title="¿Ejecutar el scraper propio?"
          confirmLabel="Ejecutar"
          busyLabel="Iniciando..."
          busy={lanzando}
          onConfirm={ejecutar}
          onCancel={() => setConfirmar(false)}
        >
          Se leerán hasta <strong>{n}</strong> página{n === 1 ? "" : "s"} de cada búsqueda de InfoCasas (venta y alquiler, todos los tipos, Lima y
          provincias) y los avisos se guardarán sin duplicar. No usa créditos de Apify.
        </ConfirmModal>
      )}
    </section>
  )
}
