/**
 * Extrae los metros cuadrados de un texto de área ("80 m²", "85,5 m2", "1.200 m²").
 * Devuelve `null` si no hay un número positivo.
 */
export function parseAreaM2(area: string | null | undefined): number | null {
  if (!area) return null
  const match = /\d[\d.,]*/.exec(area)
  if (!match) return null

  let raw = match[0].replace(/[.,]+$/, "")
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    // 1.200 / 1.200,5  ->  puntos como separador de miles
    raw = raw.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    // 1,200 / 1,200.5  ->  comas como separador de miles
    raw = raw.replace(/,/g, "")
  } else {
    raw = raw.replace(",", ".")
  }

  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Precio por m² (en la moneda del precio dado) o `null` si falta el precio o el área. */
export function pricePerM2(price: number | null | undefined, area: string | null | undefined): number | null {
  const m2 = parseAreaM2(area)
  if (!m2 || !price || price <= 0) return null
  return price / m2
}
