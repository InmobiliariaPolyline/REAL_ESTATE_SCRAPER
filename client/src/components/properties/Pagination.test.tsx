// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Pagination from "@/components/properties/Pagination"

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

describe("Pagination", () => {
  it("muestra el rango y usa el sustantivo indicado", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={() => {}} totalItems={120} itemsPerPage={24} noun="registros" />
    )
    const nav = screen.getByRole("navigation", { name: "Paginación" })
    expect(nav).toHaveTextContent("25–48 de 120 registros")
  })

  it("deshabilita anterior en la primera página y siguiente en la última", () => {
    const { rerender } = render(
      <Pagination currentPage={0} totalPages={3} onPageChange={() => {}} totalItems={60} itemsPerPage={24} />
    )
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Página siguiente" })).toBeEnabled()

    rerender(<Pagination currentPage={2} totalPages={3} onPageChange={() => {}} totalItems={60} itemsPerPage={24} />)
    expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled()
  })

  it("marca la página actual y navega al pulsar otra", async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={0} totalPages={3} onPageChange={onPageChange} totalItems={60} itemsPerPage={24} />)

    expect(screen.getByRole("button", { name: "Ir a página 1" })).toHaveAttribute("aria-current", "page")
    await user.click(screen.getByRole("button", { name: "Ir a página 3" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
