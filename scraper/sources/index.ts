import type { Aviso } from "../ingest"

/** Una fuente descarga los avisos vigentes de un portal. */
export interface Fuente {
  nombre: string
  obtener: () => Promise<Aviso[]>
}

/**
 * Fuentes activas. Está vacía a propósito: cada portal necesita su propio adaptador
 * (ver scraper/README.md). Cuando exista uno, impórtalo y añádelo aquí.
 */
export const FUENTES: Fuente[] = []
