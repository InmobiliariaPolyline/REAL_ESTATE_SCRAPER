import { beforeEach, describe, expect, it, vi } from "vitest"

const get = vi.fn()
vi.mock("./api", () => ({ api: { get: (...a: unknown[]) => get(...a) } }))

import { EMPTY_ADMIN_SEARCH, fetchAdminPage } from "./propertiesApi"

beforeEach(() => get.mockReset().mockResolvedValue({ data: [], count: 0 }))

describe("fetchAdminPage", () => {
  it("no filtra por la moneda original del aviso: con «USD» elegido siguen viéndose los avisos en soles", async () => {
    await fetchAdminPage({ ...EMPTY_ADMIN_SEARCH, moneda: "USD" }, 0, 20)
    const [path, params] = get.mock.calls[0] as [string, Record<string, unknown>]
    expect(path).toBe("/admin/propiedades")
    expect(params).not.toHaveProperty("moneda")
  })

  it("la moneda solo sirve para interpretar el rango de precios (siempre se envía normalizado a USD)", async () => {
    await fetchAdminPage({ ...EMPTY_ADMIN_SEARCH, moneda: "USD", precioMin: "100000", precioMax: "200000" }, 0, 20)
    expect(get.mock.calls[0][1]).toMatchObject({ minUsd: 100000, maxUsd: 200000 })

    get.mockClear()
    await fetchAdminPage({ ...EMPTY_ADMIN_SEARCH, moneda: "PEN", precioMin: "375000" }, 0, 20)
    const enviado = get.mock.calls[0][1] as { minUsd: number }
    expect(enviado.minUsd).toBeGreaterThan(0)
    expect(enviado.minUsd).toBeLessThan(375000) // soles convertidos a dólares
  })
})
