import { describe, expect, it } from "vitest"
import { razonarTipo, tiposEnTitulo } from "./tipoInmueble"

describe("razonarTipo", () => {
  it("respeta el tipo del portal cuando el título coincide o no dice nada", () => {
    expect(razonarTipo("Departamento", "Venta departamento en Miraflores")).toBe("Departamento")
    expect(razonarTipo("Casa", "Hermosa propiedad con jardín")).toBe("Casa")
    expect(razonarTipo("Hotel", "Alquiler Hotel Lima Clifford")).toBe("Hotel")
    expect(razonarTipo("Proyecto", "Casa de playa en preventa")).toBe("Proyecto") // los proyectos no se tocan
  })

  it("corrige el tipo cuando el título dice claramente otra cosa", () => {
    expect(razonarTipo("Casa", "Terreno - La Molina")).toBe("Terreno")
    expect(razonarTipo("Departamento", "Casa de playa en Puerto Viejo de estreno")).toBe("Casa")
    expect(razonarTipo("Casa", "Alquilo Departamentos de Playa Condominio")).toBe("Departamento")
    expect(razonarTipo("Local Comercial", "Edificio Comercial en Miraflores")).toBe("Edificio")
    expect(razonarTipo("Local comercial", "ALQUILER OFICINA COMERCIAL IMPLEMENTADA")).toBe("Oficina")
    expect(razonarTipo("Casa", "Alquiler Local Comercial Esquina en San Juan de Lurigancho")).toBe("Local comercial")
  })

  it("no cambia el tipo si el título nombra el del portal en cualquier parte", () => {
    expect(razonarTipo("Terreno", "Se vende Casa como Terreno en Villa El Salvador")).toBe("Terreno")
    expect(razonarTipo("Terreno", "Local como terreno, 300 m2")).toBe("Terreno")
    expect(razonarTipo("Terreno", "Se vende casa con terreno, ideal para proyectos")).toBe("Terreno")
    expect(razonarTipo("Local comercial", "Local comercial en edificio Gama, La Victoria")).toBe("Local comercial")
    expect(razonarTipo("Local comercial", "Lince alquiler Oficina / Consultorios / Local Comercial")).toBe("Local comercial")
    expect(razonarTipo("Casa", "Casa para oficina en Miraflores")).toBe("Casa")
  })

  it("los extras del título no cuentan como el tipo (dormitorios, cochera, casa club)", () => {
    expect(razonarTipo("Departamento", "Frente a parque, muy grande, 3 dormitorios y cochera")).toBe("Departamento")
    expect(razonarTipo("Departamento", "Moderno / 1 dormitorio / 75 m2")).toBe("Departamento")
    expect(razonarTipo("Terreno", "Hacienda La Joya casa club")).toBe("Terreno")
    expect(tiposEnTitulo("Departamento con cochera y terraza")).toEqual(["Departamento"])
  })

  it("sin tipo del portal (o «Otros») se usa el del título, y sin nada, Departamento", () => {
    expect(razonarTipo("Otro", "Alquilo habitación con baño propio")).toBe("Habitación")
    expect(razonarTipo("", "Terreno en Cieneguilla")).toBe("Terreno")
    expect(razonarTipo(undefined, "Excelente oportunidad")).toBe("Departamento")
    expect(razonarTipo("Local Comercial", "")).toBe("Local comercial") // variantes de escritura pasan al nombre oficial
  })
})
