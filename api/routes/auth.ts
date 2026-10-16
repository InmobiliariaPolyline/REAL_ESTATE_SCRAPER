import type { Route } from "../router"
import { HttpError, badRequest, json, readJson, str } from "../http"

interface LoginResult {
  ok: boolean
  error?: "invalid" | "baneado" | "bloqueado"
  [key: string]: unknown
}

export const authRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/login",
    level: "public",
    handler: async ({ req, db }) => {
      const body = await readJson(req)
      const usuario = str(body.usuario, "usuario", 100)
      const password = str(body.password, "password", 200)
      if (!usuario.trim() || !password) throw badRequest("Usuario y contraseña son obligatorios")

      const rows = await db.query<{ r: LoginResult }>(
        "select public.login_usuario($1, $2) as r",
        [usuario, password]
      )
      const result = rows[0]?.r
      if (result?.ok) return json(result)

      // El cuerpo nunca revela si el usuario existe: solo el motivo genérico.
      if (result?.error === "bloqueado") {
        throw new HttpError(429, "bloqueado", "Demasiados intentos fallidos. Intenta más tarde.")
      }
      if (result?.error === "baneado") {
        throw new HttpError(403, "baneado", "Cuenta suspendida")
      }
      throw new HttpError(401, "invalid", "Usuario o contraseña incorrectos")
    },
  },
  {
    method: "GET",
    path: "/api/session",
    level: "user",
    handler: async ({ access }) => {
      // `access` ya viene validado contra la base (vigencia, cuenta activa, suscripción).
      const { token: _token, ...payload } = access
      return { ok: true, ...payload }
    },
  },
  {
    method: "POST",
    path: "/api/logout",
    level: "user",
    handler: async ({ db, access }) => {
      await db.query("select public.cerrar_sesion($1::uuid)", [access.token])
      return { ok: true }
    },
  },
  {
    method: "GET",
    path: "/api/health",
    level: "public",
    handler: async ({ db }) => {
      await db.query("select 1")
      return { status: "ok" }
    },
  },
]
