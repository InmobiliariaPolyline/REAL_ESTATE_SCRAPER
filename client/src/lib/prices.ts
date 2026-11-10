import { USD_TO_PEN_RATE } from "./config"

export type Currency = "PEN" | "USD"

export interface DisplayPrice {
  /** Monto ya convertido a la moneda pedida (0 si el aviso no tiene precio). */
  amount: number
  /** true cuando el monto es una conversión aproximada de la otra moneda. */
  approximate: boolean
  /** Símbolo/código a mostrar delante del monto. */
  label: string
}

export const currencyLabel = (currency: Currency) =>
  currency === "PEN" ? "S/" : "USD"

const positive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0

/**
 * Precio a mostrar en la moneda pedida. Usa el valor nativo cuando existe y, si no,
 * convierte desde la otra moneda marcándolo como aproximado.
 *
 * `original` es la moneda en que se publicó el aviso (`moneda` de la fila): `precio` está en esa
 * moneda, así que un aviso publicado en dólares no debe leerse como soles. Sin ese dato se asume soles.
 */
export function getDisplayPrice(
  precio: number | null | undefined,
  precioUsd: number | null | undefined,
  currency: Currency,
  original?: string | null
): DisplayPrice {
  const label = currencyLabel(currency)
  const publicadoEnDolares = (original ?? "").toUpperCase() === "USD"
  if (currency === "USD") {
    if (positive(precioUsd)) return { amount: precioUsd, approximate: false, label }
    if (positive(precio))
      return {
        amount: publicadoEnDolares ? precio : Math.round(precio / USD_TO_PEN_RATE),
        approximate: !publicadoEnDolares,
        label,
      }
  } else {
    if (positive(precio) && !publicadoEnDolares) return { amount: precio, approximate: false, label }
    // Publicado en dólares: se muestra su equivalente en soles (con «~» porque depende del tipo de cambio).
    const dolares = publicadoEnDolares && positive(precio) ? precio : precioUsd
    if (positive(dolares))
      return {
        amount: Math.round(dolares * USD_TO_PEN_RATE),
        approximate: true,
        label,
      }
  }
  return { amount: 0, approximate: false, label }
}

/**
 * Precio tal como lo publicó el aviso: el monto y la moneda del portal de origen, sin conversión (un aviso de
 * U$S 340 000 se muestra «USD 340,000», no su equivalente en soles al tipo de cambio del sistema). Si el aviso no
 * trae su precio publicado, se recurre a la conversión desde la otra moneda, marcada como aproximada.
 *
 * `original` es la moneda en que se publicó (`moneda` de la fila); sin ese dato se asume soles.
 */
export function getPublishedPrice(
  precio: number | null | undefined,
  precioUsd: number | null | undefined,
  original: string | null | undefined,
  respaldo: Currency = "PEN"
): DisplayPrice {
  if (positive(precio)) {
    const enDolares = (original ?? "").toUpperCase() === "USD"
    return { amount: precio, approximate: false, label: currencyLabel(enDolares ? "USD" : "PEN") }
  }
  return getDisplayPrice(precio, precioUsd, respaldo, original)
}

/** Texto cuando el aviso no publicó precio: sin símbolo de moneda ni «0», porque no hay ningún monto. */
export const SIN_PRECIO = "Sin precio"

export function formatDisplayPrice(price: DisplayPrice): string {
  return price.amount > 0 ? `${price.label} ${price.approximate ? "~" : ""}${price.amount.toLocaleString("es-PE")}` : SIN_PRECIO
}
