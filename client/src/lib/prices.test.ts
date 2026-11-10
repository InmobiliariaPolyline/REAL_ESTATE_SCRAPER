import { describe, expect, it } from "vitest"
import { USD_TO_PEN_RATE } from "./config"
import { formatDisplayPrice, getDisplayPrice } from "./prices"

describe("getDisplayPrice", () => {
  it("usa el precio nativo cuando existe", () => {
    expect(getDisplayPrice(375000, 100000, "USD")).toEqual({
      amount: 100000,
      approximate: false,
      label: "USD",
    })
    expect(getDisplayPrice(375000, 100000, "PEN").amount).toBe(375000)
  })

  it("convierte desde la otra moneda y lo marca como aproximado", () => {
    const usd = getDisplayPrice(375000, 0, "USD")
    expect(usd.amount).toBe(Math.round(375000 / USD_TO_PEN_RATE))
    expect(usd.approximate).toBe(true)

    const pen = getDisplayPrice(0, 1000, "PEN")
    expect(pen.amount).toBe(Math.round(1000 * USD_TO_PEN_RATE))
    expect(pen.approximate).toBe(true)
  })

  it("devuelve 0 sin precio", () => {
    expect(getDisplayPrice(null, undefined, "PEN").amount).toBe(0)
    expect(formatDisplayPrice(getDisplayPrice(0, 0, "USD"))).toBe("USD 0")
  })
})

describe("getDisplayPrice con la moneda original del aviso", () => {
  it("un aviso publicado en dólares no se lee como soles", () => {
    // precio = 400 000 USD, precio_usd = 400 000
    const pen = getDisplayPrice(400000, 400000, "PEN", "USD")
    expect(pen.amount).toBe(Math.round(400000 * USD_TO_PEN_RATE))
    expect(pen.approximate).toBe(true)
    expect(getDisplayPrice(400000, 400000, "USD", "USD")).toEqual({ amount: 400000, approximate: false, label: "USD" })
  })

  it("un aviso publicado en soles se muestra tal cual en soles y convertido en dólares", () => {
    expect(getDisplayPrice(1500000, 400000, "PEN", "PEN")).toEqual({ amount: 1500000, approximate: false, label: "S/" })
    expect(getDisplayPrice(1500000, 400000, "USD", "PEN").amount).toBe(400000)
  })

  it("en dólares sin precio_usd, el precio original en USD se usa directo", () => {
    expect(getDisplayPrice(250000, 0, "USD", "USD")).toEqual({ amount: 250000, approximate: false, label: "USD" })
    expect(getDisplayPrice(0, 250000, "PEN", "USD").amount).toBe(Math.round(250000 * USD_TO_PEN_RATE))
  })

  it("sin moneda original se asume soles (comportamiento anterior)", () => {
    expect(getDisplayPrice(375000, 100000, "PEN").amount).toBe(375000)
    expect(getDisplayPrice(375000, 0, "USD").amount).toBe(Math.round(375000 / USD_TO_PEN_RATE))
  })
})
