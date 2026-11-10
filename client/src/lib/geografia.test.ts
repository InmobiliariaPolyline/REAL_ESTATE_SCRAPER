import { describe, expect, it } from "vitest"
import { departamentoDeProvincia, provinciaDeDistritoPrincipal, ubicacionCanonica } from "@shared/ubicacion"
import { combinarFacetas } from "./facetas"
import { elegirDepartamento, elegirDistrito, elegirProvincia, opcionesGeograficas, rutaGeografica, sugerirDistritos } from "./geografia"

const f = combinarFacetas(null)
const vacio = { departamento: "", provincia: "", distrito: "" }

describe("jerarquía geográfica compartida", () => {
  it("una provincia que solo existe en un departamento fija ese departamento", () => {
    expect(departamentoDeProvincia("Callao")).toBe("Callao")
    expect(departamentoDeProvincia("Huaral")).toBe("Lima")
    expect(departamentoDeProvincia("camaná")).toBe("Arequipa")
    expect(departamentoDeProvincia("Inexistente")).toBeNull()
  })

  it("los distritos principales tienen su provincia (la capital salvo excepciones)", () => {
    expect(provinciaDeDistritoPrincipal("Arequipa", "Cayma")).toBe("Arequipa")
    expect(provinciaDeDistritoPrincipal("Arequipa", "Mollendo")).toBe("Islay")
    expect(provinciaDeDistritoPrincipal("Lima", "Huacho")).toBe("Huaura")
    expect(provinciaDeDistritoPrincipal("Junín", "La Merced")).toBe("Chanchamayo")
    expect(provinciaDeDistritoPrincipal("Arequipa", "Nada")).toBeNull()
  })

  it("el Callao publicado como «Lima» se corrige; un distrito homónimo de otro departamento no", () => {
    expect(ubicacionCanonica({ departamento: "Lima", provincia: "Callao", distrito: "Callao" })).toEqual({ departamento: "Callao", provincia: "Callao", distrito: "Callao" })
    expect(ubicacionCanonica({ departamento: "Lima", provincia: "Lima", distrito: "Ventanilla" })).toMatchObject({ departamento: "Callao", provincia: "Callao" })
    expect(ubicacionCanonica({ departamento: null, provincia: null, distrito: "surco" })).toEqual({ departamento: "Lima", provincia: "Lima", distrito: "Santiago de Surco" })
    // «La Victoria» de Lambayeque no se vuelve la de Lima.
    expect(ubicacionCanonica({ departamento: "Lambayeque", provincia: "Chiclayo", distrito: "La Victoria" })).toEqual({ departamento: "Lambayeque", provincia: "Chiclayo", distrito: "La Victoria" })
    // Una provincia única corrige un departamento equivocado.
    expect(ubicacionCanonica({ departamento: "Lima", provincia: "Camaná", distrito: "Camaná" })).toMatchObject({ departamento: "Arequipa", provincia: "Camaná" })
  })

  it("las provincias y los distritos ofrecidos dependen de lo elegido arriba", () => {
    const callao = opcionesGeograficas(f, { departamento: "Callao", provincia: "" })
    expect(callao.provincias.map(p => p.valor)).toEqual(["Callao"])
    expect(callao.distritos.map(d => d.valor).sort()).toEqual(["Bellavista", "Callao", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Mi Perú", "Ventanilla"])
    const huaral = opcionesGeograficas(f, { departamento: "Lima", provincia: "Huaral" })
    expect(huaral.distritos.map(d => d.valor)).toEqual(["Huaral"])
    const lima = opcionesGeograficas(f, { departamento: "Lima", provincia: "Lima" })
    expect(lima.distritos.some(d => d.valor === "Miraflores")).toBe(true)
    expect(lima.distritos.some(d => d.valor === "Huacho")).toBe(false) // es de la provincia de Huaura
    const todo = opcionesGeograficas(f, { departamento: "", provincia: "" })
    expect(todo.provincias).toHaveLength(196)
  })

  it("elegir un nivel completa los de arriba y limpia los de abajo que ya no encajan", () => {
    expect(elegirProvincia(f, vacio, "Camaná")).toEqual({ departamento: "Arequipa", provincia: "Camaná", distrito: "" })
    expect(elegirDistrito(f, vacio, "Cayma")).toEqual({ departamento: "Arequipa", provincia: "Arequipa", distrito: "Cayma" })
    expect(elegirDistrito(f, vacio, "Ventanilla")).toEqual({ departamento: "Callao", provincia: "Callao", distrito: "Ventanilla" })
    // Un texto que no es un distrito conocido queda como búsqueda parcial.
    expect(elegirDistrito(f, { departamento: "Cusco", provincia: "", distrito: "" }, "wan")).toEqual({ departamento: "Cusco", provincia: "", distrito: "wan" })
    // Cambiar de departamento limpia provincia y distrito de otro lugar, pero no si siguen valiendo.
    expect(elegirDepartamento(f, { departamento: "Lima", provincia: "Lima", distrito: "Miraflores" }, "Arequipa")).toEqual({ departamento: "Arequipa", provincia: "", distrito: "" })
    expect(elegirDepartamento(f, { departamento: "", provincia: "Lima", distrito: "Miraflores" }, "Lima")).toEqual({ departamento: "Lima", provincia: "Lima", distrito: "Miraflores" })
    expect(elegirDepartamento(f, { departamento: "Lima", provincia: "Lima", distrito: "Miraflores" }, "")).toEqual({ departamento: "", provincia: "Lima", distrito: "Miraflores" })
  })

  it("el distrito homónimo se resuelve por el lugar ya elegido", () => {
    expect(elegirDistrito(f, { departamento: "Arequipa", provincia: "", distrito: "" }, "Miraflores")).toMatchObject({ departamento: "Arequipa" })
    expect(elegirDistrito(f, { departamento: "Lima", provincia: "", distrito: "" }, "Miraflores")).toMatchObject({ departamento: "Lima", provincia: "Lima" })
  })

  it("la ruta y las sugerencias", () => {
    expect(rutaGeografica({ departamento: "Lima", provincia: "Lima", distrito: "Miraflores" })).toBe("Lima › Lima › Miraflores")
    expect(rutaGeografica(vacio)).toBe("")
    expect(sugerirDistritos(f.distritos, "mirafl").map(d => `${d.valor}|${d.padre}`).sort()).toEqual(["Miraflores|Arequipa", "Miraflores|Lima", "San Juan de Miraflores|Lima"])
    expect(sugerirDistritos(f.distritos, "")).toEqual([]) // sin avisos y sin texto no se sugiere nada
    expect(sugerirDistritos(f.distritos, "san", 3)).toHaveLength(3)
  })
})
