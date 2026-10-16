// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIdleSession } from "@/hooks/useIdleSession"

const getMock = vi.fn(() => Promise.resolve({}))
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => (getMock as (...x: unknown[]) => unknown)(...a) } }))

const OPTS = { idleMs: 10_000, warningMs: 3_000, keepAliveMs: 4_000 }
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

beforeEach(() => {
  vi.useFakeTimers()
  getMock.mockClear()
})
afterEach(() => vi.useRealTimers())

describe("useIdleSession", () => {
  it("avisa antes del plazo y cierra al agotarse", () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useIdleSession({ active: true, onExpire, ...OPTS }))

    advance(6_000)
    expect(result.current.warning).toBe(false)

    advance(2_000) // 8 s: entra en la ventana de aviso
    expect(result.current.warning).toBe(true)
    expect(result.current.secondsLeft).toBeLessThanOrEqual(3)
    expect(onExpire).not.toHaveBeenCalled()

    advance(2_500)
    expect(onExpire).toHaveBeenCalledTimes(1)
    advance(5_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it("la actividad reinicia el contador", () => {
    const onExpire = vi.fn()
    renderHook(() => useIdleSession({ active: true, onExpire, ...OPTS }))

    advance(6_000)
    act(() => void window.dispatchEvent(new Event("mousemove")))
    advance(6_000)
    expect(onExpire).not.toHaveBeenCalled()
    advance(4_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it("con el aviso abierto solo «seguir conectado» renueva la sesión", () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useIdleSession({ active: true, onExpire, ...OPTS }))

    advance(8_500)
    expect(result.current.warning).toBe(true)

    act(() => void window.dispatchEvent(new Event("mousemove")))
    expect(result.current.warning).toBe(true)

    act(() => result.current.stay())
    expect(result.current.warning).toBe(false)
    expect(getMock).toHaveBeenCalledWith("/session")
    advance(7_000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it("mantiene viva la sesión del servidor mientras hay actividad", () => {
    renderHook(() => useIdleSession({ active: true, onExpire: vi.fn(), ...OPTS }))
    advance(1_000)
    act(() => void window.dispatchEvent(new Event("keydown")))
    advance(3_100)
    expect(getMock).toHaveBeenCalledWith("/session")
  })

  it("recargar la página no reinicia el plazo: parte de la última actividad guardada", () => {
    sessionStorage.setItem("inmoda_last_activity", String(Date.now() - 8_000))
    const { result } = renderHook(() => useIdleSession({ active: true, onExpire: vi.fn(), ...OPTS }))
    advance(1_000)
    expect(result.current.warning).toBe(true)
  })

  it("no hace nada sin sesión iniciada", () => {
    const onExpire = vi.fn()
    renderHook(() => useIdleSession({ active: false, onExpire, ...OPTS }))
    advance(60_000)
    expect(onExpire).not.toHaveBeenCalled()
    expect(getMock).not.toHaveBeenCalled()
  })
})
