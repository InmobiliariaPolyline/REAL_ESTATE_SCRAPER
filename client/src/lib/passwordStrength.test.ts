import { describe, expect, it } from "vitest"
import { passwordStrength } from "./passwordStrength"

describe("passwordStrength", () => {
  it("vacía no puntúa", () => {
    expect(passwordStrength("")).toEqual({ score: 0, label: "" })
  })

  it("las claves triviales salen débiles", () => {
    expect(passwordStrength("aaaaaaaa").score).toBe(1)
    expect(passwordStrength("12345678").score).toBe(1)
    expect(passwordStrength("password").score).toBe(1)
  })

  it("mejora con longitud y variedad", () => {
    const corta = passwordStrength("Abcdefg1").score
    const larga = passwordStrength("Mi-clave-larga-2026!").score
    expect(larga).toBeGreaterThan(corta)
    expect(larga).toBe(4)
  })

  it("devuelve siempre una etiqueta coherente con la puntuación", () => {
    for (const pwd of ["a", "abcdefgh", "Abcdefgh1", "Abcdefgh1!xyz", "x7#Kp9!mQ2$vL4&z"]) {
      const { score, label } = passwordStrength(pwd)
      expect(score).toBeGreaterThanOrEqual(1)
      expect(score).toBeLessThanOrEqual(4)
      expect(label.length).toBeGreaterThan(0)
    }
  })
})
