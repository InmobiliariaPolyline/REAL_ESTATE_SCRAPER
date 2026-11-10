// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import PortalTabs from "./PortalTabs"

describe("PortalTabs", () => {
  it("la barra superior y la fila de pantallas chicas tienen las mismas cinco secciones", () => {
    render(
      <>
        <PortalTabs view="catalogo" onChange={() => {}} variant="barra" />
        <PortalTabs view="catalogo" onChange={() => {}} />
      </>
    )
    const barras = screen.getAllByRole("tablist")
    expect(barras).toHaveLength(2)
    for (const b of barras) {
      expect(Array.from(b.querySelectorAll('[role="tab"]')).map(t => t.textContent)).toEqual(["Inicio", "Catálogo", "Estadísticas", "Calculadora", "Cuenta"])
    }
    // La sección activa se marca en ambas.
    expect(screen.getAllByRole("tab", { selected: true }).map(t => t.textContent)).toEqual(["Catálogo", "Catálogo"])
  })

  it("al elegir una sección avisa cuál", async () => {
    const onChange = vi.fn()
    render(<PortalTabs view="inicio" onChange={onChange} variant="barra" />)
    await userEvent.setup().click(screen.getByRole("tab", { name: "Estadísticas" }))
    expect(onChange).toHaveBeenCalledWith("estadisticas")
  })
})
