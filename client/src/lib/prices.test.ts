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
