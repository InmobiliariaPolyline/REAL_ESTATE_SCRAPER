import { describe, expect, it } from "vitest"
import { calcularEstadisticas, mediana, type FilaPrecio } from "./stats"

const fila = (distrito: string | null, operacion: string, precio_usd: number, area: string | null = null): FilaPrecio => ({
  distrito,
  operacion,
  precio_usd,
  area,
})

describe("mediana", () => {
  it("maneja vacío, impar y par", () => {
    expect(mediana([])).toBeNull()
    expect(mediana([5, 1, 3])).toBe(3)
    expect(mediana([4, 1, 3, 2])).toBe(2.5)
  })
})

describe("calcularEstadisticas", () => {
  it("agrupa por distrito sin importar tildes ni mayúsculas y usa la mediana", () => {
    const r = calcularEstadisticas([
      fila("Miraflores", "VENTA", 100000, "50 m2"),
      fila("MIRAFLORES", "venta", 200000, "100 m2"),
      fila("Miraflores ", "VENTA", 9000000, "100 m2"), // precio absurdo: no debe arrastrar la mediana
    ])
    expect(r.distritos).toHaveLength(1)
    expect(r.distritos[0]).toMatchObject({ operacion: "VENTA", avisos: 3, precioMediano: 200000 })
    // 2000, 2000 y 90000 por m² -> mediana 2000
    expect(r.distritos[0].precioM2Mediano).toBe(2000)
  })

  it("separa venta y alquiler del mismo distrito", () => {
    const r = calcularEstadisticas(
      [
        ...[1, 2, 3].map(i => fila("Surco", "VENTA", 100000 * i, "100 m2")),
        ...[1, 2, 3].map(i => fila("Surco", "ALQUILER", 500 * i, "50 m2")),
      ],
      { minAvisos: 3 }
    )
    expect(r.distritos.map(d => d.operacion).sort()).toEqual(["ALQUILER", "VENTA"])
    expect(r.resumen.find(x => x.operacion === "ALQUILER")).toMatchObject({ avisos: 3, precioM2Mediano: 20 })
  })

  it("omite distritos con pocos avisos, avisos sin precio u operación desconocida", () => {
    const r = calcularEstadisticas([
      fila("Lince", "VENTA", 100000),
      fila("Lince", "VENTA", 0),
      fila("Lince", "OTRO", 100000),
      fila(null, "VENTA", 100000),
    ])
    expect(r.distritos).toEqual([])
    // El resumen sí cuenta los avisos válidos aunque no tengan distrito.
    expect(r.resumen.find(x => x.operacion === "VENTA")!.avisos).toBe(2)
  })

  it("sin áreas, el precio por m² queda en null", () => {
    const r = calcularEstadisticas([1, 2, 3].map(i => fila("Barranco", "VENTA", 1000 * i)))
    expect(r.distritos[0].precioM2Mediano).toBeNull()
  })

  it("ordena por cantidad de avisos y respeta el máximo", () => {
    const filas = [
      ...Array.from({ length: 5 }, () => fila("A", "VENTA", 1000)),
      ...Array.from({ length: 3 }, () => fila("B", "VENTA", 1000)),
      ...Array.from({ length: 4 }, () => fila("C", "VENTA", 1000)),
    ]
    const r = calcularEstadisticas(filas, { maxDistritos: 2 })
    expect(r.distritos.map(d => d.distrito)).toEqual(["A", "C"])
  })
})
