import { createClient } from "@supabase/supabase-js"
import {
  ADMIN_WHATSAPP,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./config"
import { getSessionToken } from "./sessionStore"

if (!isSupabaseConfigured) {
  console.error(
    "[config] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y completa los valores."
  )
}

/**
 * fetch que adjunta el token de sesión de la app en `x-session-token`.
 * Las políticas RLS de `supabase/migrations` leen esa cabecera para saber quién llama.
 */
const sessionFetch: typeof fetch = (input, init) => {
  const token = getSessionToken()
  if (!token) return fetch(input, init)

  if (input instanceof Request) {
    const headers = new Headers(input.headers)
    headers.set("x-session-token", token)
    return fetch(new Request(input, { headers }), init)
  }

  const headers = new Headers(init?.headers)
  headers.set("x-session-token", token)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(
  SUPABASE_URL || "http://localhost:54321",
  SUPABASE_ANON_KEY || "not-configured",
  {
    // La app usa su propia sesión (tabla `usuarios` + token), no Supabase Auth.
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: sessionFetch },
  }
)

export { ADMIN_WHATSAPP }
