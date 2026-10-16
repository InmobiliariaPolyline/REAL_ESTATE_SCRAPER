// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import ThemeToggle from "@/components/common/ThemeToggle"
import { ThemeProvider } from "@/contexts/ThemeContext"

const setup = () =>
  render(
    <ThemeProvider defaultTheme="dark" switchable>
      <ThemeToggle />
    </ThemeProvider>
  )

describe("ThemeToggle", () => {
  it("arranca en oscuro y ofrece cambiar a claro", () => {
    setup()
    expect(document.documentElement).toHaveClass("dark")
    expect(screen.getByRole("button", { name: "Cambiar a tema claro" })).toBeInTheDocument()
  })

  it("alterna el tema, actualiza la etiqueta y recuerda la preferencia", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole("button", { name: "Cambiar a tema claro" }))
    expect(document.documentElement).toHaveClass("light")
    expect(document.documentElement).not.toHaveClass("dark")
    expect(localStorage.getItem("theme")).toBe("light")
    expect(screen.getByRole("button", { name: "Cambiar a tema oscuro" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Cambiar a tema oscuro" }))
    expect(document.documentElement).toHaveClass("dark")
    expect(localStorage.getItem("theme")).toBe("dark")
  })

  it("respeta la preferencia guardada", () => {
    localStorage.setItem("theme", "light")
    setup()
    expect(document.documentElement).toHaveClass("light")
  })

  it("no se muestra si el tema no es conmutable", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
      </ThemeProvider>
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
