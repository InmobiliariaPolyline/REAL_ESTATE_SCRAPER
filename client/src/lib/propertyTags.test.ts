import { describe, expect, it } from "vitest"
import { getDisplayPrice } from "./prices"
import { areaNumero, esAlquiler, esNuevo, estadoDeAntiguedad, formatoArea, operacionVisual, precioPorM2Texto, tipoVisual, ubicacionTexto } from "./propertyTags"

describe("tipoVisual", () => {
  it("da icono y color propios a cada tipo, sin importar mayúsculas ni tildes", () => {
    expect(tipoVisual("Departamento")).toMatchObject({ label: "Departamento", tono: "blue" })
    expect(tipoVisual("casa")).toMatchObject({ label: "Casa", tono: "green" })
    expect(tipoVisual("Local comercial")).toMatchObject({ label: "Local comercial", tono: "rose" })
    expect(tipoVisual("Proyecto")).toMatchObject({ label: "Proyecto", tono: "gold" })
    expect(tipoVisual("HABITACIÓN")).toMatchObject({ label: "Habitación", tono: "violet" })
  })

  it("lo desconocido se muestra neutro con su propio nombre, y sin tipo dice «Inmueble»", () => {
    expect(tipoVisual("Penthouse")).toMatchObject({ label: "Penthouse", tono: "muted" })
    expect(tipoVisual(undefined).label).toBe("Inmueble")
    expect(tipoVisual("").label).toBe("Inmueble")
  })
})

describe("operación y estado", () => {
  it("venta y alquiler", () => {
    expect(operacionVisual("ALQUILER")).toMatchObject({ label: "Alquiler", tono: "green" })
    expect(operacionVisual("VENTA")).toMatchObject({ label: "Venta", tono: "rose" })
    expect(esAlquiler("alquiler")).toBe(true)
    expect(esAlquiler("VENTA")).toBe(false)
  })

  it("el estado de la construcción sale de la antigüedad", () => {
    expect(estadoDeAntiguedad("Estreno")).toMatchObject({ label: "Estreno", tono: "green" })
    expect(estadoDeAntiguedad("A estrenar")).toMatchObject({ label: "Estreno" })
    expect(estadoDeAntiguedad("En construcción")).toMatchObject({ label: "En construcción", tono: "amber" })
    expect(estadoDeAntiguedad("7 años")).toMatchObject({ label: "7 años", tono: "muted" })
    expect(estadoDeAntiguedad("1 años")?.label).toBe("1 año")
    expect(estadoDeAntiguedad("")).toBeNull()
    expect(estadoDeAntiguedad(null)).toBeNull()
    expect(estadoDeAntiguedad("depende")).toBeNull()
  })
})

describe("formato", () => {
  it("«Nuevo» solo dentro de los últimos 3 días", () => {
    const ahora = Date.parse("2026-11-10T12:00:00Z")
    expect(esNuevo("2026-11-10T08:00:00Z", 72, ahora)).toBe(true)
    expect(esNuevo("2026-11-07T13:00:00Z", 72, ahora)).toBe(true)
    expect(esNuevo("2026-11-06T12:00:00Z", 72, ahora)).toBe(false)
    expect(esNuevo("2026-11-11T12:00:00Z", 72, ahora)).toBe(false) // fecha futura
    expect(esNuevo(undefined)).toBe(false)
    expect(esNuevo("no es fecha")).toBe(false)
  })

  it("el área usa m² y se lee el primer número", () => {
    expect(formatoArea("147 m2")).toBe("147 m²")
    expect(formatoArea(" 85,5 M2 ")).toBe("85,5 m²")
    expect(formatoArea(null)).toBe("")
    expect(areaNumero("85,5 m2")).toBe(85.5)
    expect(areaNumero("sin dato")).toBeNull()
  })

  it("el precio por m² se calcula en la moneda mostrada y se omite sin precio o con un área irreal", () => {
    const soles = getDisplayPrice(300000, 80000, "PEN", "PEN")
    expect(precioPorM2Texto(soles, "100 m2")).toBe("S/ 3,000 por m²")
    expect(precioPorM2Texto(soles, "1 m2")).toBeNull()
    expect(precioPorM2Texto(soles, "")).toBeNull()
    expect(precioPorM2Texto(getDisplayPrice(0, 0, "PEN"), "100 m2")).toBeNull()
  })

  it("la ubicación agrega el departamento solo cuando no es Lima", () => {
    expect(ubicacionTexto("Miraflores", "Lima")).toBe("Miraflores")
    expect(ubicacionTexto("Cayma", "Arequipa")).toBe("Cayma, Arequipa")
    expect(ubicacionTexto("Arequipa", "Arequipa")).toBe("Arequipa")
    expect(ubicacionTexto("", "Piura")).toBe("Piura")
    expect(ubicacionTexto("Surco", null)).toBe("Surco")
  })
})
