import { describe, expect, it } from "vitest"
import { mensajeRenovacion, whatsappLink } from "./insights"

describe("mensajeRenovacion", () => {
  it("redacta el mensaje según los días que faltan", () => {
    expect(mensajeRenovacion("ana", "2026-10-20", 3)).toContain("vence el 20/10/2026")
    expect(mensajeRenovacion("ana", "2026-10-17", 0)).toContain("vence hoy (17/10/2026)")
    expect(mensajeRenovacion("ana", "2026-10-10", -6)).toContain("venció el 10/10/2026")
    expect(mensajeRenovacion("ana", "2026-10-20", 3)).toContain("Hola ana")
  })
})

describe("whatsappLink", () => {
  it("codifica el texto para la URL", () => {
    const url = whatsappLink("Hola & adiós")
    expect(url.startsWith("https://wa.me/?text=")).toBe(true)
    expect(url).toContain(encodeURIComponent("Hola & adiós"))
  })
})
