import { neon } from "@neondatabase/serverless"

export type Row = Record<string, unknown>

/** Acceso mínimo a Postgres; permite sustituirlo (p. ej. PGlite) en las pruebas. */
export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>
}

/** Conexión a Neon por HTTP (apta para funciones serverless; sin sockets persistentes). */
export function createNeonDb(connectionString: string): Db {
  const sql = neon(connectionString)
  return {
    query: async <T = Row>(text: string, params: unknown[] = []) =>
      (await sql.query(text, params)) as unknown as T[],
  }
}
