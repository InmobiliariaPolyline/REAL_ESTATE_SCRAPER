import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Desmonta lo renderizado entre pruebas (las globales de Vitest están desactivadas).
afterEach(() => {
  cleanup()
  if (typeof document === "undefined") return // pruebas de lógica pura (entorno node)
  localStorage.clear()
  document.documentElement.className = ""
})
