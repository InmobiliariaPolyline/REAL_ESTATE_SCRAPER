// Netlify Function que expone la API (`/api/*`). La lógica vive en api/ y es la misma que
// usa el servidor Express (server/index.ts), así que se puede cambiar de hosting sin reescribir.
//
// Variables de entorno (Site settings → Environment variables):
//   DATABASE_URL     cadena de conexión de Neon (obligatoria; solo en el servidor)
//   USD_TO_PEN_RATE  tipo de cambio (opcional; igual que VITE_USD_TO_PEN_RATE)

import { createNeonDb, type Db } from "../../api/db"
import type { ApiEnv } from "../../api/env"
import { createApiHandler } from "../../api/handler"

let db: Db | null = null

const getDb = (): Db => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL no está configurada")
  return (db ??= createNeonDb(url))
}

const handle = createApiHandler(getDb, process.env as ApiEnv)

export default async (req: Request) => handle(req)

export const config = { path: "/api/*" }
