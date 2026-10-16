// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Home, LogOut } from "lucide-react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import CommandPalette from "@/components/common/CommandPalette"

// cmdk usa estas APIs del navegador que jsdom no trae.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView ??= () => {}
})

const setup = () => {
  const inicio = vi.fn()
  const salir = vi.fn()
  render(
    <CommandPalette
      actions={[
        { id: "inicio", label: "Ir a Inicio", group: "Secciones", icon: Home, keywords: ["resumen"], run: inicio },
        { id: "salir", label: "Cerrar sesión", group: "Cuenta", icon: LogOut, run: salir },
      ]}
    />
  )
  return { inicio, salir }
}

describe("CommandPalette", () => {
  it("se abre con Ctrl+K y muestra las acciones agrupadas", async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.keyboard("{Control>}k{/Control}")
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Ir a Inicio")).toBeInTheDocument()
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument()
  })

  it("filtra por texto y por sinónimos, y ejecuta la acción elegida", async () => {
    const user = userEvent.setup()
    const { inicio, salir } = setup()

    await user.keyboard("{Control>}k{/Control}")
    await user.keyboard("resumen")
    expect(screen.queryByText("Cerrar sesión")).not.toBeInTheDocument()

    await user.click(screen.getByText("Ir a Inicio"))
    await vi.waitFor(() => expect(inicio).toHaveBeenCalledTimes(1))
    expect(salir).not.toHaveBeenCalled()
  })

  it("también se abre con el evento global (botones «Buscar»)", async () => {
    setup()
    window.dispatchEvent(new Event("open-command-palette"))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })
})
