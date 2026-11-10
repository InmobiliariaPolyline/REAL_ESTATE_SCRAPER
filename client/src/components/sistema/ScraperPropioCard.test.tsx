// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider } from "@/contexts/ToastContext"
import type { EstadoScraperPropio } from "@/lib/carga"
import ScraperPropioCard from "./ScraperPropioCard"

const fetchScraperPropio = vi.fn()
const runScraperPropio = vi.fn()

vi.mock("@/lib/carga", async importOriginal => {
  const real = await importOriginal<typeof import("@/lib/carga")>()
  return {
    ...real,
    fetchScraperPropio: (...a: unknown[]) => fetchScraperPropio(...a),
    runScraperPropio: (...a: unknown[]) => runScraperPropio(...a),
  }
})

const estado = (over: Partial<EstadoScraperPropio> = {}): EstadoScraperPropio => ({
  configurado: true,
  repo: "Usuario/Repo",
  fuentes: [
    { id: "adondevivir", nombre: "Adondevivir", propio: false, apify: true, busquedas_apify: 61 },
    { id: "urbania", nombre: "Urbania", propio: false, apify: true, busquedas_apify: 61 },
    { id: "infocasas", nombre: "InfoCasas", propio: true, apify: true, busquedas_apify: 8 },
    { id: "properati", nombre: "Properati", propio: false, apify: true, busquedas_apify: 4 },
  ],
  ejecuciones: [{ id: 1, estado: "completada", origen: "manual", url: "https://github.com/Usuario/Repo/actions/runs/1", iniciada_en: new Date().toISOString(), actualizada_en: new Date().toISOString() }],
  error: null,
  paginas: { por_defecto: 5, maximo: 25 },
  ...over,
})

const setup = () =>
  render(
    <ToastProvider>
      <ScraperPropioCard />
    </ToastProvider>
  )

beforeEach(() => {
  fetchScraperPropio.mockReset()
  runScraperPropio.mockReset()
})

describe("ScraperPropioCard", () => {
  it("muestra qué entidades cubre y las últimas ejecuciones", async () => {
    fetchScraperPropio.mockResolvedValue(estado())
    setup()
    const lista = await screen.findByRole("list", { name: "Cobertura por entidad" })
    const filas = within(lista).getAllByRole("listitem")
    expect(filas).toHaveLength(4)
    expect(within(filas[2]).getByText("InfoCasas")).toBeInTheDocument()
    expect(within(filas[2]).getByText("Scraper propio")).toBeInTheDocument()
    expect(within(filas[1]).getByText("Scraper propio: bloqueado")).toBeInTheDocument()
    expect(within(filas[1]).getByText(/Apify · 61 búsquedas/)).toBeInTheDocument()
    expect(screen.getByText("Completada")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ver en GitHub" })).toHaveAttribute("href", "https://github.com/Usuario/Repo/actions/runs/1")
  })

  it("sin GitHub conectado explica qué falta y no deja ejecutar", async () => {
    fetchScraperPropio.mockResolvedValue(estado({ configurado: false, repo: null, ejecuciones: [] }))
    setup()
    expect(await screen.findByRole("alert")).toHaveTextContent("GITHUB_TOKEN")
    expect(screen.getByRole("button", { name: /Ejecutar scraper propio/ })).toBeDisabled()
  })

  it("muestra el motivo si GitHub rechazó el token", async () => {
    fetchScraperPropio.mockResolvedValue(estado({ error: "GitHub rechazó el token: revisa GITHUB_TOKEN (puede haber vencido)." }))
    setup()
    expect(await screen.findByRole("alert")).toHaveTextContent("rechazó el token")
    expect(screen.getByRole("button", { name: /Ejecutar scraper propio/ })).toBeDisabled()
  })

  it("pide confirmación y lanza el scraper con las páginas elegidas", async () => {
    fetchScraperPropio.mockResolvedValue(estado())
    runScraperPropio.mockResolvedValue({ ok: true, paginas: 3 })
    const user = userEvent.setup()
    setup()
    const campo = await screen.findByLabelText("Páginas por búsqueda")
    await user.clear(campo)
    await user.type(campo, "3")
    await user.click(screen.getByRole("button", { name: /Ejecutar scraper propio/ }))
    await user.click(await screen.findByRole("button", { name: "Ejecutar" }))
    await waitFor(() => expect(runScraperPropio).toHaveBeenCalledWith(3))
  })

  it("no deja ejecutar con páginas fuera de rango ni mientras hay una ejecución en curso", async () => {
    fetchScraperPropio.mockResolvedValue(estado())
    const user = userEvent.setup()
    const { unmount } = setup()
    const campo = await screen.findByLabelText("Páginas por búsqueda")
    await user.clear(campo)
    await user.type(campo, "99")
    expect(screen.getByRole("button", { name: /Ejecutar scraper propio/ })).toBeDisabled()
    unmount()

    fetchScraperPropio.mockResolvedValue(estado({ ejecuciones: [{ id: 2, estado: "en_curso", origen: "manual", url: "https://github.com/Usuario/Repo/actions/runs/2", iniciada_en: new Date().toISOString(), actualizada_en: "" }] }))
    setup()
    expect(await screen.findByText("En curso")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ejecutar scraper propio/ })).toBeDisabled()
    expect(screen.getByText("Hay una ejecución en curso.")).toBeInTheDocument()
  })

  it("si no se puede consultar, lo dice sin romper la pantalla", async () => {
    fetchScraperPropio.mockRejectedValue(new Error("red"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    setup()
    expect(await screen.findByText(/No se pudo consultar el scraper propio/)).toBeInTheDocument()
  })
})
