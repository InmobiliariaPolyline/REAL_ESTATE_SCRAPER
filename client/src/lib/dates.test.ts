import { describe, expect, it } from "vitest"
import { addDaysISO, formatDate, todayISO } from "./dates"

describe("dates", () => {
  it("todayISO usa la hora de Lima, no UTC", () => {
    // 2026-01-01 03:00 UTC = 2025-12-31 22:00 en Lima
    expect(todayISO(new Date("2026-01-01T03:00:00Z"))).toBe("2025-12-31")
    expect(todayISO(new Date("2026-01-01T06:00:00Z"))).toBe("2026-01-01")
  })

  it("addDaysISO suma días cruzando mes y año", () => {
    expect(addDaysISO("2026-01-31", 30)).toBe("2026-03-02")
    expect(addDaysISO("2025-12-25", 37)).toBe("2026-01-31")
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28")
  })

  it("formatDate no desplaza el día y tolera valores vacíos", () => {
    expect(formatDate("2026-03-05")).toBe("05/03/2026")
    expect(formatDate(null)).toBe("—")
    expect(formatDate("no-es-fecha")).toBe("—")
  })
})
