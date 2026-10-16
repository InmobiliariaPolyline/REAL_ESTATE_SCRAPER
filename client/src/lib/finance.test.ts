import { describe, expect, it } from "vitest"
import { analizar, cuotaMensual } from "./finance"

describe("cuotaMensual", () => {
  it("coincide con la fórmula conocida (100 000 al 6 % a 20 años ≈ 716,43)", () => {
    expect(cuotaMensual(100000, 6, 20)).toBeCloseTo(716.43, 2)
  })

  it("sin interés reparte el préstamo en partes iguales", () => {
    expect(cuotaMensual(12000, 0, 1)).toBe(1000)
  })

  it("entradas inválidas dan 0", () => {
    expect(cuotaMensual(0, 5, 10)).toBe(0)
    expect(cuotaMensual(100000, 5, 0)).toBe(0)
    expect(cuotaMensual(-5, 5, 10)).toBe(0)
  })
})

describe("analizar", () => {
  const base = { precio: 200000, inicialPct: 20, tasaAnualPct: 6, anios: 20, alquilerMensual: 1200, gastosMensuales: 200 }

  it("calcula inicial, préstamo y cuota", () => {
    const r = analizar(base)
    expect(r.inicial).toBe(40000)
    expect(r.prestamo).toBe(160000)
    expect(r.cuota).toBeCloseTo(1146.29, 2)
    expect(r.totalPagado).toBeCloseTo(r.cuota * 240, 4)
    expect(r.totalIntereses).toBeCloseTo(r.totalPagado - 160000, 4)
  })

  it("calcula rentabilidad bruta, neta y años de recuperación", () => {
    const r = analizar(base)
    expect(r.rentabilidadBruta).toBeCloseTo(7.2, 6)
    expect(r.rentabilidadNeta).toBeCloseTo(6, 6)
    expect(r.aniosRecuperacion).toBeCloseTo(200000 / 12000, 6)
    expect(r.flujoMensual).toBeCloseTo(1200 - 200 - r.cuota, 6)
    expect(r.flujoMensual).toBeLessThan(0)
  })

  it("sin renta neta no hay años de recuperación", () => {
    expect(analizar({ ...base, alquilerMensual: 100, gastosMensuales: 300 }).aniosRecuperacion).toBeNull()
  })

  it("al contado no hay préstamo ni cuota", () => {
    const r = analizar({ ...base, inicialPct: 100 })
    expect(r.prestamo).toBe(0)
    expect(r.cuota).toBe(0)
  })

  it("tolera valores no válidos sin producir NaN", () => {
    const r = analizar({ precio: Number.NaN, inicialPct: -5, tasaAnualPct: 5, anios: 10, alquilerMensual: 1, gastosMensuales: 0 })
    for (const v of Object.values(r)) expect(v === null || Number.isFinite(v)).toBe(true)
  })
})
