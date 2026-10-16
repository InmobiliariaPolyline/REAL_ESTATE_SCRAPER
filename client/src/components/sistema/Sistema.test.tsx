// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import Switch from "@/components/common/Switch"
import { PreferencesProvider } from "@/contexts/PreferencesContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import PersonalizacionSection from "./PersonalizacionSection"
import SistemaModule, { sectionsFor } from "./SistemaModule"

// Las secciones con datos remotos se sustituyen: aquí solo se prueba la navegación.
vi.mock("./PerfilSection", () => ({ default: () => <p>contenido-perfil</p> }))
vi.mock("./SeguridadSection", () => ({ default: () => <p>contenido-seguridad</p> }))
vi.mock("./AcercaSection", () => ({ default: () => <p>contenido-acerca</p> }))
vi.mock("@/components/admin/AdminActividad", () => ({ default: () => <p>contenido-actividad</p> }))
vi.mock("@/components/admin/AdminAuditoria", () => ({ default: () => <p>contenido-auditoria</p> }))

describe("Switch", () => {
  it("alterna y expone aria-checked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<Switch label="Luz" checked={false} onChange={onChange} />)
    const sw = screen.getByRole("switch", { name: "Luz" })
    expect(sw).toHaveAttribute("aria-checked", "false")
    await user.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
    rerender(<Switch label="Luz" checked onChange={onChange} />)
    expect(screen.getByRole("switch", { name: "Luz" })).toHaveAttribute("aria-checked", "true")
  })
})

describe("secciones por rol", () => {
  it("el cliente no ve Actividad ni Auditoría", () => {
    const ids = sectionsFor(false).map(s => s.id)
    expect(ids).toEqual(["perfil", "seguridad", "personalizacion", "acerca"])
    expect(sectionsFor(true).map(s => s.id)).toEqual([
      "perfil",
      "seguridad",
      "personalizacion",
      "actividad",
      "auditoria",
      "acerca",
    ])
  })
})

describe("SistemaModule", () => {
  it("muestra la sub-barra y la sección activa, y avisa al cambiar", async () => {
    const user = userEvent.setup()
    const onSectionChange = vi.fn()
    render(<SistemaModule esAdmin section="perfil" onSectionChange={onSectionChange} onLogout={() => {}} />)

    expect(screen.getByRole("navigation", { name: "Secciones del sistema" })).toBeInTheDocument()
    expect(await screen.findByText("contenido-perfil")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Perfil" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Auditoría" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Seguridad" }))
    expect(onSectionChange).toHaveBeenCalledWith("seguridad")
  })

  it("renderiza la sección pedida y oculta las de administrador al cliente", async () => {
    render(<SistemaModule esAdmin={false} section="acerca" onSectionChange={() => {}} onLogout={() => {}} />)
    expect(await screen.findByText("contenido-acerca")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Auditoría" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Actividad" })).not.toBeInTheDocument()
  })

  it("una sección de administrador pedida por un cliente cae en la primera permitida", async () => {
    render(<SistemaModule esAdmin={false} section="auditoria" onSectionChange={() => {}} onLogout={() => {}} />)
    expect(await screen.findByText("contenido-perfil")).toBeInTheDocument()
    expect(screen.queryByText("contenido-auditoria")).not.toBeInTheDocument()
  })
})

describe("PersonalizacionSection", () => {
  const setup = () =>
    render(
      <ThemeProvider defaultTheme="dark" switchable>
        <PreferencesProvider>
          <PersonalizacionSection />
        </PreferencesProvider>
      </ThemeProvider>
    )

  it("cambia el acento y lo refleja en <html> y en el almacenamiento", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: "Azul" }))
    expect(document.documentElement).toHaveAttribute("data-accent", "blue")
    expect(JSON.parse(localStorage.getItem("prefs")!)).toMatchObject({ accent: "blue" })
    expect(screen.getByRole("button", { name: "Azul" })).toHaveAttribute("aria-pressed", "true")
  })

  it("el tamaño, las animaciones y la luz ambiental se aplican y se pueden restablecer", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole("button", { name: /Amplia/ }))
    await user.click(screen.getByRole("switch", { name: "Reducir animaciones" }))
    await user.click(screen.getByRole("switch", { name: "Luz ambiental" }))
    const root = document.documentElement
    expect(root).toHaveAttribute("data-scale", "large")
    expect(root).toHaveAttribute("data-motion", "reduced")
    expect(root).toHaveAttribute("data-ambient", "off")

    await user.click(screen.getByRole("button", { name: /Restablecer valores/ }))
    for (const a of ["data-scale", "data-motion", "data-ambient", "data-accent"]) {
      expect(root.hasAttribute(a)).toBe(false)
    }
  })

  it("alterna el tema", async () => {
    const user = userEvent.setup()
    setup()
    expect(document.documentElement).toHaveClass("dark")
    await user.click(screen.getByRole("button", { name: "Claro" }))
    expect(document.documentElement).toHaveClass("light")
  })
})
