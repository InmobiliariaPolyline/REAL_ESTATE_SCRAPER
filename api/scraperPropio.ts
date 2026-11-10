// Scraper propio: lo ejecuta GitHub Actions (.github/workflows/scraper.yml) y este módulo solo lo lanza y consulta
// su estado desde el panel. Netlify no puede correr un scraper de varios minutos, y así tampoco hace falta ningún
// computador encendido.
//
// Variables (Netlify, solo servidor):
//   GITHUB_TOKEN  token fine-grained solo de este repositorio, con «Actions: lectura y escritura»
//   GITHUB_REPO   «usuario/repositorio», p. ej. InmobiliariaPolyline/REAL_ESTATE_SCRAPER
import type { ApiEnv } from "./env"

const API = "https://api.github.com"
const ARCHIVO_WORKFLOW = "scraper.yml"
const RAMA = "main"
export const PAGINAS_POR_DEFECTO = 5
export const PAGINAS_MAXIMAS = 25

export type EstadoEjecucion = "en_cola" | "en_curso" | "completada" | "fallida" | "cancelada"

export interface EjecucionScraper {
  id: number
  estado: EstadoEjecucion
  /** `manual` (botón o GitHub) o `programada` (lunes y jueves). */
  origen: "manual" | "programada"
  url: string
  iniciada_en: string
  actualizada_en: string
}

export interface ConfigGithub {
  token: string
  repo: string
}

/** Token y repositorio válidos del entorno; `null` si falta alguno o el repositorio está mal escrito. */
export function githubDe(env: ApiEnv): ConfigGithub | null {
  const token = (env.GITHUB_TOKEN ?? "").trim()
  const repo = (env.GITHUB_REPO ?? "").trim()
  return token.length >= 20 && /^[\w.-]+\/[\w.-]+$/.test(repo) ? { token, repo } : null
}

/** Estado de una ejecución de GitHub Actions (`status` + `conclusion`) en palabras del panel. */
export function estadoDeEjecucion(status: string | null | undefined, conclusion: string | null | undefined): EstadoEjecucion {
  if (status === "completed") {
    if (conclusion === "success") return "completada"
    return conclusion === "cancelled" ? "cancelada" : "fallida"
  }
  return status === "in_progress" ? "en_curso" : "en_cola"
}

const cabeceras = (cfg: ConfigGithub) => ({
  Authorization: `Bearer ${cfg.token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "inmobiliaria-panel",
})

export class ErrorGithub extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/** Mensaje claro para el administrador según lo que respondió GitHub. */
function mensajeDe(status: number): string {
  if (status === 401) return "GitHub rechazó el token: revisa GITHUB_TOKEN (puede haber vencido)."
  if (status === 403) return "El token no tiene permiso de Actions (lectura y escritura) en este repositorio."
  if (status === 404) return "GitHub no encontró el repositorio o el workflow scraper.yml: revisa GITHUB_REPO y el permiso del token."
  if (status === 422) return "GitHub no pudo iniciar el workflow en la rama main."
  return `GitHub respondió ${status}.`
}

/** Últimas ejecuciones del workflow del scraper (más reciente primero). */
export async function ultimasEjecuciones(cfg: ConfigGithub, fetchFn: typeof fetch = fetch, cantidad = 6): Promise<EjecucionScraper[]> {
  const res = await fetchFn(`${API}/repos/${cfg.repo}/actions/workflows/${ARCHIVO_WORKFLOW}/runs?per_page=${cantidad}`, {
    headers: cabeceras(cfg),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new ErrorGithub(mensajeDe(res.status), res.status)
  const datos = (await res.json()) as { workflow_runs?: Record<string, unknown>[] }
  return (datos.workflow_runs ?? []).flatMap(r => {
    const id = Number(r.id)
    if (!Number.isFinite(id)) return []
    return [
      {
        id,
        estado: estadoDeEjecucion(r.status as string, r.conclusion as string | null),
        origen: r.event === "schedule" ? ("programada" as const) : ("manual" as const),
        url: typeof r.html_url === "string" && r.html_url.startsWith("https://github.com/") ? r.html_url : `https://github.com/${cfg.repo}/actions`,
        iniciada_en: String(r.run_started_at ?? r.created_at ?? ""),
        actualizada_en: String(r.updated_at ?? ""),
      },
    ]
  })
}

/** Pide a GitHub que ejecute el workflow ahora. */
export async function lanzarScraper(cfg: ConfigGithub, paginas: number, fetchFn: typeof fetch = fetch): Promise<void> {
  const res = await fetchFn(`${API}/repos/${cfg.repo}/actions/workflows/${ARCHIVO_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { ...cabeceras(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: RAMA, inputs: { paginas: String(paginas) } }),
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status !== 204) throw new ErrorGithub(mensajeDe(res.status), res.status)
}

export const hayEjecucionEnCurso = (e: EjecucionScraper[]) => e.some(x => x.estado === "en_cola" || x.estado === "en_curso")
