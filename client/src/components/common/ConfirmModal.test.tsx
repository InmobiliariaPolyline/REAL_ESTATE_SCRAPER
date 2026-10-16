// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import ConfirmModal from "@/components/common/ConfirmModal"

describe("ConfirmModal (accesibilidad)", () => {
  it("es un diálogo modal con nombre y mueve el foco dentro", () => {
    render(<ConfirmModal title="¿Eliminar?" onConfirm={() => {}} onCancel={() => {}} />)
    const dialog = screen.getByRole("dialog", { name: "¿Eliminar?" })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it("mantiene Tab y Shift+Tab dentro del diálogo", async () => {
    const user = userEvent.setup()
    render(<ConfirmModal title="¿Eliminar?" onConfirm={() => {}} onCancel={() => {}} />)
    const cancel = screen.getByRole("button", { name: "Cancelar" })
    const confirm = screen.getByRole("button", { name: "Confirmar" })

    expect(cancel).toHaveFocus()
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it("cierra con Escape", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmModal title="x" onConfirm={() => {}} onCancel={onCancel} />)
    await user.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("no cierra con Escape mientras está ocupado", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmModal title="x" busy onConfirm={() => {}} onCancel={onCancel} />)
    await user.keyboard("{Escape}")
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("devuelve el foco al botón que lo abrió", async () => {
    const user = userEvent.setup()
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          {open && <ConfirmModal title="x" onConfirm={() => {}} onCancel={() => setOpen(false)} />}
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole("button", { name: "Abrir" })
    await user.click(opener)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
