/**
 * Ubicación de los avisos: departamento (región), provincia (ciudad) y distrito.
 * Los portales escriben los nombres de formas distintas («Santiago De Surco», «SANTIAGO DE SURCO»);
 * aquí se normalizan para que los filtros no dupliquen valores.
 */

/** Distritos de Lima Metropolitana (provincia de Lima, departamento de Lima). */
export const DISTRITOS_LIMA = [
  "Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos", "Cieneguilla", "Comas", "El Agustino",
  "Independencia", "Jesús María", "La Molina", "La Victoria", "Lima", "Lince", "Los Olivos", "Lurigancho", "Lurín",
  "Magdalena del Mar", "Miraflores", "Pachacámac", "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra",
  "Rímac", "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis",
  "San Martín de Porres", "San Miguel", "Santa Anita", "Santa María del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo",
  "Villa El Salvador", "Villa María del Triunfo",
] as const

/** Distritos de la Provincia Constitucional del Callao. */
export const DISTRITOS_CALLAO = ["Callao", "Bellavista", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Mi Perú", "Ventanilla"] as const

/** Otras formas habituales de escribir un distrito -> nombre oficial. */
const ALIAS: Record<string, string> = {
  "lima cercado": "Lima",
  "cercado de lima": "Lima",
  "magdalena": "Magdalena del Mar",
  "chosica": "Lurigancho",
  "lurigancho chosica": "Lurigancho",
  "ate vitarte": "Ate",
  "carmen de la legua": "Carmen de la Legua Reynoso",
  "villa maria del triunfo": "Villa María del Triunfo",
  "san juan lurigancho": "San Juan de Lurigancho",
  "sjl": "San Juan de Lurigancho",
  "sjm": "San Juan de Miraflores",
  "smp": "San Martín de Porres",
  "ves": "Villa El Salvador",
  "surco": "Santiago de Surco",
}

/** Minúsculas, sin tildes ni espacios sobrantes: «Santiago De  Surco» -> «santiago de surco». */
export function claveNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "el"])

/** Mayúscula inicial en cada palabra, salvo partículas («de», «del», «la»…) que van en minúscula. */
export function tituloNombre(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ")
}

const LIMA = new Map<string, string>(DISTRITOS_LIMA.map(d => [claveNombre(d), d]))
const CALLAO = new Map<string, string>(DISTRITOS_CALLAO.map(d => [claveNombre(d), d]))

/**
 * Nombre canónico de un distrito: el oficial si es de Lima o del Callao (con alias y sin importar
 * mayúsculas ni tildes) y, si no, el texto en formato título.
 */
export function distritoCanonico(distrito: string | null | undefined): string | null {
  const t = (distrito ?? "").trim()
  if (!t) return null
  const clave = claveNombre(t)
  const nombre = ALIAS[clave] ?? t
  const k = claveNombre(nombre)
  return LIMA.get(k) ?? CALLAO.get(k) ?? tituloNombre(nombre)
}

export interface Ubicacion {
  departamento: string
  provincia: string
}

/** Departamento y provincia de un distrito de Lima o del Callao; `null` si no se reconoce. */
export function ubicacionDeDistrito(distrito: string | null | undefined): Ubicacion | null {
  const t = (distrito ?? "").trim()
  if (!t) return null
  const k = claveNombre(ALIAS[claveNombre(t)] ?? t)
  if (LIMA.has(k)) return { departamento: "Lima", provincia: "Lima" }
  if (CALLAO.has(k)) return { departamento: "Callao", provincia: "Callao" }
  return null
}

/** Departamento o provincia: sin espacios sobrantes y en formato título; `null` si queda vacío. */
export function nombreDeLugar(valor: string | null | undefined): string | null {
  const t = (valor ?? "").trim()
  return t ? tituloNombre(t).slice(0, 60) : null
}
