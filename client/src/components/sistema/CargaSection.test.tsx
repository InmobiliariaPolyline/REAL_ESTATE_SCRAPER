// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider } from "@/contexts/ToastContext"
import type { EstadoCarga } from "@/lib/carga"
import CargaSection from "./CargaSection"

const fetchCarga = vi.fn()
const saveCarga = vi.fn()
const runCarga = vi.fn()

vi.mock("@/lib/carga", async importOriginal => {
  const real = await importOriginal<typeof import("@/lib/carga")>()
  return {
    ...real,
    fetchCarga: (...a: unknown[]) => fetchCarga(...a),
    saveCarga: (...a: unknown[]) => saveCarga(...a),
    runCarga: (...a: unknown[]) => runCarga(...a),
  }
})

const estado = (over: Partial<EstadoCarga> = {}): EstadoCarga => ({
  configurada: true,
  config: { pausada: true, tope_mensual: 1000, maximo_por_corrida: 200 },
  usado: 300,
  restante: 700,
  limites: { tope_mensual: 5000, maximo_por_corrida: 2000 },
  corridas: [],
  ...over,
})

const setup = () =>
  render(
    <ToastProvider>
      <CargaSection />
    </ToastProvider>
  )

beforeEach(() => {
  fetchCarga.mockReset()
  saveCarga.mockReset()
  runCarga.mockReset()
})

describe("CargaSection", () => {
  it("avisa cuando Apify no está conectado y no deja activar ni cargar", async () => {
    fetchCarga.mockResolvedValue(estado({ configurada: false }))
    setup()
    expect(await screen.findByText(/Falta conectar Apify/)).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Carga automática" })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Cargar ahora/ })).toBeDisabled()
  })

  it("muestra el uso del mes y lo que quedaría por pedir", async () => {
    fetchCarga.mockResolvedValue(estado())
    setup()
    expect(await screen.findByRole("img", { name: "300 de 1000 avisos usados este mes" })).toBeInTheDocument()
    expect(screen.getByText(/Pediría hasta 200 avisos/)).toBeInTheDocument()
  })

  it("nunca ofrece pedir más de lo que queda del tope", async () => {
    fetchCarga.mockResolvedValue(estado({ usado: 980, restante: 20 }))
    setup()
    expect(await screen.findByText(/Pediría hasta 20 avisos/)).toBeInTheDocument()
  })

  it("sin cupo no se puede cargar", async () => {
    fetchCarga.mockResolvedValue(estado({ usado: 1000, restante: 0 }))
    setup()
    expect(await screen.findByText("Sin cupo este mes.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cargar ahora/ })).toBeDisabled()
  })

  it("el interruptor activa la carga automática", async () => {
    const user = userEvent.setup()
    fetchCarga.mockResolvedValue(estado())
    saveCarga.mockResolvedValue({})
    setup()
    await user.click(await screen.findByRole("switch", { name: "Carga automática" }))
    expect(saveCarga).toHaveBeenCalledWith({ pausada: false })
  })

  it("«Cargar ahora» pide confirmación con la cantidad y recién entonces llama a la API", async () => {
    const user = userEvent.setup()
    fetchCarga.mockResolvedValue(estado())
    runCarga.mockResolvedValue({ ok: true, items: 200 })
    setup()

    await user.click(await screen.findByRole("button", { name: /Cargar ahora/ }))
    expect(runCarga).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("dialog", { name: "¿Cargar avisos ahora?" })
    expect(dialog).toHaveTextContent("200")

    await user.click(screen.getByRole("button", { name: "Cargar" }))
    expect(runCarga).toHaveBeenCalledTimes(1)
  })

  it("no deja guardar topes fuera de los límites", async () => {
    const user = userEvent.setup()
    fetchCarga.mockResolvedValue(estado())
    setup()
    const tope = await screen.findByLabelText(/Tope mensual/)
    const guardar = screen.getByRole("button", { name: /Guardar topes/ })
    expect(guardar).toBeDisabled() // sin cambios

    await user.clear(tope)
    await user.type(tope, "9999")
    expect(guardar).toBeDisabled() // supera el máximo de 5000

    await user.clear(tope)
    await user.type(tope, "800")
    expect(guardar).toBeEnabled()
  })

  it("lista las últimas cargas con su estado", async () => {
    fetchCarga.mockResolvedValue(
      estado({
        corridas: [
          { id: 2, estado: "completada", origen: "programada", iniciada_por: null, avisos_pedidos: 200, avisos_recibidos: 187, avisos_guardados: 180, detalle: null, iniciada_en: new Date().toISOString(), finalizada_en: null },
          { id: 1, estado: "fallida", origen: "manual", iniciada_por: "admin", avisos_pedidos: 50, avisos_recibidos: 0, avisos_guardados: null, detalle: "No se pudo lanzar en Apify", iniciada_en: new Date().toISOString(), finalizada_en: null },
        ],
      })
    )
    setup()
    expect(await screen.findByText("Completada")).toBeInTheDocument()
    expect(screen.getByText("Fallida")).toBeInTheDocument()
    expect(screen.getByText(/187/)).toBeInTheDocument()
  })
})
