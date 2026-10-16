import type { Db } from "./db"
import type { ApiEnv } from "./env"
import { HttpError, json } from "./http"
import { createRouter } from "./router"
import { adminRoutes } from "./routes/admin"
import { authRoutes } from "./routes/auth"
import { insightsRoutes } from "./routes/insights"
import { portalRoutes } from "./routes/portal"

const dispatch = createRouter([...authRoutes, ...portalRoutes, ...insightsRoutes, ...adminRoutes])

/**
 * Handler Web estándar (Request → Response), independiente de la plataforma:
 * lo usan la Netlify Function (netlify/functions/api.ts) y el servidor Express (server/).
 */
export function createApiHandler(getDb: () => Db, env: ApiEnv) {
  // La conexión se abre solo cuando una ruta realmente consulta (404/405 no la necesitan).
  const lazyDb: Db = { query: (text, params) => getDb().query(text, params) }

  return async function handle(req: Request): Promise<Response> {
    try {
      return await dispatch(req, lazyDb, env)
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.code, message: err.message }, err.status)
      }
      // Los detalles internos (SQL, credenciales) nunca se devuelven al cliente.
      console.error("API error:", err)
      return json({ error: "internal", message: "Error interno del servidor" }, 500)
    }
  }
}
