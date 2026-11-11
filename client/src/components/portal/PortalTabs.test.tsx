// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import PortalSidebar, { diasHasta } from "./PortalSidebar"
import PortalTabs from "./PortalTabs"

const SECCIONES = ["Inicio", "Catálogo", "Estadísticas", "Calculadora", "Cuenta"]

describe("PortalTabs (pantallas chicas)", () => {
  it("lista las cinco secciones y marca la activa", () => {
    render(<PortalTabs view="catalogo" onChange={() => {}} />)
    const tabs = screen.getAllByRole("tab")
    expect(tabs.map(t => t.textContent)).toEqual(SECCIONES)
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Catálogo")
  })
})

describe("PortalSidebar", () => {
  const base = { view: "inicio" as const, onChange: () => {}, planType: "PREMIUM" as const, fechaVencimiento: "18/12/2026", onLogout: () => {} }

  it("tiene las mismas secciones, marca la activa con aria-current y avisa cuál se elige", async () => {
    const onChange = vi.fn()
    render(<PortalSidebar {...base} view="estadisticas" onChange={onChange} />)
    const tabs = screen.getAllByRole("tab")
    expect(tabs.map(t => t.textContent)).toEqual(SECCIONES)
    expect(screen.getByRole("tab", { name: "Estadísticas" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("tab", { name: "Inicio" })).not.toHaveAttribute("aria-current")
    await userEvent.setup().click(screen.getByRole("tab", { name: "Calculadora" }))
    expect(onChange).toHaveBeenCalledWith("calculadora")
  })

  it("muestra el plan con los días que quedan, y cerrar sesión", async () => {
    const onLogout = vi.fn()
    const en10 = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
    render(<PortalSidebar {...base} venceEn={en10} onLogout={onLogout} />)
    expect(screen.getByText("Plan Premium")).toBeInTheDocument()
    expect(screen.getByText(/días restantes/)).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /días restantes del plan/ })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("button", { name: /Cerrar sesión/ }))
    expect(onLogout).toHaveBeenCalled()
  })

  it("sin fecha de vencimiento válida muestra solo la fecha, y el plan gratuito lo dice", () => {
    render(<PortalSidebar {...base} planType="GRATIS" venceEn={undefined} />)
    expect(screen.getByText("Plan gratuito")).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: /días restantes/ })).toBeNull()
  })
})

describe("diasHasta", () => {
  it("cuenta los días que faltan, nunca negativos", () => {
    const ahora = Date.parse("2026-11-10T17:00:00Z") // mediodía en Lima
    expect(diasHasta("2026-11-20", ahora)).toBe(10)
    expect(diasHasta("2026-11-10", ahora)).toBe(0)
    expect(diasHasta("2026-10-01", ahora)).toBe(0)
    // Cuenta por fecha de calendario en Lima, no por horas: a las 23:30 de Lima sigue siendo el mismo día.
    expect(diasHasta("2026-12-10", Date.parse("2026-11-11T04:30:00Z"))).toBe(30)
    expect(diasHasta("2026-12-10", Date.parse("2026-11-10T17:00:00Z"))).toBe(30)
    expect(diasHasta(undefined, ahora)).toBeNull()
    expect(diasHasta("no es fecha", ahora)).toBeNull()
  })
})
