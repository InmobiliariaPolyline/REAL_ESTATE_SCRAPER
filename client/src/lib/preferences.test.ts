// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  DEFAULT_PREFERENCES,
  applyPreferences,
  loadPreferences,
  sanitizePreferences,
  savePreferences,
} from "./preferences"

describe("sanitizePreferences", () => {
  it("devuelve los valores por defecto ante datos vacíos o inválidos", () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(sanitizePreferences("x")).toEqual(DEFAULT_PREFERENCES)
    expect(sanitizePreferences({ accent: "rosa-fucsia", scale: 3, motion: "no", ambient: "si" })).toEqual(
      DEFAULT_PREFERENCES
    )
  })

  it("conserva los valores válidos e ignora campos desconocidos", () => {
    const p = sanitizePreferences({ accent: "teal", scale: "large", motion: "reduced", ambient: false, extra: 1 })
    expect(p).toEqual({ accent: "teal", scale: "large", motion: "reduced", ambient: false })
  })
})

describe("guardar y cargar", () => {
  it("las preferencias sobreviven a una recarga", () => {
    savePreferences({ ...DEFAULT_PREFERENCES, accent: "violet", scale: "compact" })
    expect(loadPreferences()).toMatchObject({ accent: "violet", scale: "compact" })
  })

  it("un JSON dañado vuelve a los valores por defecto", () => {
    localStorage.setItem("prefs", "{no-es-json")
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES)
  })
})

describe("applyPreferences", () => {
  it("escribe atributos solo cuando difieren del valor por defecto", () => {
    const root = document.createElement("div")
    applyPreferences({ accent: "blue", scale: "large", motion: "reduced", ambient: false }, root)
    expect(root.getAttribute("data-accent")).toBe("blue")
    expect(root.getAttribute("data-scale")).toBe("large")
    expect(root.getAttribute("data-motion")).toBe("reduced")
    expect(root.getAttribute("data-ambient")).toBe("off")

    applyPreferences(DEFAULT_PREFERENCES, root)
    for (const a of ["data-accent", "data-scale", "data-motion", "data-ambient"]) {
      expect(root.hasAttribute(a)).toBe(false)
    }
  })
})
