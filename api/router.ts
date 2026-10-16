import { authenticate, type Access, type AuthLevel } from "./auth"
import type { Db } from "./db"
import type { ApiEnv } from "./env"
import { HttpError, forbidden, json, unauthorized } from "./http"

export interface Ctx {
  req: Request
  url: URL
  params: Record<string, string>
  db: Db
  env: ApiEnv
  /** Presente en rutas que exigen sesión. */
  access: Access
}

export type Handler = (ctx: Ctx) => Promise<Response | unknown>

export interface Route {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  level: AuthLevel
  handler: Handler
}

const NETLIFY_FUNCTION_PREFIX = "/.netlify/functions/api"

interface Compiled extends Route {
  regex: RegExp
  keys: string[]
}

function compile(route: Route): Compiled {
  const keys: string[] = []
  const pattern = route.path.replace(/:([A-Za-z]+)/g, (_m, key: string) => {
    keys.push(key)
    return "([^/]+)"
  })
  return { ...route, regex: new RegExp(`^${pattern}/?$`), keys }
}

/** Router mínimo: casa método + ruta, autoriza según `level` y serializa la respuesta. */
export function createRouter(routes: Route[]) {
  const compiled = routes.map(compile)

  return async function dispatch(req: Request, db: Db, env: ApiEnv): Promise<Response> {
    const url = new URL(req.url)
    // Si Netlify entrega la ruta interna de la función, se normaliza a /api/...
    if (url.pathname.startsWith(NETLIFY_FUNCTION_PREFIX)) {
      url.pathname = `/api${url.pathname.slice(NETLIFY_FUNCTION_PREFIX.length)}`
    }
    const method = req.method.toUpperCase()

    const pathMatches = compiled.filter(r => r.regex.test(url.pathname))
    if (pathMatches.length === 0) {
      throw new HttpError(404, "not_found", "Ruta no encontrada")
    }
    const route = pathMatches.find(r => r.method === method)
    if (!route) throw new HttpError(405, "method_not_allowed", "Método no permitido")

    const match = route.regex.exec(url.pathname)!
    const params: Record<string, string> = {}
    route.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1])
    })

    let access: Access | null = null
    if (route.level !== "public") {
      access = await authenticate(db, req)
      if (!access) throw unauthorized()
      if (route.level === "admin" && access.usuario.rol !== "admin") throw forbidden()
      if (
        route.level === "member" &&
        access.usuario.rol !== "admin" &&
        !access.suscripcion
      ) {
        throw forbidden()
      }
    }

    const result = await route.handler({
      req,
      url,
      params,
      db,
      env,
      access: access as Access,
    })
    return result instanceof Response ? result : json(result ?? { ok: true })
  }
}
