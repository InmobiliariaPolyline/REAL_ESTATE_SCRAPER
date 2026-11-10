// Copia de las portadas a Cloudinary (plan gratis): para cada aviso con portada de otro portal, Cloudinary
// descarga la foto por su cuenta (subida por dirección), la reduce a 720 px y la guarda. Así la portada sigue
// viéndose aunque el portal borre el aviso. Solo se copia la portada (la galería sigue apuntando al portal).
//
// Sin CLOUDINARY_URL no hace nada. Si una copia falla, el aviso conserva la foto del portal.
import { createHash } from "node:crypto"
import type { Db } from "./db"
import type { ApiEnv } from "./env"

export interface ConfigCloudinary {
  nombre: string
  clave: string
  secreto: string
}

/** `cloudinary://CLAVE:SECRETO@NOMBRE` -> datos de la cuenta; `null` si falta o está mal escrita. */
export function cloudinaryDe(env: ApiEnv): ConfigCloudinary | null {
  const m = /^cloudinary:\/\/([^:@/\s]+):([^@/\s]+)@([\w-]+)$/.exec((env.CLOUDINARY_URL ?? "").trim())
  return m ? { clave: m[1], secreto: m[2], nombre: m[3] } : null
}

const TRANSFORMACION = "c_limit,w_720,q_auto:good"

/** Firma de Cloudinary: parámetros ordenados «k=v&k=v» + secreto, en SHA-1. */
export function firmar(params: Record<string, string>, secreto: string): string {
  const texto = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&")
  return createHash("sha1").update(texto + secreto).digest("hex")
}

/** Identificador estable por aviso (sin caracteres raros), para que repetir la copia no duplique. */
export const idPublico = (id: string) => `propiedades/${id.replace(/[^\w-]+/g, "_")}`

export const esDeCloudinary = (url: string | null | undefined) => /res\.cloudinary\.com/.test(url ?? "")

/** Pide a Cloudinary que descargue `origen` y devuelve la dirección segura de la copia. */
export async function subirPortada(cfg: ConfigCloudinary, id: string, origen: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const firmados = { overwrite: "true", public_id: idPublico(id), timestamp: String(Math.floor(Date.now() / 1000)), transformation: TRANSFORMACION }
  const cuerpo = new URLSearchParams({ ...firmados, file: origen, api_key: cfg.clave, signature: firmar(firmados, cfg.secreto) })
  const res = await fetchFn(`https://api.cloudinary.com/v1_1/${cfg.nombre}/image/upload`, {
    method: "POST",
    body: cuerpo,
    signal: AbortSignal.timeout(20_000),
  })
  const datos = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } }
  if (!res.ok || !datos.secure_url?.startsWith("https://")) throw new Error(datos.error?.message ?? `Cloudinary respondió ${res.status}`)
  return datos.secure_url
}

export interface ResultadoCopia {
  configurado: boolean
  intentadas: number
  copiadas: number
  fallidas: number
  /** Motivo de la primera copia fallida (para diagnosticar permisos, claves o fotos que ya no existen). */
  primerError?: string
}

/**
 * Copia hasta `limite` portadas pendientes (en orden al azar, para que una foto que siempre falla no
 * acapare los cupos). Se detiene al pasar `presupuestoMs`, pensado para funciones programadas cortas.
 */
export async function copiarPortadas(
  db: Db,
  env: ApiEnv,
  { limite = 24, concurrencia = 4, presupuestoMs = 20_000, fetchFn = fetch as typeof fetch } = {}
): Promise<ResultadoCopia> {
  const cfg = cloudinaryDe(env)
  const r: ResultadoCopia = { configurado: !!cfg, intentadas: 0, copiadas: 0, fallidas: 0 }
  if (!cfg) return r

  const pendientes = await db.query<{ id: string; imagen: string }>(
    `select id, imagen from public.propiedades
      where imagen like 'http%' and imagen not like '%res.cloudinary.com%'
      order by random() limit $1`,
    [limite]
  )
  const inicio = Date.now()
  let siguiente = 0
  const trabajador = async () => {
    while (siguiente < pendientes.length && Date.now() - inicio < presupuestoMs) {
      const p = pendientes[siguiente++]
      r.intentadas++
      try {
        const url = await subirPortada(cfg, p.id, p.imagen, fetchFn)
        // Solo si la portada sigue siendo la que se copió (otra corrida pudo cambiarla).
        await db.query(`update public.propiedades set imagen = $1 where id = $2 and imagen = $3`, [url, p.id, p.imagen])
        r.copiadas++
      } catch (e) {
        r.fallidas++
        r.primerError ??= String((e as Error)?.message ?? e).slice(0, 200)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrencia, pendientes.length) }, trabajador))
  return r
}
