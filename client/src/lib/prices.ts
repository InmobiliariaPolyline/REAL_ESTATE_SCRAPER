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
 */
export function getDisplayPrice(
  precio: number | null | undefined,
  precioUsd: number | null | undefined,
  currency: Currency
): DisplayPrice {
  const label = currencyLabel(currency)
  if (currency === "USD") {
    if (positive(precioUsd)) return { amount: precioUsd, approximate: false, label }
    if (positive(precio))
      return {
        amount: Math.round(precio / USD_TO_PEN_RATE),
        approximate: true,
        label,
      }
  } else {
    if (positive(precio)) return { amount: precio, approximate: false, label }
    if (positive(precioUsd))
      return {
        amount: Math.round(precioUsd * USD_TO_PEN_RATE),
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
