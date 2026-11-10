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

export function formatDisplayPrice(price: DisplayPrice): string {
  return price.amount > 0
    ? `${price.label} ${price.approximate ? "~" : ""}${price.amount.toLocaleString("es-PE")}`
    : `${price.label} 0`
}
