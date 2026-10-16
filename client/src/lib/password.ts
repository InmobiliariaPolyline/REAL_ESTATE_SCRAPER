import { MIN_PASSWORD_LENGTH } from "@shared/constants"
import { api } from "./api"

export { MIN_PASSWORD_LENGTH }

const LOWER = "abcdefghijkmnopqrstuvwxyz" // sin "l"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ" // sin "I" ni "O"
const DIGITS = "23456789" // sin "0" ni "1"
const SYMBOLS = "!@#$%&*?"

function randomInt(max: number): number {
  // Rechazo de sesgo: descarta valores que romperían la uniformidad del módulo.
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return buf[0] % max
}

/** Contraseña aleatoria legible (sin caracteres ambiguos) con minúsculas, mayúsculas, dígitos y símbolos. */
export function generatePassword(length = 16): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS
  const chars = [LOWER, UPPER, DIGITS, SYMBOLS].map(set => set[randomInt(set.length)])
  while (chars.length < Math.max(length, MIN_PASSWORD_LENGTH)) {
    chars.push(all[randomInt(all.length)])
  }
  // Fisher-Yates para que los caracteres obligatorios no queden siempre al inicio.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}

/** Cambia la contraseña del usuario autenticado (exige la actual). */
export async function changeOwnPassword(actual: string, nueva: string): Promise<void> {
  await api.post("/account/password", { actual, nueva })
}

/** El administrador fija una contraseña nueva a otro usuario (cierra sus sesiones). */
export async function resetUserPassword(usuarioId: number, password: string): Promise<void> {
  await api.post(`/admin/usuarios/${usuarioId}/password`, { password })
}
