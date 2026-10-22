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
  config: { pausada: true, tope_mensual: 1000, maximo_por_corrida: 200, dia_reinicio: 23 },
  usado: 300,
  restante: 700,
  ventana: { desde: "2026-09-23", reinicia: "2026-10-23" },
  origen_datos: "apify",
  credito: { usd: 5, costo_por_mil: 3, gasto_usd: 0.9 },
  limites: { tope_mensual: 1500, maximo_por_corrida: 1500, dia_reinicio: [1, 28] },
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
  const conFuentes = (over: Partial<EstadoCarga> = {}) =>
    estado({
      config: { pausada: false, tope_mensual: 1000, maximo_por_corrida: 200, dia_reinicio: 23, tope_urbania: 200 },
      fuentes: [
        { id: "adondevivir", nombre: "Adondevivir", usado: 300, tope: 1000, tope_maximo: 1500, maximo_por_corrida: 200, restante: 700 },
        { id: "urbania", nombre: "Urbania", usado: 20, tope: 200, tope_maximo: 700, maximo_por_corrida: 25, restante: 180 },
      ],
      ...over,
    })

  it("muestra el uso de cada fuente y guarda el tope propio de Urbania", async () => {
    fetchCarga.mockResolvedValue(conFuentes())
    saveCarga.mockResolvedValue({})
    setup()
    const lista = await screen.findByRole("list", { name: "Uso por fuente" })
    expect(lista).toHaveTextContent("Urbania")
    expect(lista).toHaveTextContent("20 / 200")
    const campo = screen.getByLabelText("Tope de Urbania (avisos)")
    await userEvent.clear(campo)
    await userEvent.type(campo, "100")
    await userEvent.click(screen.getByRole("button", { name: /Guardar topes/ }))
    expect(saveCarga).toHaveBeenCalledWith({ tope_mensual: 1000, maximo_por_corrida: 200, tope_urbania: 100 })
  })

  it("no deja pasar el tope de Urbania de su máximo", async () => {
    fetchCarga.mockResolvedValue(conFuentes())
    setup()
    const campo = await screen.findByLabelText("Tope de Urbania (avisos)")
    await userEvent.clear(campo)
    await userEvent.type(campo, "9999")
    expect(screen.getByRole("button", { name: /Guardar topes/ })).toBeDisabled()
  })

  it("«Cargar ahora» envía la fuente elegida", async () => {
    fetchCarga.mockResolvedValue(conFuentes())
    runCarga.mockResolvedValue({ ok: true, items: 25, fuente: "urbania" })
    setup()
    await userEvent.selectOptions(await screen.findByLabelText("Fuente a cargar"), "urbania")
    await userEvent.click(screen.getByRole("button", { name: /Cargar ahora/ }))
    await userEvent.click(await screen.findByRole("button", { name: "Cargar" }))
    expect(runCarga).toHaveBeenCalledWith("urbania")
  })

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
    expect(await screen.findByRole("img", { name: "300 de 1000 avisos usados en este ciclo" })).toBeInTheDocument()
    expect(screen.getByText(/Pediría hasta 200 avisos/)).toBeInTheDocument()
  })

  it("muestra el gasto real, el crédito y el reinicio que informa Apify", async () => {
    fetchCarga.mockResolvedValue(estado())
    setup()
    expect(await screen.findByText("Gasto real en Apify")).toBeInTheDocument()
    expect(screen.getByText(/US\$ 0[.,]90 de US\$ 5[.,]00/)).toBeInTheDocument()
    expect(screen.getByText("Reinicio del crédito")).toBeInTheDocument()
    expect(screen.queryByText(/No se pudo consultar a Apify/)).not.toBeInTheDocument()
  })

  it("nunca ofrece pedir más de lo que queda del tope", async () => {
    fetchCarga.mockResolvedValue(estado({ usado: 980, restante: 20 }))
    setup()
    expect(await screen.findByText(/Pediría hasta 20 avisos/)).toBeInTheDocument()
  })

  it("sin cupo no se puede cargar", async () => {
    fetchCarga.mockResolvedValue(estado({ usado: 1000, restante: 0 }))
    setup()
    expect(await screen.findByText("Sin cupo en este ciclo.")).toBeInTheDocument()
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
    await user.type(tope, "1501")
    expect(guardar).toBeDisabled() // supera el máximo permitido (1500)

    await user.clear(tope)
    await user.type(tope, "800")
    expect(guardar).toBeEnabled()

  })

  it("si Apify no responde, lo avisa y marca el gasto como estimado", async () => {
    fetchCarga.mockResolvedValue(estado({ origen_datos: "estimado" }))
    setup()
    expect(await screen.findByText("Gasto estimado")).toBeInTheDocument()
    expect(screen.getByText(/No se pudo consultar a Apify/)).toBeInTheDocument()
  })

  it("indica qué valores son automáticos, editables o manuales y no pide el día de reinicio", async () => {
    fetchCarga.mockResolvedValue(estado())
    setup()
    await screen.findByText("Gasto real en Apify")
    expect(screen.getAllByText("Automático").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Editable").length).toBe(2) // interruptor y tope
    expect(screen.getByText("Manual")).toBeInTheDocument() // botón «Cargar ahora»
    expect(screen.queryByLabelText(/Día en que se reinicia/)).not.toBeInTheDocument()
  })

  it("lista las últimas cargas con su estado", async () => {
    fetchCarga.mockResolvedValue(
      estado({
        corridas: [
          { id: 2, estado: "completada", origen: "programada", iniciada_por: null, actor: "gio21~adondevivir-scraper", avisos_pedidos: 200, avisos_recibidos: 187, avisos_guardados: 180, detalle: null, iniciada_en: new Date().toISOString(), finalizada_en: null },
          { id: 1, estado: "fallida", origen: "manual", iniciada_por: "admin", avisos_pedidos: 50, avisos_recibidos: 0, avisos_guardados: null, detalle: "No se pudo lanzar en Apify", iniciada_en: new Date().toISOString(), finalizada_en: null },
        ],
      })
    )
    setup()
    expect(await screen.findByText("Completada")).toBeInTheDocument()
    expect(screen.getByText("Fallida")).toBeInTheDocument()
    expect(screen.getByText(/187/)).toBeInTheDocument()
    expect(screen.getByText(/actor gio21/)).toBeInTheDocument()
  })
})
