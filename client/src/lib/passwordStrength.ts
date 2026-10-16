export interface PasswordStrength {
  /** 0 (vacía) a 4 (muy buena). */
  score: 0 | 1 | 2 | 3 | 4
  label: string
}

const LABELS = ["", "Débil", "Aceptable", "Buena", "Muy buena"] as const

/**
 * Estimación sencilla (solo orientativa, no sustituye al mínimo que exige el servidor):
 * puntúa longitud y variedad de caracteres y penaliza repeticiones y secuencias obvias.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "" }

  let points = 0
  if (password.length >= 8) points++
  if (password.length >= 12) points++
  if (password.length >= 16) points++

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(password)).length
  if (classes >= 2) points++
  if (classes >= 3) points++
  if (classes === 4) points++

  if (/^(.)\1+$/.test(password)) points = 0 // "aaaaaaaa"
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(password)) points--
  if (/^(password|contrase|admin|12345678)/i.test(password)) points = Math.min(points, 1)

  const score = Math.max(1, Math.min(4, Math.ceil(points / 1.5))) as 1 | 2 | 3 | 4
  return { score, label: LABELS[score] }
}
