interface PostgrestLikeError {
  code?: string
  message?: string
  status?: number
}

/**
 * true cuando el error indica que la función RPC aún no existe en la base de datos
 * (la migración `supabase/migrations/*_secure_auth.sql` no se ha aplicado).
 */
export function isMissingRpc(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.status === 404 ||
    /could not find the function|function .* does not exist/i.test(
      error.message ?? ""
    )
  )
}

let legacyWarned = false

/** Avisa una sola vez de que se está usando el modo legado (sin RLS ni contraseñas hasheadas). */
export function warnLegacyMode(): void {
  if (legacyWarned) return
  legacyWarned = true
  console.warn(
    "[seguridad] Funciones RPC no encontradas: la app funciona en MODO LEGADO (contraseñas en texto plano, sin RLS). Aplica supabase/migrations/20260101000000_secure_auth.sql."
  )
}
