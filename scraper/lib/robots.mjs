// Lector mínimo de robots.txt: el scraper lo consulta antes de pedir cada página y no entra donde el portal lo prohíbe.

/** Convierte una regla de robots.txt (con * y $) en expresión regular. */
function reglaARegex(regla) {
  const fin = regla.endsWith("$")
  const cuerpo = (fin ? regla.slice(0, -1) : regla).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp("^" + cuerpo + (fin ? "$" : ""))
}

/**
 * Reglas Allow/Disallow que valen para `agente`: las del grupo que nombra a ese agente y, si no hay,
 * las del grupo `*`.
 */
export function leerRobots(texto, agente = "ScraperPropio") {
  const grupos = []
  let actual = null
  let lecturaDeAgentes = false
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linea = bruta.replace(/#.*/, "").trim()
    if (!linea) continue
    const dos = linea.indexOf(":")
    if (dos < 0) continue
    const clave = linea.slice(0, dos).trim().toLowerCase()
    const valor = linea.slice(dos + 1).trim()
    if (clave === "user-agent") {
      if (!lecturaDeAgentes) {
        actual = { agentes: [], reglas: [] }
        grupos.push(actual)
      }
      actual.agentes.push(valor.toLowerCase())
      lecturaDeAgentes = true
    } else if ((clave === "allow" || clave === "disallow") && actual) {
      lecturaDeAgentes = false
      if (valor) actual.reglas.push({ permite: clave === "allow", patron: valor, regex: reglaARegex(valor) })
    } else {
      lecturaDeAgentes = false
    }
  }
  const nombre = agente.toLowerCase()
  const propio = grupos.filter(g => g.agentes.some(a => a !== "*" && nombre.includes(a)))
  const general = grupos.filter(g => g.agentes.includes("*"))
  return (propio.length > 0 ? propio : general).flatMap(g => g.reglas)
}

/**
 * ¿Se puede pedir esta ruta (con su consulta)? Gana la regla más específica (la de patrón más largo) y,
 * si empatan, la que permite. Sin ninguna regla que coincida, se puede.
 */
export function permitido(reglas, rutaConConsulta) {
  let mejor = null
  for (const r of reglas) {
    if (!r.regex.test(rutaConConsulta)) continue
    if (!mejor || r.patron.length > mejor.patron.length || (r.patron.length === mejor.patron.length && r.permite)) mejor = r
  }
  return mejor ? mejor.permite : true
}
