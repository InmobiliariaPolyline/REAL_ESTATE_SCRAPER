import { claveNombre, departamentoDeProvincia } from "@shared/ubicacion"
import type { Faceta, Facetas } from "./facetas"

/** Lo elegido en la jerarquía geográfica. Vacío = «Todos» en ese nivel. */
export interface SeleccionGeo {
  departamento: string
  provincia: string
  distrito: string
}

const igual = (a: string | null | undefined, b: string | null | undefined) => claveNombre(a ?? "") === claveNombre(b ?? "")

/**
 * Opciones de cada nivel según lo ya elegido: las provincias son las del departamento y los distritos son los de la
 * provincia (o, sin provincia, los del departamento). Sin elegir nada arriba se ofrece todo el nivel.
 */
export function opcionesGeograficas(f: Pick<Facetas, "provincias" | "distritos">, sel: Pick<SeleccionGeo, "departamento" | "provincia">) {
  const provincias = f.provincias.filter(p => !sel.departamento || igual(p.padre, sel.departamento))
  const distritos = f.distritos.filter(
    d => (!sel.departamento || !d.padre || igual(d.padre, sel.departamento)) && (!sel.provincia || !d.provincia || igual(d.provincia, sel.provincia))
  )
  return { provincias, distritos }
}

/** Al cambiar el departamento, la provincia y el distrito elegidos solo se conservan si siguen siendo de él. */
export function elegirDepartamento(f: Pick<Facetas, "provincias" | "distritos">, sel: SeleccionGeo, valor: string): SeleccionGeo {
  if (!valor) return { ...sel, departamento: "" }
  const provinciaValida = !sel.provincia || f.provincias.some(p => igual(p.valor, sel.provincia) && igual(p.padre, valor))
  const distritoValido = !sel.distrito || f.distritos.some(d => igual(d.valor, sel.distrito) && igual(d.padre, valor))
  return { departamento: valor, provincia: provinciaValida ? sel.provincia : "", distrito: provinciaValida && distritoValido ? sel.distrito : "" }
}

/** Al elegir una provincia se completa su departamento; el distrito se conserva solo si es de esa provincia. */
export function elegirProvincia(f: Pick<Facetas, "provincias" | "distritos">, sel: SeleccionGeo, valor: string): SeleccionGeo {
  if (!valor) return { ...sel, provincia: "" }
  const entrada = f.provincias.find(p => igual(p.valor, valor) && (!sel.departamento || igual(p.padre, sel.departamento)))
  const departamento = entrada?.padre ?? departamentoDeProvincia(valor) ?? sel.departamento
  const distritoValido = !sel.distrito || f.distritos.some(d => igual(d.valor, sel.distrito) && igual(d.padre, departamento) && (!d.provincia || igual(d.provincia, valor)))
  return { departamento, provincia: entrada?.valor ?? valor, distrito: distritoValido ? sel.distrito : "" }
}

/**
 * Al elegir un distrito de la lista se completan su provincia y su departamento. Un texto que no coincide con
 * ningún distrito conocido se deja como búsqueda parcial, sin tocar los niveles de arriba.
 */
export function elegirDistrito(f: Pick<Facetas, "distritos">, sel: SeleccionGeo, texto: string): SeleccionGeo {
  const candidatos = f.distritos.filter(d => igual(d.valor, texto))
  if (candidatos.length === 0) return { ...sel, distrito: texto }
  const mejor =
    candidatos.find(d => (!sel.departamento || igual(d.padre, sel.departamento)) && (!sel.provincia || igual(d.provincia, sel.provincia))) ??
    candidatos.find(d => !sel.departamento || igual(d.padre, sel.departamento)) ??
    candidatos[0]
  return { departamento: mejor.padre ?? sel.departamento, provincia: mejor.provincia ?? sel.provincia, distrito: mejor.valor }
}

/** «Lima › Lima › Miraflores»: lo elegido de arriba abajo, o `""` si no hay nada. */
export const rutaGeografica = (sel: SeleccionGeo) => [sel.departamento, sel.provincia, sel.distrito].filter(Boolean).join(" › ")

/** Distritos que se sugieren al escribir: los que contienen el texto (sin tildes), de más a menos avisos. */
export function sugerirDistritos(distritos: Faceta[], texto: string, max = 12): Faceta[] {
  const q = claveNombre(texto)
  const lista = q ? distritos.filter(d => claveNombre(d.valor).includes(q)) : distritos.filter(d => d.n > 0)
  return lista.slice(0, max)
}
