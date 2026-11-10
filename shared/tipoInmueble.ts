import { TIPOS_INMUEBLE, claveNombre, tipoCanonico } from "./ubicacion"

/**
 * Razonamiento sobre el tipo de inmueble. El tipo que entrega el portal acierta casi siempre, pero a veces lo
 * publican mal («Terreno - La Molina» dentro de Casas, «Casa de playa» dentro de Departamentos). Aquí se lee el título
 * y solo se corrige el tipo cuando lo contradice con claridad; ante la duda se respeta al portal.
 */

type Tipo = (typeof TIPOS_INMUEBLE)[number]

/** Palabra del título -> tipo. Se comparan sin tildes ni mayúsculas. */
const PALABRAS: Record<string, Tipo> = {
  departamento: "Departamento", departamentos: "Departamento", depa: "Departamento", depas: "Departamento", dpto: "Departamento", dptos: "Departamento",
  depto: "Departamento", deptos: "Departamento", flat: "Departamento", flats: "Departamento", penthouse: "Departamento",
  monoambiente: "Departamento", monoambientes: "Departamento", loft: "Departamento",
  casa: "Casa", casas: "Casa", chalet: "Casa", casona: "Casa", mansion: "Casa",
  terreno: "Terreno", terrenos: "Terreno", lote: "Terreno", lotes: "Terreno", parcela: "Terreno", parcelas: "Terreno",
  oficina: "Oficina", oficinas: "Oficina",
  local: "Local comercial", locales: "Local comercial", tienda: "Local comercial", tiendas: "Local comercial",
  edificio: "Edificio", edificios: "Edificio",
  galpon: "Local industrial", galpones: "Local industrial", almacen: "Local industrial", almacenes: "Local industrial",
  chacra: "Chacra o campo", chacras: "Chacra o campo", fundo: "Chacra o campo",
  habitacion: "Habitación", habitaciones: "Habitación", cuarto: "Habitación",
  cochera: "Cochera", cocheras: "Cochera", estacionamiento: "Cochera", estacionamientos: "Cochera",
}

/** Estos tipos solo valen si encabezan el título («Cochera en venta»); si no, son un extra («… dormitorios y cochera»). */
const SOLO_AL_INICIO = new Set<Tipo>(["Habitación", "Cochera"])

/** Una palabra así delante indica un lugar o un uso, no lo que se vende («local en edificio», «casa para oficina»). */
const NO_ES_EL_OBJETO = new Set(["en", "del", "al", "dentro", "frente", "cerca", "junto", "como", "tipo", "para", "ideal", "apto", "sin", "con", "y", "o"])

const palabrasDe = (titulo: string | null | undefined) => claveNombre(titulo ?? "").split(/[^a-z0-9ñ]+/).filter(Boolean)

/** Todo tipo que el título nombra en cualquier lugar («casa CON TERRENO», «local EN EDIFICIO»). */
export const tiposMencionados = (titulo: string | null | undefined): Tipo[] => [...new Set(palabrasDe(titulo).flatMap(t => (PALABRAS[t] ? [PALABRAS[t]] : [])))]

/** Tipos que el título menciona como lo que se vende, en orden de aparición. */
export function tiposEnTitulo(titulo: string | null | undefined): Tipo[] {
  const tokens = palabrasDe(titulo)
  const salida: Tipo[] = []
  tokens.forEach((t, i) => {
    const tipo = PALABRAS[t]
    if (!tipo || salida.includes(tipo)) return
    if (SOLO_AL_INICIO.has(tipo) && i > 2) return
    if (i > 0 && NO_ES_EL_OBJETO.has(tokens[i - 1])) return
    if (tipo === "Casa" && tokens[i + 1] === "club") return // «casa club» es una instalación
    // «local comercial» es un local; «oficina comercial» una oficina (el «comercial» no cambia el tipo).
    salida.push(tipo)
  })
  return salida
}

/**
 * Tipo de inmueble final: el del portal, salvo que el título hable claramente de otro tipo y no mencione el del
 * portal. Sin tipo del portal (o «Otros») se usa el del título. Los proyectos no se tocan.
 */
export function razonarTipo(tipoPortal: string | null | undefined, titulo: string | null | undefined): string {
  const portal = (tipoPortal ?? "").trim() ? tipoCanonico(tipoPortal as string) : ""
  if (portal === "Proyecto") return portal
  const enTitulo = tiposEnTitulo(titulo)
  if (enTitulo.length === 0) return portal || "Departamento"
  if (!portal || portal === "Otros") return enTitulo[0]
  // Si el título nombra el tipo del portal en cualquier parte («casa como terreno», «local en edificio») se respeta al portal.
  return tiposMencionados(titulo).includes(portal as Tipo) ? portal : enTitulo[0]
}
