import type { Db } from "./db"

export const CLEANUP_MIN_DAYS = 7
export const CLEANUP_MAX_DAYS = 365
/** El scraper debe haber refrescado `ultima_vista_en` en estas horas para considerar fiable la limpieza. */
export const SCRAPER_FRESH_HOURS = 72

export interface CleanupPreview {
  dias: number
  /** Total de propiedades en la base. */
  total: number
  /** Avisos no vistos en `dias` que se eliminarían. */
  eliminables: number
  /** Avisos viejos que se conservan por tener enlaces o estar en favoritos. */
  protegidas: number
  ultimaVista: string | null
  /** false si borrar sería peligroso; `motivo` explica por qué. */
  seguro: boolean
  motivo?: string
}

/**
 * Calcula qué se eliminaría al limpiar avisos inactivos (no vistos en `dias`).
 * Salvaguardas: no se tocan avisos con enlaces ni favoritos, y no se permite limpiar si el
 * scraper no ha refrescado `ultima_vista_en` recientemente (si no lo actualiza, todo parecería
 * "inactivo") ni si se borraría la tabla completa.
 */
export async function previewCleanup(db: Db, dias: number): Promise<CleanupPreview> {
  const rows = await db.query<{
    total: number
    eliminables: number
    protegidas: number
    ultima_vista: string | null
    horas: number | null
  }>(
    `with viejas as (
       select p.id,
              (exists (select 1 from public.enlaces e where e.propiedad_id = p.id)
               or exists (select 1 from public.favoritos f where f.propiedad_id = p.id)) as protegida
         from public.propiedades p
        where p.ultima_vista_en < now() - make_interval(days => $1::int)
     )
     select (select count(*)::int from public.propiedades) as total,
            (count(*) filter (where not protegida))::int as eliminables,
            (count(*) filter (where protegida))::int as protegidas,
            (select max(ultima_vista_en) from public.propiedades) as ultima_vista,
            (select extract(epoch from (now() - max(ultima_vista_en))) / 3600
               from public.propiedades)::float8 as horas
       from viejas`,
    [dias]
  )
  const r = rows[0]
  const base: CleanupPreview = {
    dias,
    total: r.total,
    eliminables: r.eliminables,
    protegidas: r.protegidas,
    ultimaVista: r.ultima_vista,
    seguro: true,
  }

  if (r.total === 0) return { ...base, seguro: false, motivo: "No hay propiedades en la base." }
  if (r.horas === null || r.horas > SCRAPER_FRESH_HOURS) {
    return {
      ...base,
      seguro: false,
      motivo:
        "El scraper no ha refrescado la fecha de último avistamiento en los últimos días; limpiar ahora borraría avisos que siguen publicados.",
    }
  }
  if (r.eliminables >= r.total) {
    return { ...base, seguro: false, motivo: "La limpieza eliminaría todos los avisos." }
  }
  return base
}

/** Elimina los avisos inactivos (solo si la vista previa es segura). Devuelve cuántos borró. */
export async function runCleanup(db: Db, dias: number): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `delete from public.propiedades p
      where p.ultima_vista_en < now() - make_interval(days => $1::int)
        and not exists (select 1 from public.enlaces e where e.propiedad_id = p.id)
        and not exists (select 1 from public.favoritos f where f.propiedad_id = p.id)
      returning p.id`,
    [dias]
  )
  return rows.length
}
