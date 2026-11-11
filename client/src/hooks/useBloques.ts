import { useState } from "react"

/**
 * Qué bloques de una ventana de filtros están desplegados. Por defecto se ve lo esencial y el resto queda recogido; lo que
 * deja abierto la persona se recuerda en este navegador (`almacen` distingue una ventana de otra).
 */
export function useBloques(claves: readonly string[], porDefecto: Record<string, boolean>, almacen: string) {
  const cargar = (): Record<string, boolean> => {
    try {
      const crudo = JSON.parse(localStorage.getItem(almacen) ?? "{}") as Record<string, unknown>
      return Object.fromEntries(Object.entries(crudo).filter(([k, v]) => claves.includes(k) && typeof v === "boolean")) as Record<string, boolean>
    } catch {
      return {}
    }
  }
  const [estado, setEstado] = useState<Record<string, boolean>>(cargar)
  const guardar = (e: Record<string, boolean>) => {
    try {
      localStorage.setItem(almacen, JSON.stringify(e))
    } catch {
      /* sin almacenamiento: vale solo para esta visita */
    }
    return e
  }
  const estaAbierto = (clave: string) => estado[clave] ?? porDefecto[clave] ?? false
  return {
    estaAbierto,
    alternar: (clave: string) => setEstado(e => guardar({ ...e, [clave]: !(e[clave] ?? porDefecto[clave] ?? false) })),
    todosAbiertos: claves.every(estaAbierto),
    cambiarTodos: (abierto: boolean) => setEstado(guardar(Object.fromEntries(claves.map(c => [c, abierto])))),
  }
}
