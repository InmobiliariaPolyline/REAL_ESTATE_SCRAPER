import { MIN_PASSWORD_LENGTH } from "../../shared/constants"
import type { Route } from "../router"
import { HttpError, badRequest, forbidden, json, readJson, str } from "../http"
import { runWatchdog } from "../watchdog"

/** Comparación en tiempo constante de dos cadenas (evita filtrar el secreto por tiempos). */
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  }
  return diff === 0
}

interface LoginResult {
  ok: boolean
  error?: "invalid" | "baneado" | "bloqueado"
  [key: string]: unknown
}

/** Categoría legible de un fallo de conexión a la base (sin datos sensibles). */
export function describeDbFailure(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err)
  if (/DATABASE_URL no está configurada/i.test(msg)) {
    return "Falta la variable DATABASE_URL en el servidor"
  }
  if (/password authentication failed|authentication failed|no pg_hba|role .* does not exist/i.test(msg)) {
    return "La base rechazó las credenciales de DATABASE_URL (¿contraseña antigua?)"
  }
  if (/ENOTFOUND|getaddrinfo|fetch failed|ECONNREFUSED|ETIMEDOUT|timeout/i.test(msg)) {
    return "No se pudo alcanzar el servidor de la base de datos"
  }
  if (/relation .* does not exist|function .* does not exist/i.test(msg)) {
    return "La base está accesible pero falta aplicar los scripts de db/"
  }
  if (/invalid connection string|Invalid URL|Database connection string/i.test(msg)) {
    return "DATABASE_URL tiene un formato inválido"
  }
  return "Error desconocido al consultar la base de datos"
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
    method: "POST",
    path: "/api/account/password",
    level: "user",
    handler: async ({ req, db, access }) => {
      const body = await readJson(req)
      const actual = str(body.actual, "actual", 200)
      const nueva = str(body.nueva, "nueva", 200)
      if (nueva.length < MIN_PASSWORD_LENGTH) {
        throw badRequest(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
      }
      if (nueva === actual) throw badRequest("La contraseña nueva debe ser distinta de la actual")

      const rows = await db.query<{ r: string }>(
        "select public.cambiar_password($1::bigint, $2, $3, $4::uuid) as r",
        [access.usuario.id, actual, nueva, access.token]
      )
      switch (rows[0]?.r) {
        case "ok":
          return { ok: true }
        case "bloqueado":
          throw new HttpError(429, "bloqueado", "Demasiados intentos fallidos. Intenta más tarde.")
        case "password_corta":
          throw badRequest(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
        default:
          // 400 (no 401): la sesión es válida, solo la contraseña actual es incorrecta.
          throw new HttpError(400, "password_actual", "La contraseña actual no es correcta")
      }
    },
  },
  {
    // Planificador externo (p. ej. cron de GitHub Actions) cuando no se usa la función programada
    // de Netlify. Se autoriza con la cabecera `x-cron-secret`.
    method: "POST",
    path: "/api/internal/watchdog",
    level: "public",
    handler: async ({ req, db, env }) => {
      if (!env.CRON_SECRET) throw new HttpError(501, "not_configured", "CRON_SECRET no está configurado")
      const provided = req.headers.get("x-cron-secret") ?? ""
      if (!timingSafeEqual(provided, env.CRON_SECRET)) throw forbidden()
      try {
        return await runWatchdog(db, env)
      } catch (err) {
        console.error("Watchdog falló:", err)
        throw new HttpError(502, "alert_failed", "No se pudo enviar la alerta")
      }
    },
  },
  {
    method: "GET",
    path: "/api/health",
    level: "public",
    handler: async ({ db }) => {
      try {
        await db.query("select 1")
      } catch (err) {
        // Diagnóstico para operaciones: indica la categoría del fallo, nunca la cadena de
        // conexión, el usuario ni el mensaje original de la base.
        console.error("Health check falló:", err)
        throw new HttpError(503, "db_unavailable", describeDbFailure(err))
      }
      return { status: "ok" }
    },
  },
]
