import { describe, expect, it } from "vitest"
import pkg from "../../../package.json"
import { VERSIONES, VERSION_ACTUAL, contarPorTipo } from "./changelog"

const semver = (v: string) => v.split(".").map(Number)

describe("changelog", () => {
  it("la versión actual coincide con package.json (se actualizan juntas)", () => {
    expect(VERSION_ACTUAL).toBe(pkg.version)
  })

  it("las versiones están ordenadas de la más reciente a la más antigua y no se repiten", () => {
    const nums = VERSIONES.map(v => semver(v.version))
    for (let i = 1; i < nums.length; i++) {
      const [a, b] = [nums[i - 1], nums[i]]
      const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
      expect(newer).toBeGreaterThan(0)
    }
    expect(new Set(VERSIONES.map(v => v.version)).size).toBe(VERSIONES.length)
  })

  it("cada versión tiene fecha válida, título y cambios", () => {
    for (const v of VERSIONES) {
      expect(v.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(v.fecha))).toBe(false)
      expect(v.titulo.length).toBeGreaterThan(0)
      expect(v.cambios.length).toBeGreaterThan(0)
    }
  })

  it("contarPorTipo suma todos los cambios", () => {
    const total = Object.values(contarPorTipo()).reduce((a, b) => a + b, 0)
    expect(total).toBe(VERSIONES.reduce((n, v) => n + v.cambios.length, 0))
  })
})
