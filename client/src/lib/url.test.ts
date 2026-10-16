import { describe, expect, it } from "vitest"
import { safeHttpUrl } from "./url"

describe("safeHttpUrl", () => {
  it("acepta http y https", () => {
    expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1")
    expect(safeHttpUrl(" http://example.com ")).toBe("http://example.com/")
  })

  it("rechaza esquemas peligrosos y basura", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull()
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull()
    expect(safeHttpUrl("not a url")).toBeNull()
    expect(safeHttpUrl("")).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
  })
})
