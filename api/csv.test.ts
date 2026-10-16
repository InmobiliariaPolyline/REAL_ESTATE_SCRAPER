import { describe, expect, it } from "vitest"
import { csvCell, toCsv } from "./csv"

describe("csvCell", () => {
  it("deja intactos los textos simples y los números", () => {
    expect(csvCell("Lince")).toBe("Lince")
    expect(csvCell(1200.5)).toBe("1200.5")
    expect(csvCell(-5)).toBe("-5")
    expect(csvCell(null)).toBe("")
    expect(csvCell(undefined)).toBe("")
  })

  it("entrecomilla comas, comillas, punto y coma y saltos de línea", () => {
    expect(csvCell("a,b")).toBe('"a,b"')
    expect(csvCell('di "hola"')).toBe('"di ""hola"""')
    expect(csvCell("a;b")).toBe('"a;b"')
    expect(csvCell("línea1\nlínea2")).toBe('"línea1\nlínea2"')
  })

  it("neutraliza la inyección de fórmulas en textos", () => {
    expect(csvCell("=1+1")).toBe("'=1+1")
    expect(csvCell("+cmd")).toBe("'+cmd")
    expect(csvCell("-2+3")).toBe("'-2+3")
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(csvCell("\t=x")).toBe("'\t=x")
  })

  it("serializa fechas en ISO", () => {
    expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z")
  })
})

describe("toCsv", () => {
  it("genera BOM, cabecera y filas con CRLF", () => {
    const csv = toCsv(
      [{ a: 1, b: "x,y" }, { a: 2, b: null }],
      [
        { header: "A", get: r => r.a },
        { header: "B", get: r => r.b },
      ]
    )
    expect(csv).toBe("﻿A,B\r\n1,\"x,y\"\r\n2,\r\n")
  })
})
