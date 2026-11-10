import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { DISTRITOS_CALLAO, DISTRITOS_LIMA, claveNombre, distritoCanonico, nombreDeLugar, tituloNombre, ubicacionDeDistrito } from "./ubicacion"

describe("nombres de lugar", () => {
  it("la clave ignora tildes, mayúsculas y espacios", () => {
    expect(claveNombre("  Santiago  DE Surco ")).toBe("santiago de surco")
    expect(claveNombre("Breña")).toBe("brena")
  })

  it("el título deja las partículas en minúscula", () => {
    expect(tituloNombre("SANTIAGO DE SURCO")).toBe("Santiago de Surco")
    expect(tituloNombre("la libertad")).toBe("La Libertad")
    expect(nombreDeLugar("  arequipa ")).toBe("Arequipa")
    expect(nombreDeLugar("   ")).toBeNull()
    expect(nombreDeLugar(null)).toBeNull()
  })

  it("unifica los distritos de Lima y del Callao con su nombre oficial", () => {
    expect(distritoCanonico("Santiago De Surco")).toBe("Santiago de Surco")
    expect(distritoCanonico("SURCO")).toBe("Santiago de Surco")
    expect(distritoCanonico("magdalena")).toBe("Magdalena del Mar")
    expect(distritoCanonico("Lima Cercado")).toBe("Lima")
    expect(distritoCanonico("Villa el salvador")).toBe("Villa El Salvador")
    expect(distritoCanonico("breña")).toBe("Breña")
    expect(distritoCanonico("Cayma")).toBe("Cayma") // fuera de Lima: formato título
    expect(distritoCanonico("  ")).toBeNull()
    expect(distritoCanonico(undefined)).toBeNull()
  })

  it("deduce departamento y provincia de un distrito conocido", () => {
    expect(ubicacionDeDistrito("Miraflores")).toEqual({ departamento: "Lima", provincia: "Lima" })
    expect(ubicacionDeDistrito("ventanilla")).toEqual({ departamento: "Callao", provincia: "Callao" })
    expect(ubicacionDeDistrito("Cayma")).toBeNull()
    expect(ubicacionDeDistrito("")).toBeNull()
  })

  it("la migración 011 conoce todos los distritos de la lista", () => {
    const sql = fs.readFileSync(path.join(import.meta.dirname, "../db/011_ubicacion.sql"), "utf8")
    for (const d of [...DISTRITOS_LIMA, ...DISTRITOS_CALLAO]) {
      expect(sql, d).toContain(`(${"'"}${claveNombre(d)}${"'"}, ${"'"}${d.replace(/'/g, "''")}${"'"}`)
    }
  })
})
