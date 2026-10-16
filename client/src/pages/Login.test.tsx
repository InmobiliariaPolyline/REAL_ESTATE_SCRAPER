// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Login from "@/pages/Login"

const loginMock = vi.fn()
vi.mock("@/lib/auth", () => ({ login: (...args: unknown[]) => loginMock(...args) }))

const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText("Tu usuario"), "ana")
  await user.type(screen.getByPlaceholderText("Tu contraseña"), "secreto-123")
}

beforeEach(() => loginMock.mockReset())

describe("Login", () => {
  it("envía las credenciales y avisa del éxito", async () => {
    const user = userEvent.setup()
    const snapshot = { vista: "portal" }
    loginMock.mockResolvedValue({ ok: true, snapshot })
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await fill(user)
    await user.click(screen.getByRole("button", { name: "Ingresar" }))

    expect(loginMock).toHaveBeenCalledWith("ana", "secreto-123")
    expect(onLoginSuccess).toHaveBeenCalledWith(snapshot)
  })

  it("muestra el motivo cuando las credenciales son incorrectas", async () => {
    const user = userEvent.setup()
    loginMock.mockResolvedValue({ ok: false, reason: "invalid" })
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await fill(user)
    await user.click(screen.getByRole("button", { name: "Ingresar" }))

    expect(await screen.findByText("Usuario o contraseña incorrectos")).toBeInTheDocument()
    expect(onLoginSuccess).not.toHaveBeenCalled()
  })

  it("informa del bloqueo temporal y de los fallos de red", async () => {
    const user = userEvent.setup()
    vi.spyOn(console, "error").mockImplementation(() => {})
    loginMock.mockResolvedValueOnce({ ok: false, reason: "locked" })
    render(<Login onLoginSuccess={() => {}} />)
    await fill(user)
    await user.click(screen.getByRole("button", { name: "Ingresar" }))
    expect(await screen.findByText(/Demasiados intentos fallidos/)).toBeInTheDocument()

    loginMock.mockRejectedValueOnce(new Error("boom"))
    await user.click(screen.getByRole("button", { name: "Ingresar" }))
    expect(await screen.findByText("Error al conectar con el servidor")).toBeInTheDocument()
  })

  it("permite mostrar y ocultar la contraseña", async () => {
    const user = userEvent.setup()
    render(<Login onLoginSuccess={() => {}} />)
    const input = screen.getByPlaceholderText("Tu contraseña")
    expect(input).toHaveAttribute("type", "password")
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }))
    expect(input).toHaveAttribute("type", "text")
  })
})
