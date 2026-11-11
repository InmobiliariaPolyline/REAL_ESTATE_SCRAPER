import fs from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
// @ts-expect-error módulo .mjs sin tipos: es el script que se entrega para correr con Node
import { enviarAvisos } from "./enviar_avisos.mjs"

afterEach(() => vi.unstubAllGlobals())

describe("scraper/enviar_avisos.mjs", () => {
  const url = "https://sitio.test/api/ingesta"

  it("envía en lotes de 200 con el token y suma las respuestas", async () => {
    const llamadas: { auth: string | null; n: number }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        const avisos = JSON.parse(init.body as string).avisos as unknown[]
        llamadas.push({ auth: (init.headers as Record<string, string>).Authorization, n: avisos.length })
        return new Response(JSON.stringify({ recibidos: avisos.length, guardados: avisos.length - 1, descartados: 1 }), { status: 200 })
      })
    )
    const avisos = Array.from({ length: 450 }, (_, i) => ({ portal: "urbania", codigo: String(i) }))
    const total = await enviarAvisos(avisos, url, "tok")
    expect(llamadas).toEqual([{ auth: "Bearer tok", n: 200 }, { auth: "Bearer tok", n: 200 }, { auth: "Bearer tok", n: 50 }])
    expect(total).toEqual({ recibidos: 450, guardados: 447, descartados: 3, retirados: 0 })
  })

  it("los avisos retirados del portal viajan con el primer lote (y solos si no hay avisos)", async () => {
    const cuerpos: { avisos: unknown[]; retirados?: unknown[] }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        cuerpos.push(JSON.parse(init.body as string))
        return new Response(JSON.stringify({ recibidos: 0, guardados: 0, descartados: 0, retirados: 1 }), { status: 200 })
      })
    )
    const retirados = [{ portal: "infocasas", codigo: "proyecto-madre-selva" }]
    await enviarAvisos(Array.from({ length: 250 }, (_, i) => ({ portal: "infocasas", codigo: String(i) })), url, "tok", retirados)
    expect(cuerpos.map(c => [c.avisos.length, c.retirados?.length ?? 0])).toEqual([[200, 1], [50, 0]])
    cuerpos.length = 0
    const solo = await enviarAvisos([], url, "tok", retirados)
    expect(cuerpos).toEqual([{ avisos: [], retirados }])
    expect(solo.retirados).toBe(1)
  })

  it("si la API rechaza el envío, falla con su respuesta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("prohibido", { status: 403 })))
    await expect(enviarAvisos([{ portal: "urbania", codigo: "1" }], url, "mal")).rejects.toThrow("403 prohibido")
  })

  it("el archivo de ejemplo es JSON válido con avisos que la API acepta", () => {
    const ejemplo = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "ejemplo-avisos.json"), "utf8"))
    expect(ejemplo.avisos).toHaveLength(2)
    for (const a of ejemplo.avisos) {
      expect(["adondevivir", "urbania", "infocasas", "properati", "babilonia"]).toContain(a.portal)
      expect(["VENTA", "ALQUILER"]).toContain(a.operacion)
      expect(a.codigo).toBeTruthy()
    }
  })
})
